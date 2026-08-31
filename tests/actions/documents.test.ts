import fs from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";
import { contentRoot } from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";
import { assignRole, seedPermissionsAndRoles, upsertUser } from "@/lib/rbac-seed";
import { createDocumentAction, type DocumentFormState } from "@/actions/documents";

/**
 * Teste de ponta a ponta de uma server action, contra banco e disco reais.
 * Só duas coisas são fakes aqui, e são fronteira de framework, não lógica da
 * aplicação:
 *
 *  - `auth()` (next-auth): decide QUEM está logado. Não dá pra montar uma
 *    sessão real fora de uma request HTTP, mas quem a ação realmente confia
 *    é em `getCurrentUser()` relendo o USUÁRIO no banco a partir do id que
 *    `auth()` devolveu — isso continua 100% real.
 *  - `revalidatePath` (next/cache): exige uma árvore de render ativa do App
 *    Router, que não existe aqui. É invalidação de cache, não regra de
 *    negócio — não há o que "provar" testando-a fora do Next.
 *
 * DB, filesystem, RBAC, sanitizador e o indexador são os mesmos módulos que
 * rodam em produção, sem substituição nenhuma.
 */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const DEPARTMENT_SLUG = "ti";

async function createDepartmentOnDisk(): Promise<void> {
  await fs.mkdir(path.join(contentRoot(), DEPARTMENT_SLUG), { recursive: true });
  const result = await syncContent({ trigger: "MANUAL", force: true });
  if (!result.ok) throw new Error(`setup do departamento falhou: ${result.error}`);
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  return formData;
}

const INITIAL_STATE: DocumentFormState = { error: null };

/** redirect() do Next lança um erro de controle de fluxo com esse formato. */
function expectRedirectTo(error: unknown, pathPrefix: string): void {
  expect(error).toHaveProperty("digest");
  const digest = (error as { digest: string }).digest;
  expect(digest.startsWith("NEXT_REDIRECT")).toBe(true);
  expect(digest).toContain(pathPrefix);
}

describe("createDocumentAction", () => {
  beforeEach(async () => {
    await fs.rm(contentRoot(), { recursive: true, force: true });
    await fs.mkdir(contentRoot(), { recursive: true });
    await createDepartmentOnDisk();
    await seedPermissionsAndRoles();
    vi.mocked(auth).mockReset();
  });

  it("Editor cria a documentação: sanitiza, grava no disco, indexa e redireciona", async () => {
    const editorId = await upsertUser({
      name: "Ana Editora",
      email: "ana@exemplo.com",
      password: "senha-qualquer",
    });
    const editorRole = await prisma.role.findUniqueOrThrow({ where: { name: "Editor" } });
    await assignRole(editorId, DEPARTMENT_SLUG, editorRole.id);
    vi.mocked(auth).mockResolvedValue({ user: { id: editorId } } as never);

    const formData = buildFormData({
      departmentSlug: DEPARTMENT_SLUG,
      title: "Rotina de backup",
      description: "Como e quando os backups rodam",
      bodyHtml: '<p>Texto normal.</p><script>alert(1)</script>',
    });

    const error = await createDocumentAction(INITIAL_STATE, formData).catch((e) => e);
    expectRedirectTo(error, `/departamentos/${DEPARTMENT_SLUG}/rotina-de-backup`);

    const filePath = path.join(contentRoot(), DEPARTMENT_SLUG, "rotina-de-backup.html");
    const written = await fs.readFile(filePath, "utf8");
    // A ação chama sanitizeDocumentHtml antes de gravar — o arquivo no disco
    // já sai sem o <script>, igual ao que seria renderizado.
    expect(written).not.toContain("<script");
    expect(written).toContain("Texto normal.");

    const department = await prisma.department.findUniqueOrThrow({
      where: { slug: DEPARTMENT_SLUG },
    });
    const document = await prisma.document.findUniqueOrThrow({
      where: {
        departmentId_slug: { departmentId: department.id, slug: "rotina-de-backup" },
      },
    });
    expect(document.title).toBe("Rotina de backup");
    expect(document.createdById).toBe(editorId);
  });

  it("Viewer é barrado antes de qualquer escrita — nem chega a tocar o disco", async () => {
    const viewerId = await upsertUser({
      name: "Vitor Viewer",
      email: "vitor@exemplo.com",
      password: "senha-qualquer",
    });
    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { name: "Viewer" } });
    await assignRole(viewerId, DEPARTMENT_SLUG, viewerRole.id);
    vi.mocked(auth).mockResolvedValue({ user: { id: viewerId } } as never);

    const formData = buildFormData({
      departmentSlug: DEPARTMENT_SLUG,
      title: "Não deveria existir",
      bodyHtml: "<p>x</p>",
    });

    const error = await createDocumentAction(INITIAL_STATE, formData).catch((e) => e);
    expectRedirectTo(error, "/sem-acesso");

    const documentCount = await prisma.document.count({
      where: { slug: "nao-deveria-existir" },
    });
    expect(documentCount).toBe(0);
    await expect(
      fs.access(path.join(contentRoot(), DEPARTMENT_SLUG, "nao-deveria-existir.html")),
    ).rejects.toThrow();
  });

  it("usuário desativado (isActive:false) é barrado mesmo com sessão válida", async () => {
    // Prova a garantia central do RBAC (README): a checagem relê o USUÁRIO no
    // banco a cada request, não confia só no que auth() devolveu.
    const userId = await upsertUser({
      name: "Foi Desligado",
      email: "desligado@exemplo.com",
      password: "senha-qualquer",
      isActive: false,
    });
    const editorRole = await prisma.role.findUniqueOrThrow({ where: { name: "Editor" } });
    await assignRole(userId, DEPARTMENT_SLUG, editorRole.id);
    vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never);

    const formData = buildFormData({
      departmentSlug: DEPARTMENT_SLUG,
      title: "Não deveria existir",
      bodyHtml: "<p>x</p>",
    });

    const error = await createDocumentAction(INITIAL_STATE, formData).catch((e) => e);
    // getCurrentUser() devolve null -> requireUser() manda para /login, não
    // para /sem-acesso (o usuário nem chega a ser reconhecido como sessão).
    expectRedirectTo(error, "/login");
  });
});
