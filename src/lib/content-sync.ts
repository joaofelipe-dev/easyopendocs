import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import type { SyncTrigger } from "@/generated/prisma/enums";
import {
  DEPARTMENT_META_FILE,
  contentRoot,
  extractDescription,
  extractTitle,
  hashContent,
  humanizeSlug,
  isValidSlug,
  parseFrontMatter,
  toRelativePath,
} from "@/lib/content";
import {
  SEARCH_INDEX_VERSION,
  documentPlainText,
  indexDocumentSearch,
} from "@/lib/search-index";

/**
 * Indexador do filesystem -> Postgres.
 *
 * O filesystem é a fonte de verdade do conteúdo; o banco é um índice para
 * conseguirmos listar, permissionar e paginar sem varrer disco a cada query.
 * Por isso o sync nunca apaga: o que some do disco vira órfão, preservando
 * permissões e histórico caso o arquivo volte (git checkout, restore de FTP).
 */

export type SyncStats = {
  departmentsCreated: number;
  departmentsUpdated: number;
  departmentsOrphaned: number;
  documentsCreated: number;
  documentsUpdated: number;
  documentsOrphaned: number;
  documentsSkipped: number;
};

export type SyncResult = SyncStats & {
  ok: boolean;
  durationMs: number;
  error?: string;
  /** true quando a chamada foi absorvida pelo throttle e nada foi varrido. */
  throttled?: boolean;
};

const EMPTY_STATS: SyncStats = {
  departmentsCreated: 0,
  departmentsUpdated: 0,
  departmentsOrphaned: 0,
  documentsCreated: 0,
  documentsUpdated: 0,
  documentsOrphaned: 0,
  documentsSkipped: 0,
};

/** Janela mínima entre dois syncs automáticos disparados por page load. */
const THROTTLE_MS = Number(process.env.SYNC_THROTTLE_MS ?? 3000);

type SyncModuleState = {
  running: Promise<SyncResult> | null;
  lastRunAt: number;
  lastResult: SyncResult | null;
};

// Vive no globalThis para sobreviver ao hot reload do dev server — senão cada
// recompilação zera o throttle e o lock.
const globalForSync = globalThis as unknown as {
  __docPortalSync?: SyncModuleState;
};

const state: SyncModuleState = (globalForSync.__docPortalSync ??= {
  running: null,
  lastRunAt: 0,
  lastResult: null,
});

// ---------------------------------------------------------------------------
// Leitura do filesystem
// ---------------------------------------------------------------------------

type ScannedDocument = {
  slug: string;
  absolutePath: string;
  relativePath: string;
  mtime: Date;
  size: number;
};

type ScannedDepartment = {
  slug: string;
  name: string;
  description: string | null;
  relativePath: string;
  documents: ScannedDocument[];
};

