import fs from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { contentRoot } from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import {
  HISTORY_LIMIT,
  claimDocumentVersion,
  listDocumentVersions,
} from "@/lib/document-version";
import { prisma } from "@/lib/prisma";
import { upsertUser } from "@/lib/rbac-seed";

/**
 * O histórico é gravado pelo sync, contra disco e banco reais — é o mesmo
 * caminho que uma edição por FTP percorre. Mockar qualquer uma das pontas
 * testaria um versionamento que não é o que roda.
 */

function documentPath(departmentSlug: string, documentSlug: string): string {
  return path.join(contentRoot(), departmentSlug, `${documentSlug}.html`);
}

async function writeDocument(
  departmentSlug: string,
  documentSlug: string,
  options: { title: string; body?: string },
): Promise<void> {
  const dir = path.join(contentRoot(), departmentSlug);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(
    documentPath(departmentSlug, documentSlug),
    `<!-- title: ${options.title} -->\n<article>${options.body ?? "<p>conteúdo</p>"}</article>\n`,
    "utf8",
  );
}

async function getDocument(departmentSlug: string, documentSlug: string) {
  const department = await prisma.department.findUniqueOrThrow({
    where: { slug: departmentSlug },
  });
  return prisma.document.findUniqueOrThrow({
    where: { departmentId_slug: { departmentId: department.id, slug: documentSlug } },
  });
}

