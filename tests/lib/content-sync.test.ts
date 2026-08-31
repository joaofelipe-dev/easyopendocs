import fs from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { contentRoot } from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";

/**
 * syncContent() é o coração do "filesystem é a fonte de verdade" (README).
 * Estes testes escrevem arquivos de verdade num CONTENT_ROOT temporário (ver
 * tests/setup.ts) e leem o Postgres de teste de verdade depois — nada aqui é
 * mockado, porque mockar fs OU banco seria reimplementar a própria função sob
 * outro nome e testar a cópia, não o original.
 */

function departmentDir(slug: string): string {
  return path.join(contentRoot(), slug);
}

async function writeDocument(
  departmentSlug: string,
  documentSlug: string,
  options: { title: string; description?: string; body?: string } = { title: "Título" },
): Promise<void> {
  await fs.mkdir(departmentDir(departmentSlug), { recursive: true });

  const lines = [`<!-- title: ${options.title} -->`];
  if (options.description) lines.push(`<!-- description: ${options.description} -->`);
  lines.push(`<article>${options.body ?? "<p>conteúdo</p>"}</article>`, "");

  await fs.writeFile(
    path.join(departmentDir(departmentSlug), `${documentSlug}.html`),
    lines.join("\n"),
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

describe("syncContent", () => {
  // tests/setup.ts cria UM CONTENT_ROOT por ARQUIVO de teste (não por teste —
  // "@/lib/content" congela o valor no import, então trocar de diretório a
  // cada teste não é possível). Sem isto, arquivo escrito por um teste continua
  // no disco quando o próximo roda, e o próximo sync o redescobre como se
  // fosse dele — o banco fica limpo (resetDatabase), mas o disco não ficava.
  beforeEach(async () => {
    await fs.rm(contentRoot(), { recursive: true, force: true });
    await fs.mkdir(contentRoot(), { recursive: true });
  });

  it("cria departamento e documento a partir de um arquivo novo no disco", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      description: "Como e quando os backups rodam",
    });

    const result = await syncContent({ trigger: "MANUAL", force: true });

    expect(result.ok).toBe(true);
    expect(result.departmentsCreated).toBe(1);
    expect(result.documentsCreated).toBe(1);

    const department = await prisma.department.findUniqueOrThrow({ where: { slug: "ti" } });
    expect(department.name).toBe("Ti"); // sem _departamento.json, sai do slug humanizado
    expect(department.isOrphan).toBe(false);

    const document = await getDocument("ti", "backup");
    expect(document.title).toBe("Rotina de backup");
    expect(document.description).toBe("Como e quando os backups rodam");
    expect(document.isOrphan).toBe(false);
  });

  it("lê o nome do departamento de _departamento.json quando existir", async () => {
    await fs.mkdir(departmentDir("rh"), { recursive: true });
    await fs.writeFile(
      path.join(departmentDir("rh"), "_departamento.json"),
      JSON.stringify({ name: "Recursos Humanos", description: "Pessoas e cultura" }),
      "utf8",
    );
    await writeDocument("rh", "ferias", { title: "Política de férias" });

    await syncContent({ trigger: "MANUAL", force: true });

    const department = await prisma.department.findUniqueOrThrow({ where: { slug: "rh" } });
    expect(department.name).toBe("Recursos Humanos");
    expect(department.description).toBe("Pessoas e cultura");
  });

  it("ignora arquivos e pastas prefixados com _ (não viram documento)", async () => {
    await fs.mkdir(path.join(departmentDir("ti"), "_media"), { recursive: true });
    await fs.writeFile(
      path.join(departmentDir("ti"), "_media", "foto.png"),
      "não é html",
      "utf8",
    );
    await writeDocument("ti", "guia", { title: "Guia" });

    const result = await syncContent({ trigger: "MANUAL", force: true });

    expect(result.documentsCreated).toBe(1); // só "guia", não "_media/foto.png"
    const department = await prisma.department.findUniqueOrThrow({ where: { slug: "ti" } });
    const documents = await prisma.document.findMany({ where: { departmentId: department.id } });
    expect(documents.map((document) => document.slug)).toEqual(["guia"]);
  });

  describe("depois de uma primeira sincronização", () => {
    beforeEach(async () => {
      await writeDocument("ti", "backup", { title: "Rotina de backup" });
      await syncContent({ trigger: "MANUAL", force: true });
    });

    it("não reprocessa quando mtime e tamanho não mudaram", async () => {
      const result = await syncContent({ trigger: "MANUAL" }); // sem force

      expect(result.documentsSkipped).toBe(1);
      expect(result.documentsUpdated).toBe(0);
      expect(result.documentsCreated).toBe(0);
    });

    it("mtime tocado sem mudar o conteúdo só atualiza o carimbo, não reprocessa como update", async () => {
      const file = path.join(departmentDir("ti"), "backup.html");
      const before = await getDocument("ti", "backup");

      // Muda só o mtime (git checkout, `touch`), mantendo o hash igual.
      const bumped = new Date(before.fileMtime.getTime() + 5000);
      await fs.utimes(file, bumped, bumped);

      const result = await syncContent({ trigger: "MANUAL" }); // sem force

      expect(result.documentsSkipped).toBe(1);
      expect(result.documentsUpdated).toBe(0);

      const after = await getDocument("ti", "backup");
      expect(after.fileMtime.getTime()).toBe(bumped.getTime());
      expect(after.contentHash).toBe(before.contentHash);
    });

    it("conteúdo alterado é reprocessado como update, não como skip", async () => {
      await writeDocument("ti", "backup", { title: "Rotina de backup", body: "<p>outro texto</p>" });

      const result = await syncContent({ trigger: "MANUAL" }); // sem force

      expect(result.documentsUpdated).toBe(1);
      expect(result.documentsSkipped).toBe(0);
    });

    it("arquivo apagado vira órfão, preservando o registro; departamento continua ativo", async () => {
      await fs.unlink(path.join(departmentDir("ti"), "backup.html"));

      const result = await syncContent({ trigger: "MANUAL", force: true });

      expect(result.documentsOrphaned).toBe(1);
      const document = await getDocument("ti", "backup");
      expect(document.isOrphan).toBe(true);

      const department = await prisma.department.findUniqueOrThrow({ where: { slug: "ti" } });
      expect(department.isOrphan).toBe(false);
    });

    it("arquivo que volta com o mesmo nome desorfana e reaproveita o mesmo registro", async () => {
      const original = await getDocument("ti", "backup");
      await fs.unlink(path.join(departmentDir("ti"), "backup.html"));
      await syncContent({ trigger: "MANUAL", force: true });

      await writeDocument("ti", "backup", { title: "Rotina de backup (voltou)" });
      await syncContent({ trigger: "MANUAL", force: true });

      const returned = await getDocument("ti", "backup");
      expect(returned.isOrphan).toBe(false);
      // Mesma linha do banco, não uma recriada — é o que preserva
      // createdById/histórico entre o sumiço e o retorno do arquivo.
      expect(returned.id).toBe(original.id);
      expect(returned.title).toBe("Rotina de backup (voltou)");
    });

    it("pasta do departamento inteira removida orfaneia departamento e seus documentos", async () => {
      await fs.rm(departmentDir("ti"), { recursive: true, force: true });

      const result = await syncContent({ trigger: "MANUAL", force: true });

      expect(result.departmentsOrphaned).toBe(1);
      expect(result.documentsOrphaned).toBe(1);

      const department = await prisma.department.findUniqueOrThrow({ where: { slug: "ti" } });
      expect(department.isOrphan).toBe(true);
      const document = await getDocument("ti", "backup");
      expect(document.isOrphan).toBe(true);
    });
  });
});
