import { prisma } from "@/lib/prisma";
import type { DocumentVersionSource } from "@/generated/prisma/enums";

/**
 * Histórico de versões das documentações.
 *
 * Sem `server-only`, de propósito: o sync chama daqui, e o `prisma db seed`
 * roda o sync fora do Next, via tsx — onde o pacote `server-only` estoura.
 * Mesmo motivo de permissions.ts ser separado de rbac.ts. Não há nada de
 * cliente aqui de qualquer forma: só Prisma, que também não é `server-only`.
 *
 * Quem grava é o sync (`content-sync.ts`), no único ponto do app que já lê o
 * arquivo do disco — é o que faz uma edição por FTP, git ou `cp` no servidor
 * entrar no histórico do mesmo jeito que uma edição pela tela. As telas não
 * gravam versão por conta própria: elas escrevem o arquivo e deixam o sync
 * fazer o resto, senão haveria dois caminhos para manter em sincronia.
 *
 * O snapshot é o arquivo INTEIRO, front-matter incluído. Guardar só o corpo
 * obrigaria a remontar o cabeçalho na restauração e torcer para dar igual.
 */

/**
 * Quantas versões por documento ficam guardadas. O snapshot é o texto
 * completo, então sem teto o banco cresce proporcional ao número de
 * salvamentos, não ao de documentos.
 */
export const HISTORY_LIMIT = Math.max(
  Number(process.env.DOCUMENT_HISTORY_LIMIT ?? 50),
  1,
);

/**
 * Grava uma versão e poda o excedente. Chamado só quando o conteúdo mudou de
 * verdade (hash diferente) — um `force` de sync relê todo arquivo do disco, e
 * versionar isso encheria o histórico de entradas idênticas.
 *
 * Toda versão nasce como `FILESYSTEM` e sem autor, porque é isso que o sync
 * sabe. Quando a mudança veio de uma tela, a ação chama `claimDocumentVersion`
 * logo depois para assinar.
 */
export async function recordDocumentVersion(input: {
  documentId: string;
  title: string;
  description: string | null;
  rawHtml: string;
  contentHash: string;
}): Promise<void> {
  const last = await prisma.documentVersion.findFirst({
    where: { documentId: input.documentId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.documentVersion.create({
    data: {
      documentId: input.documentId,
      version: (last?.version ?? 0) + 1,
      title: input.title,
      description: input.description,
      rawHtml: input.rawHtml,
      contentHash: input.contentHash,
      byteSize: Buffer.byteLength(input.rawHtml, "utf8"),
    },
  });

  await pruneDocumentVersions(input.documentId);
}

/** Mantém só as `HISTORY_LIMIT` versões mais recentes do documento. */
async function pruneDocumentVersions(documentId: string): Promise<void> {
  const surviving = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: "desc" },
    take: HISTORY_LIMIT,
    select: { version: true },
  });

  if (surviving.length < HISTORY_LIMIT) return;

  const oldestKept = surviving[surviving.length - 1].version;

  await prisma.documentVersion.deleteMany({
    where: { documentId, version: { lt: oldestKept } },
  });
}

/**
 * Marca a última versão de um documento como tendo vindo do portal, em vez de
 * "alterada no filesystem".
 *
 * Por que não passar a autoria por dentro do sync: `syncContent` colapsa
 * chamadas concorrentes numa varredura só (ver content-sync.ts), então o
 * contexto de quem salvou pode acabar descartado junto com a chamada
 * absorvida. Aqui a atribuição é um passo à parte, idempotente, feito depois
 * que o sync já gravou o snapshot.
 *
 * Só reivindica a versão que ainda está sem dono E cujo hash é o do arquivo
 * que a ação acabou de escrever: se o conteúdo já mudou de novo no meio do
 * caminho, é melhor deixar como "filesystem" do que atribuir a versão errada
 * a alguém.
 */
export async function claimDocumentVersion(input: {
  documentId: string;
  contentHash: string;
  source: DocumentVersionSource;
  authorId: string;
}): Promise<void> {
  const latest = await prisma.documentVersion.findFirst({
    where: { documentId: input.documentId },
    orderBy: { version: "desc" },
    select: { id: true, contentHash: true, source: true, authorId: true },
  });

  if (!latest) return;
  if (latest.contentHash !== input.contentHash) return;
  if (latest.source !== "FILESYSTEM" || latest.authorId !== null) return;

  await prisma.documentVersion.update({
    where: { id: latest.id },
    data: { source: input.source, authorId: input.authorId },
  });
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export type DocumentVersionSummary = {
  version: number;
  title: string;
  description: string | null;
  contentHash: string;
  byteSize: number;
  source: DocumentVersionSource;
  authorName: string | null;
  createdAt: Date;
  /** Diferença de tamanho para a versão imediatamente anterior. */
  byteDelta: number | null;
};

export async function listDocumentVersions(
  documentId: string,
): Promise<DocumentVersionSummary[]> {
  const rows = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: "desc" },
    select: {
      version: true,
      title: true,
      description: true,
      contentHash: true,
      byteSize: true,
      source: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  return rows.map((row, index) => {
    // `rows` vem do mais novo para o mais velho, então o "anterior" é o
    // próximo item da lista — e a versão mais antiga guardada não tem com o
    // que comparar (pode ter havido outra, já podada pela retenção).
    const previous = rows[index + 1];

    return {
      version: row.version,
      title: row.title,
      description: row.description,
      contentHash: row.contentHash,
      byteSize: row.byteSize,
      source: row.source,
      authorName: row.author?.name ?? null,
      createdAt: row.createdAt,
      byteDelta: previous ? row.byteSize - previous.byteSize : null,
    };
  });
}

export async function getDocumentVersion(
  documentId: string,
  version: number,
): Promise<{
  version: number;
  title: string;
  description: string | null;
  rawHtml: string;
  contentHash: string;
  source: DocumentVersionSource;
  authorName: string | null;
  createdAt: Date;
} | null> {
  const row = await prisma.documentVersion.findUnique({
    where: { documentId_version: { documentId, version } },
    select: {
      version: true,
      title: true,
      description: true,
      rawHtml: true,
      contentHash: true,
      source: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  if (!row) return null;

  const { author, ...rest } = row;
  return { ...rest, authorName: author?.name ?? null };
}

/** Rótulo em português da origem, usado na listagem e no cabeçalho da versão. */
export const SOURCE_LABEL: Record<DocumentVersionSource, string> = {
  UI_CREATE: "Criada pelo portal",
  UI_EDIT: "Editada pelo portal",
  FILESYSTEM: "Alterada no filesystem",
  RESTORE: "Restaurada",
};