async function readDepartmentMeta(
  dir: string,
  slug: string,
): Promise<{ name: string; description: string | null }> {
  try {
    const raw = await fs.readFile(path.join(dir, DEPARTMENT_META_FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      const meta = parsed as { name?: unknown; description?: unknown };
      return {
        name:
          typeof meta.name === "string" && meta.name.trim()
            ? meta.name.trim()
            : humanizeSlug(slug),
        description:
          typeof meta.description === "string" && meta.description.trim()
            ? meta.description.trim()
            : null,
      };
    }
  } catch {
    // Sem metadados (ou JSON inválido): o nome humanizado do slug já serve.
  }

  return { name: humanizeSlug(slug), description: null };
}

async function scanContentTree(): Promise<ScannedDepartment[]> {
  const root = contentRoot();

  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // Ainda não existe conteúdo — cria a raiz e devolve vazio.
      await fs.mkdir(root, { recursive: true });
      return [];
    }
    throw error;
  }

  const departments: ScannedDepartment[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (!isValidSlug(entry.name)) continue;

    const dir = path.join(root, entry.name);
    const meta = await readDepartmentMeta(dir, entry.name);
    const documents = await scanDepartmentDocuments(dir, entry.name);

    departments.push({
      slug: entry.name,
      name: meta.name,
      description: meta.description,
      relativePath: toRelativePath(dir),
      documents,
    });
  }

  return departments.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function scanDepartmentDocuments(
  dir: string,
  departmentSlug: string,
): Promise<ScannedDocument[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const documents: ScannedDocument[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (!entry.name.toLowerCase().endsWith(".html")) continue;

    const slug = entry.name.slice(0, -".html".length);
    if (!isValidSlug(slug)) {
      console.warn(
        `[content-sync] ignorando "${departmentSlug}/${entry.name}": nome de arquivo fora do padrão slug-kebab-case`,
      );
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    const stats = await fs.stat(absolutePath);

    documents.push({
      slug,
      absolutePath,
      relativePath: toRelativePath(absolutePath),
      mtime: stats.mtime,
      size: stats.size,
    });
  }

  return documents;
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

export type SyncOptions = {
  trigger?: SyncTrigger;
  /** Ignora o throttle e o hash: reprocessa todos os arquivos. */
  force?: boolean;
  /** Grava um registro em SyncLog. Padrão: true. */
  log?: boolean;
};

/**
 * Ponto de entrada usado pelas páginas. Colapsa chamadas concorrentes em uma
 * única varredura e respeita o throttle, para que 5 requests simultâneos não
 * virem 5 varreduras de disco.
 */
export async function syncContent(options: SyncOptions = {}): Promise<SyncResult> {
  const { force = false } = options;

  if (state.running) return state.running;

  if (!force && state.lastResult && Date.now() - state.lastRunAt < THROTTLE_MS) {
    return { ...state.lastResult, throttled: true };
  }

  const run = runSync(options).finally(() => {
    state.running = null;
    state.lastRunAt = Date.now();
  });

  state.running = run;
  const result = await run;
  state.lastResult = result;
  return result;
}

async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { trigger = "AUTOMATIC", force = false, log = true } = options;
  const startedAt = Date.now();
  const stats: SyncStats = { ...EMPTY_STATS };

  try {
    const scanned = await scanContentTree();
    const seenDepartmentIds = new Set<string>();

    for (const scannedDepartment of scanned) {
      const department = await upsertDepartment(scannedDepartment, stats);
      seenDepartmentIds.add(department.id);
      await syncDepartmentDocuments(department.id, scannedDepartment, stats, force);
    }

    await markMissingDepartmentsAsOrphans(seenDepartmentIds, stats);

    const result: SyncResult = {
      ...stats,
      ok: true,
      durationMs: Date.now() - startedAt,
    };

    if (log) await writeSyncLog(trigger, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: SyncResult = {
      ...stats,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: message,
    };

    console.error("[content-sync] falhou:", error);
    if (log) await writeSyncLog(trigger, result).catch(() => undefined);
    return result;
  }
}

async function upsertDepartment(scanned: ScannedDepartment, stats: SyncStats) {
  const existing = await prisma.department.findUnique({
    where: { slug: scanned.slug },
  });

  if (!existing) {
    stats.departmentsCreated += 1;
    return prisma.department.create({
      data: {
        slug: scanned.slug,
        name: scanned.name,
        description: scanned.description,
        path: scanned.relativePath,
        isOrphan: false,
      },
    });
  }

  const changed =
    existing.name !== scanned.name ||
    existing.description !== scanned.description ||
    existing.path !== scanned.relativePath ||
    existing.isOrphan;

  if (!changed) return existing;

  stats.departmentsUpdated += 1;
  return prisma.department.update({
    where: { id: existing.id },
    data: {
      name: scanned.name,
      description: scanned.description,
      path: scanned.relativePath,
      isOrphan: false,
    },
  });
}

async function syncDepartmentDocuments(
  departmentId: string,
  scanned: ScannedDepartment,
  stats: SyncStats,
  force: boolean,
): Promise<void> {
  const existingDocuments = await prisma.document.findMany({
    where: { departmentId },
  });
  const existingBySlug = new Map(existingDocuments.map((doc) => [doc.slug, doc]));
  const seenSlugs = new Set<string>();

  for (const file of scanned.documents) {
    seenSlugs.add(file.slug);
    const existing = existingBySlug.get(file.slug);

    // Checagem barata primeiro: mtime + tamanho iguais => arquivo intocado.
    // `searchVersion` entra aqui para que uma mudança no indexador force a
    // releitura mesmo do que não mudou no disco — é o backfill do índice de
    // busca acontecendo sozinho, sem `?force=1`.
    const unchangedStat =
      existing &&
      !existing.isOrphan &&
      existing.fileMtime.getTime() === file.mtime.getTime() &&
      existing.fileSize === file.size &&
      existing.filePath === file.relativePath &&
      existing.searchVersion === SEARCH_INDEX_VERSION;

    if (unchangedStat && !force) {
      stats.documentsSkipped += 1;
      continue;
    }

    const raw = await fs.readFile(file.absolutePath, "utf8");
    const contentHash = hashContent(raw);

    if (existing && existing.contentHash === contentHash && !existing.isOrphan && !force) {
      // Conteúdo idêntico, só o mtime mudou (touch, checkout) — ou o índice de
      // busca ficou para trás. Atualiza o carimbo para que o próximo sync volte
      // a cair no atalho barato.
      await prisma.document.update({
        where: { id: existing.id },
        data: { fileMtime: file.mtime, fileSize: file.size, filePath: file.relativePath },
      });

      if (existing.searchVersion !== SEARCH_INDEX_VERSION) {
        await reindexDocument(existing.id, existing.title, existing.description, raw);
      }

      stats.documentsSkipped += 1;
      continue;
    }

    const { frontMatter } = parseFrontMatter(raw);
    const title = extractTitle(raw, frontMatter, file.slug);
    const description = extractDescription(frontMatter);
    const plainText = documentPlainText(raw);

    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: {
          title,
          description,
          filePath: file.relativePath,
          contentHash,
          fileMtime: file.mtime,
          fileSize: file.size,
          isOrphan: false,
          plainText,
        },
      });
      await indexDocumentSearch({
        documentId: existing.id,
        title,
        description,
        plainText,
      });
      stats.documentsUpdated += 1;
    } else {
      const created = await prisma.document.create({
        data: {
          departmentId,
          slug: file.slug,
          title,
          description,
          filePath: file.relativePath,
          contentHash,
          fileMtime: file.mtime,
          fileSize: file.size,
          isOrphan: false,
          plainText,
        },
      });
      await indexDocumentSearch({
        documentId: created.id,
        title,
        description,
        plainText,
      });
      stats.documentsCreated += 1;
    }
  }

  const disappeared = existingDocuments.filter(
    (doc) => !seenSlugs.has(doc.slug) && !doc.isOrphan,
  );

  if (disappeared.length > 0) {
    await prisma.document.updateMany({
      where: { id: { in: disappeared.map((doc) => doc.id) } },
      data: { isOrphan: true },
    });
    stats.documentsOrphaned += disappeared.length;
  }
}