describe("histórico de versões", () => {
  // Mesmo motivo do content-sync.test.ts: um CONTENT_ROOT por ARQUIVO de
  // teste, então arquivo escrito por um teste seria redescoberto pelo
  // seguinte. Ver tests/README.md.
  beforeEach(async () => {
    await fs.rm(contentRoot(), { recursive: true, force: true });
    await fs.mkdir(contentRoot(), { recursive: true });
  });

  it("a primeira indexação cria a versão 1", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const versions = await listDocumentVersions(document.id);

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      version: 1,
      title: "Rotina de backup",
      source: "FILESYSTEM",
      authorName: null,
    });
  });

  it("o snapshot guarda o arquivo inteiro, front-matter incluído", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const stored = await prisma.documentVersion.findFirstOrThrow({
      where: { documentId: document.id },
    });
    const noDisco = await fs.readFile(documentPath("ti", "backup"), "utf8");

    // É isto que permite restaurar byte a byte, sem remontar o cabeçalho.
    expect(stored.rawHtml).toBe(noDisco);
    expect(stored.contentHash).toBe(document.contentHash);
  });

  it("um sync com force não cria versão de documento intocado", async () => {
    // O portal dispara um `force` a cada gravação pela UI. Sem a checagem de
    // hash, uma edição num documento criaria versão em todos os outros.
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await writeDocument("ti", "outro", { title: "Outro documento" });
    await syncContent({ trigger: "MANUAL", force: true });

    await syncContent({ trigger: "MANUAL", force: true });
    await syncContent({ trigger: "MANUAL", force: true });

    const outro = await getDocument("ti", "outro");
    expect(await listDocumentVersions(outro.id)).toHaveLength(1);
  });

  it("editar o arquivo por fora cria versão nova, marcada como filesystem", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>agora com restore semanal</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const versions = await listDocumentVersions(document.id);

    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0].source).toBe("FILESYSTEM");
    expect(versions[0].authorName).toBeNull();
  });

  it("um touch sem mudança de conteúdo não cria versão", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const futuro = new Date(Date.now() + 60_000);
    await fs.utimes(documentPath("ti", "backup"), futuro, futuro);
    await syncContent({ trigger: "MANUAL" });

    const document = await getDocument("ti", "backup");
    expect(await listDocumentVersions(document.id)).toHaveLength(1);
  });

  it("um documento que volta do estado órfão não ganha versão duplicada", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const conteudo = await fs.readFile(documentPath("ti", "backup"), "utf8");
    await fs.rm(documentPath("ti", "backup"));
    await syncContent({ trigger: "MANUAL", force: true });

    await fs.writeFile(documentPath("ti", "backup"), conteudo, "utf8");
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    expect(document.isOrphan).toBe(false);
    expect(await listDocumentVersions(document.id)).toHaveLength(1);
  });

  it("calcula a variação de tamanho entre versões consecutivas", async () => {
    await writeDocument("ti", "backup", { title: "T", body: "<p>a</p>" });
    await syncContent({ trigger: "MANUAL", force: true });

    await writeDocument("ti", "backup", { title: "T", body: "<p>abcdefgh</p>" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const [nova, primeira] = await listDocumentVersions(document.id);

    expect(nova.byteDelta).toBe(7);
    // A versão mais antiga guardada não tem com o que comparar.
    expect(primeira.byteDelta).toBeNull();
  });

  it("a retenção poda as versões mais antigas sem renumerar as que ficam", async () => {
    await writeDocument("ti", "backup", { title: "T", body: "<p>0</p>" });
    await syncContent({ trigger: "MANUAL", force: true });

    for (let i = 1; i <= HISTORY_LIMIT + 3; i += 1) {
      await writeDocument("ti", "backup", { title: "T", body: `<p>${i}</p>` });
      await syncContent({ trigger: "MANUAL", force: true });
    }

    const document = await getDocument("ti", "backup");
    const versions = await listDocumentVersions(document.id);

    expect(versions).toHaveLength(HISTORY_LIMIT);
    expect(versions[0].version).toBe(HISTORY_LIMIT + 4);
    // As mais antigas sumiram, mas a numeração das restantes não mudou.
    expect(versions[versions.length - 1].version).toBe(5);
  });

  it("claimDocumentVersion assina a última versão quando o hash bate", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const authorId = await upsertUser({
      name: "Ana",
      email: "ana@exemplo.com",
      password: "x",
    });

    await claimDocumentVersion({
      documentId: document.id,
      contentHash: document.contentHash,
      source: "UI_EDIT",
      authorId,
    });

    const [latest] = await listDocumentVersions(document.id);
    expect(latest.source).toBe("UI_EDIT");
    expect(latest.authorName).toBe("Ana");
  });

  it("claimDocumentVersion não assina versão de outro conteúdo", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const authorId = await upsertUser({
      name: "Ana",
      email: "ana@exemplo.com",
      password: "x",
    });

    // Hash de um conteúdo que não é o da última versão: atribuir mesmo assim
    // colaria o nome de alguém numa mudança que não foi dele.
    await claimDocumentVersion({
      documentId: document.id,
      contentHash: "hash-de-outra-coisa",
      source: "UI_EDIT",
      authorId,
    });

    const [latest] = await listDocumentVersions(document.id);
    expect(latest.source).toBe("FILESYSTEM");
    expect(latest.authorName).toBeNull();
  });

  it("claimDocumentVersion não sobrescreve uma versão já assinada", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    const ana = await upsertUser({ name: "Ana", email: "ana@exemplo.com", password: "x" });
    const bruno = await upsertUser({ name: "Bruno", email: "bruno@exemplo.com", password: "x" });

    const claim = { documentId: document.id, contentHash: document.contentHash } as const;
    await claimDocumentVersion({ ...claim, source: "UI_EDIT", authorId: ana });
    await claimDocumentVersion({ ...claim, source: "RESTORE", authorId: bruno });

    const [latest] = await listDocumentVersions(document.id);
    expect(latest.authorName).toBe("Ana");
    expect(latest.source).toBe("UI_EDIT");
  });

  it("apagar o documento apaga o histórico junto", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const document = await getDocument("ti", "backup");
    await prisma.document.delete({ where: { id: document.id } });

    expect(
      await prisma.documentVersion.count({ where: { documentId: document.id } }),
    ).toBe(0);
  });
});
