import fs from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { contentRoot } from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, type CurrentUser } from "@/lib/rbac";
import { assignRole, seedPermissionsAndRoles, upsertUser } from "@/lib/rbac-seed";
import { searchDocuments } from "@/lib/search";
import { SEARCH_INDEX_VERSION } from "@/lib/search-index";

/**
 * Busca full-text de ponta a ponta: arquivo real no disco -> sync real ->
 * tsvector real no Postgres -> consulta real. O índice mora no banco e a
 * configuração `pt_unaccent` vem de uma migration, então mockar qualquer uma
 * das pontas testaria uma busca que não é a que roda em produção.
 */

async function writeDocument(
  departmentSlug: string,
  documentSlug: string,
  options: { title: string; description?: string; body?: string },
): Promise<void> {
  const dir = path.join(contentRoot(), departmentSlug);
  await fs.mkdir(dir, { recursive: true });

  const lines = [`<!-- title: ${options.title} -->`];
  if (options.description) lines.push(`<!-- description: ${options.description} -->`);
  lines.push(`<article>${options.body ?? "<p>conteúdo</p>"}</article>`, "");

  await fs.writeFile(path.join(dir, `${documentSlug}.html`), lines.join("\n"), "utf8");
}

async function createUser(
  overrides: Partial<{ isSuperAdmin: boolean }> = {},
): Promise<CurrentUser> {
  const email = `teste-${Math.random().toString(36).slice(2)}@exemplo.com`;
  const id = await upsertUser({
    name: "Usuário de teste",
    email,
    password: "senha-qualquer",
    isSuperAdmin: overrides.isSuperAdmin ?? false,
  });

  return {
    id,
    name: "Usuário de teste",
    email,
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    mustChangePassword: false,
  };
}