/**
 * Recalcula só o índice de busca, sem tocar em nada do conteúdo — é o caminho
 * do documento cujo arquivo não mudou mas cujo `searchVersion` ficou para trás.
 */
async function reindexDocument(
  documentId: string,
  title: string,
  description: string | null,
  raw: string,
): Promise<void> {
  const plainText = documentPlainText(raw);

  await prisma.document.update({
    where: { id: documentId },
    data: { plainText },
  });
  await indexDocumentSearch({ documentId, title, description, plainText });
}

async function markMissingDepartmentsAsOrphans(
  seenDepartmentIds: Set<string>,
  stats: SyncStats,
): Promise<void> {
  const disappeared = await prisma.department.findMany({
    where: { id: { notIn: [...seenDepartmentIds] }, isOrphan: false },
    select: { id: true },
  });

  if (disappeared.length === 0) return;

  const ids = disappeared.map((department) => department.id);

  await prisma.department.updateMany({
    where: { id: { in: ids } },
    data: { isOrphan: true },
  });

  const orphanedDocuments = await prisma.document.updateMany({
    where: { departmentId: { in: ids }, isOrphan: false },
    data: { isOrphan: true },
  });

  stats.departmentsOrphaned += disappeared.length;
  stats.documentsOrphaned += orphanedDocuments.count;
}

async function writeSyncLog(
  trigger: SyncTrigger,
  result: SyncResult,
): Promise<void> {
  await prisma.syncLog.create({
    data: {
      trigger,
      finishedAt: new Date(),
      durationMs: result.durationMs,
      ok: result.ok,
      error: result.error ?? null,
      departmentsCreated: result.departmentsCreated,
      departmentsUpdated: result.departmentsUpdated,
      departmentsOrphaned: result.departmentsOrphaned,
      documentsCreated: result.documentsCreated,
      documentsUpdated: result.documentsUpdated,
      documentsOrphaned: result.documentsOrphaned,
      documentsSkipped: result.documentsSkipped,
    },
  });
}

/** Lê o HTML bruto de um documento já indexado. */
export async function readDocumentSource(filePath: string): Promise<string | null> {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);

  // Defesa em profundidade: filePath vem do banco, mas o banco espelha nomes de
  // arquivo, e nome de arquivo é entrada de usuário.
  const root = contentRoot();
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    console.error(`[content-sync] caminho fora de CONTENT_ROOT recusado: ${filePath}`);
    return null;
  }

  try {
    return await fs.readFile(absolute, "utf8");
  } catch {
    return null;
  }
}