describe("searchDocuments", () => {
  // Mesmo motivo do content-sync.test.ts: o CONTENT_ROOT é um só para o
  // arquivo de teste inteiro, então arquivo escrito por um teste seria
  // redescoberto pelo sync do teste seguinte. Ver tests/README.md.
  beforeEach(async () => {
    await fs.rm(contentRoot(), { recursive: true, force: true });
    await fs.mkdir(contentRoot(), { recursive: true });
  });

  it("encontra por uma palavra que só existe no corpo do documento", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>O restore é testado com pg_restore toda segunda-feira.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });
    const results = await searchDocuments(user, "restore");

    expect(results).toHaveLength(1);
    expect(results[0].documentSlug).toBe("backup");
    expect(results[0].departmentSlug).toBe("ti");
  });

  it("encontra sem acento o que foi escrito com acento", async () => {
    await writeDocument("ti", "manutencao", {
      title: "Manutenção programada",
      body: "<p>Janela mensal de manutenção dos servidores.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });

    expect(await searchDocuments(user, "manutencao")).toHaveLength(1);
    expect(await searchDocuments(user, "manutenção")).toHaveLength(1);
  });

  it("destaca o termo encontrado com <mark> no trecho", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>O restore é testado com pg_restore toda segunda-feira.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });
    const [result] = await searchDocuments(user, "restore");

    expect(result.snippetHtml).toContain("<mark>");
    expect(result.snippetHtml.toLowerCase()).toContain("restore");
  });

  it("não devolve documento de departamento em que o usuário não pode ler", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await writeDocument("rh", "ferias", {
      title: "Política de férias",
      body: "<p>Como solicitar backup de dias de férias.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const roleIdByName = await seedPermissionsAndRoles();
    const user = await createUser();
    await assignRole(user.id, "ti", roleIdByName.get("Viewer")!);

    const results = await searchDocuments(user, "backup");

    expect(results.map((r) => r.departmentSlug)).toEqual(["ti"]);
  });

  it("ignora papel que não concede document:read", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    // Um papel sem permissão nenhuma: ter vínculo com o departamento não pode
    // bastar, porque o resultado já revela título e trecho do documento.
    const semLeitura = await prisma.role.create({ data: { name: "Sem leitura" } });
    const user = await createUser();
    await assignRole(user.id, "ti", semLeitura.id);

    expect(await searchDocuments(user, "backup")).toHaveLength(0);
  });

  it("não devolve documento órfão", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    await fs.rm(path.join(contentRoot(), "ti", "backup.html"));
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });
    expect(await searchDocuments(user, "backup")).toHaveLength(0);
  });

  it("restringe ao departamento pedido", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await writeDocument("rh", "ferias", {
      title: "Férias",
      body: "<p>Backup de dias de férias.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });

    expect(await searchDocuments(user, "backup")).toHaveLength(2);

    const soRh = await searchDocuments(user, "backup", { departmentSlug: "rh" });
    expect(soRh.map((r) => r.documentSlug)).toEqual(["ferias"]);
  });

  it("ranqueia acerto no título acima de acerto no corpo", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>Roda todo dia às duas da manhã.</p>",
    });
    await writeDocument("ti", "onboarding", {
      title: "Onboarding de infraestrutura",
      body: "<p>Peça acesso ao servidor de backup no primeiro dia.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });
    const results = await searchDocuments(user, "backup");

    expect(results.map((r) => r.documentSlug)).toEqual(["backup", "onboarding"]);
  });

  it("não indexa conteúdo que o sanitizador remove", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>visível</p><script>palavraescondida</script>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });

    expect(await searchDocuments(user, "palavraescondida")).toHaveLength(0);
    expect(await searchDocuments(user, "visível")).toHaveLength(1);
  });

  it("não junta palavras de blocos vizinhos", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>alfa</p><p>beta</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });

    expect(await searchDocuments(user, "alfabeta")).toHaveLength(0);
    expect(await searchDocuments(user, "alfa")).toHaveLength(1);
    expect(await searchDocuments(user, "beta")).toHaveLength(1);
  });

  it("reindexa sozinho o documento cuja versão de índice ficou para trás", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>O restore roda toda segunda.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    // Simula o estado de quem já tinha o portal rodando antes da busca
    // existir: linha indexada, vetor vazio, versão antiga. Sem o backfill
    // automático, esse documento ficaria invisível para sempre.
    await prisma.$executeRaw`
      UPDATE "Document"
         SET "searchVector" = NULL, "plainText" = '', "searchVersion" = 0
    `;

    const user = await createUser({ isSuperAdmin: true });
    expect(await searchDocuments(user, "restore")).toHaveLength(0);

    // Sem `force`: é justamente o atalho barato do sync que precisa notar.
    await syncContent({ trigger: "AUTOMATIC" });

    expect(await searchDocuments(user, "restore")).toHaveLength(1);

    const document = await prisma.document.findFirstOrThrow({
      where: { slug: "backup" },
      select: { searchVersion: true, plainText: true },
    });
    expect(document.searchVersion).toBe(SEARCH_INDEX_VERSION);
    expect(document.plainText).toContain("restore");
  });

  it("devolve vazio para busca em branco, sem consultar o banco", async () => {
    const user = await createUser({ isSuperAdmin: true });
    expect(await searchDocuments(user, "   ")).toEqual([]);
  });

  it("não quebra com entrada que não vira consulta nenhuma", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });
    expect(await searchDocuments(user, "!!! ???")).toEqual([]);
  });

  it("aceita a sintaxe de frase exata do websearch", async () => {
    await writeDocument("ti", "backup", {
      title: "Rotina de backup",
      body: "<p>O teste de restore roda toda segunda.</p>",
    });
    await writeDocument("ti", "restore", {
      title: "Restore manual",
      body: "<p>Um teste qualquer, e um restore qualquer, sem ordem entre eles.</p>",
    });
    await syncContent({ trigger: "MANUAL", force: true });

    const user = await createUser({ isSuperAdmin: true });
    const results = await searchDocuments(user, '"teste de restore"');

    expect(results.map((r) => r.documentSlug)).toEqual(["backup"]);
  });
});

describe("searchDocuments — permissões", () => {
  beforeEach(async () => {
    await fs.rm(contentRoot(), { recursive: true, force: true });
    await fs.mkdir(contentRoot(), { recursive: true });
  });

  it("super admin busca em todos os departamentos sem papel nenhum", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await writeDocument("rh", "backup-rh", { title: "Backup de documentos de RH" });
    await syncContent({ trigger: "MANUAL", force: true });

    const admin = await createUser({ isSuperAdmin: true });
    const results = await searchDocuments(admin, "backup");

    expect(results).toHaveLength(2);
  });

  it("perder o papel tira o documento do resultado no request seguinte", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const roleIdByName = await seedPermissionsAndRoles();
    const user = await createUser();
    await assignRole(user.id, "ti", roleIdByName.get("Viewer")!);

    expect(await searchDocuments(user, "backup")).toHaveLength(1);

    await prisma.userDepartmentRole.deleteMany({ where: { userId: user.id } });

    expect(await searchDocuments(user, "backup")).toHaveLength(0);
  });

  it("Editor tem document:read e portanto enxerga a busca", async () => {
    await writeDocument("ti", "backup", { title: "Rotina de backup" });
    await syncContent({ trigger: "MANUAL", force: true });

    const roleIdByName = await seedPermissionsAndRoles();
    const user = await createUser();
    await assignRole(user.id, "ti", roleIdByName.get("Editor")!);

    // Guarda contra alguém tirar document:read do Editor no catálogo sem
    // perceber que a busca depende dessa permissão, não do vínculo.
    expect(PERMISSIONS.documentRead).toBe("document:read");
    expect(await searchDocuments(user, "backup")).toHaveLength(1);
  });
});
