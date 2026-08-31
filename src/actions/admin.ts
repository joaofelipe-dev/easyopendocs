"use server";

import fs from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";

import {
  DEPARTMENT_META_FILE,
  departmentDir,
  isValidSlug,
  slugify,
} from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { actionError, actionSuccess, type ActionState } from "@/lib/action-state";
import { TUTORIAL_DOCUMENT_SLUG, buildTutorialDocument } from "@/lib/tutorial-content";

const BCRYPT_ROUNDS = 10;

function revalidateAdmin() {
  revalidatePath("/", "layout");
}

function describeError(error: unknown, fallback: string): ActionState {
  console.error("[admin]", error);
  return actionError(fallback);
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

const userSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O usuário precisa ter pelo menos 3 caracteres.")
    .max(60)
    .regex(/^\S+$/, "O usuário não pode conter espaços."),
  isSuperAdmin: z.boolean(),
  isActive: z.boolean(),
});

const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(200);

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = userSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    isSuperAdmin: formData.get("isSuperAdmin") === "on",
    isActive: formData.get("isActive") !== "off",
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) {
    return actionError(password.error.issues[0]?.message ?? "Senha inválida.");
  }

  // Sem privilégio de admin geral, o usuário só enxerga o que herda de um
  // departamento — sem nenhum, ele entraria e veria a home vazia para sempre.
  const departmentIds = [...new Set(formData.getAll("departmentIds").map(String))].filter(
    Boolean,
  );
  const defaultRoleId = String(formData.get("defaultRoleId") ?? "");

  if (!parsed.data.isSuperAdmin) {
    if (departmentIds.length === 0) {
      return actionError(
        "Selecione ao menos um departamento — sem isso o usuário não consegue acessar nada no portal.",
      );
    }
    if (!defaultRoleId) {
      return actionError("Selecione o papel padrão para os departamentos escolhidos.");
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return actionError("Já existe um usuário com este nome de usuário.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...parsed.data,
          passwordHash: await hash(password.data, BCRYPT_ROUNDS),
        },
      });

      if (!parsed.data.isSuperAdmin) {
        await tx.userDepartmentRole.createMany({
          data: departmentIds.map((departmentId) => ({
            userId: user.id,
            departmentId,
            roleId: defaultRoleId,
          })),
          skipDuplicates: true,
        });
      }
    });
  } catch (error) {
    return describeError(error, "Não foi possível criar o usuário.");
  }

  revalidateAdmin();
  return actionSuccess(`Usuário ${parsed.data.name} criado.`);
}

// Senha inicial de todo usuário criado em massa — o próprio usuário troca no
// primeiro acesso (ver mustChangePassword e /trocar-senha).
const BULK_DEFAULT_PASSWORD = "mudeasenha";

const bulkLineSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(60)
    .regex(/^\S+$/),
});

export async function bulkCreateUsersAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const rawLines = String(formData.get("lines") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return actionError("Cole ao menos uma linha no formato Nome;usuario.");
  }

  const departmentIds = [...new Set(formData.getAll("departmentIds").map(String))].filter(
    Boolean,
  );
  const defaultRoleId = String(formData.get("defaultRoleId") ?? "");

  if (departmentIds.length === 0) {
    return actionError(
      "Selecione ao menos um departamento — sem isso os usuários não conseguem acessar nada no portal.",
    );
  }
  if (!defaultRoleId) {
    return actionError("Selecione o papel padrão para os departamentos escolhidos.");
  }

  const parsedLines: { name: string; email: string }[] = [];
  const invalid: string[] = [];
  const seenInBatch = new Set<string>();
  const duplicatesInBatch: string[] = [];

  for (const rawLine of rawLines) {
    const [rawName, rawEmail] = rawLine.split(";");
    const parsed = bulkLineSchema.safeParse({
      name: rawName ?? "",
      email: rawEmail ?? "",
    });

    if (!parsed.success) {
      invalid.push(rawLine);
      continue;
    }

    if (seenInBatch.has(parsed.data.email)) {
      duplicatesInBatch.push(parsed.data.email);
      continue;
    }
    seenInBatch.add(parsed.data.email);
    parsedLines.push(parsed.data);
  }

  if (parsedLines.length === 0) {
    return actionError(
      "Nenhuma linha válida. Use o formato Nome completo;usuario, uma por linha.",
    );
  }

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: parsedLines.map((line) => line.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existingUsers.map((user) => user.email));

  const toCreate = parsedLines.filter((line) => !existingEmails.has(line.email));
  const alreadyExists = parsedLines
    .filter((line) => existingEmails.has(line.email))
    .map((line) => line.email);

  const passwordHash = await hash(BULK_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const failed: string[] = [];
  let created = 0;

  for (const line of toCreate) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: line.name,
            email: line.email,
            passwordHash,
            isSuperAdmin: false,
            isActive: true,
            mustChangePassword: true,
          },
        });

        await tx.userDepartmentRole.createMany({
          data: departmentIds.map((departmentId) => ({
            userId: user.id,
            departmentId,
            roleId: defaultRoleId,
          })),
          skipDuplicates: true,
        });
      });
      created += 1;
    } catch (error) {
      console.error("[bulkCreateUsersAction]", line.email, error);
      failed.push(line.email);
    }
  }

  revalidateAdmin();

  const problems = [
    invalid.length ? `${invalid.length} linha(s) em formato inválido` : null,
    duplicatesInBatch.length ? `${duplicatesInBatch.length} duplicada(s) na lista` : null,
    alreadyExists.length
      ? `${alreadyExists.length} já existente(s): ${alreadyExists.join(", ")}`
      : null,
    failed.length ? `${failed.length} falharam ao salvar: ${failed.join(", ")}` : null,
  ].filter(Boolean);

  const summary = `${created} usuário(s) criado(s) com a senha padrão "${BULK_DEFAULT_PASSWORD}".`;
  const message = problems.length ? `${summary} Ignorados: ${problems.join("; ")}.` : summary;

  return created > 0 ? actionSuccess(message) : actionError(message);
}

export async function updateUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");

  const parsed = userSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    isSuperAdmin: formData.get("isSuperAdmin") === "on",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  // Sem isto, o único admin do portal consegue se trancar do lado de fora.
  if (userId === admin.id && (!parsed.data.isSuperAdmin || !parsed.data.isActive)) {
    return actionError(
      "Você não pode remover o próprio acesso de administrador nem se desativar.",
    );
  }

  // Um usuário comum sem nenhum departamento não acessa nada — se está
  // deixando de ser admin geral, precisa já ter (ou ganhar) um departamento.
  if (!parsed.data.isSuperAdmin) {
    const departmentCount = await prisma.userDepartmentRole.count({ where: { userId } });
    if (departmentCount === 0) {
      return actionError(
        "Este usuário não tem nenhum departamento atribuído. Dê acesso a pelo menos um antes de remover o privilégio de administrador geral.",
      );
    }
  }

  const emailOwner = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (emailOwner && emailOwner.id !== userId) {
    return actionError("Já existe outro usuário com este nome de usuário.");
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: parsed.data });
  } catch (error) {
    return describeError(error, "Não foi possível salvar o usuário.");
  }

  revalidateAdmin();
  return actionSuccess("Usuário atualizado.");
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "");
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));

  if (!password.success) {
    return actionError(password.error.issues[0]?.message ?? "Senha inválida.");
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(password.data, BCRYPT_ROUNDS) },
    });
  } catch (error) {
    return describeError(error, "Não foi possível redefinir a senha.");
  }

  revalidateAdmin();
  return actionSuccess("Senha redefinida. Informe a nova senha ao usuário.");
}

/**
 * Exclusão definitiva do usuário — diferente de desativar, não dá pra
 * desfazer. Documentos que ele criou continuam publicados (createdBy vira
 * null); acessos por departamento somem junto (cascade).
 */
export async function deleteUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");

  if (userId === admin.id) {
    return actionError("Você não pode excluir a si mesmo.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return actionError("Usuário não encontrado.");

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    return describeError(error, "Não foi possível excluir o usuário.");
  }

  revalidateAdmin();
  return actionSuccess(`${user.name} foi excluído permanentemente.`);
}

export async function toggleUserActiveAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");

  if (userId === admin.id) {
    return actionError("Você não pode desativar o próprio usuário.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, name: true },
  });
  if (!user) return actionError("Usuário não encontrado.");

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidateAdmin();
  return actionSuccess(
    user.isActive
      ? `${user.name} foi desativado e não consegue mais entrar.`
      : `${user.name} foi reativado.`,
  );
}

// ---------------------------------------------------------------------------
// Atribuição de papéis por departamento
// ---------------------------------------------------------------------------

export async function assignRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");

  if (!userId || !departmentId || !roleId) {
    return actionError("Selecione o departamento e o papel.");
  }

  try {
    await prisma.userDepartmentRole.create({ data: { userId, departmentId, roleId } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return actionError("Este usuário já tem esse papel neste departamento.");
    }
    return describeError(error, "Não foi possível atribuir o papel.");
  }

  revalidateAdmin();
  return actionSuccess("Papel atribuído.");
}

export async function removeRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const assignment = await prisma.userDepartmentRole.findUnique({
    where: { id: assignmentId },
    select: { userId: true, user: { select: { isSuperAdmin: true, name: true } } },
  });
  if (!assignment) return actionError("Atribuição não encontrada.");

  // Um usuário comum precisa manter ao menos um departamento — sem isso ele
  // vira uma conta que entra mas não vê nada, sem forma de se recuperar
  // sozinha.
  if (!assignment.user.isSuperAdmin) {
    const total = await prisma.userDepartmentRole.count({
      where: { userId: assignment.userId },
    });
    if (total <= 1) {
      return actionError(
        `Este é o único departamento de ${assignment.user.name}. Atribua outro antes de remover este, ou torne-o administrador geral.`,
      );
    }
  }

  try {
    await prisma.userDepartmentRole.delete({ where: { id: assignmentId } });
  } catch (error) {
    return describeError(error, "Não foi possível remover o papel.");
  }

  revalidateAdmin();
  return actionSuccess("Papel removido.");
}

// ---------------------------------------------------------------------------
// Departamentos
//
// Departamento é uma pasta no disco: criar aqui cria a pasta, editar reescreve
// o _departamento.json. O banco é sempre reconciliado pelo sync depois.
// ---------------------------------------------------------------------------

const departmentSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do departamento.").max(120),
  description: z.string().trim().max(300).optional(),
});

async function writeDepartmentMeta(
  slug: string,
  name: string,
  description: string | undefined,
): Promise<void> {
  const meta = { name, ...(description ? { description } : {}) };
  await fs.writeFile(
    path.join(departmentDir(slug), DEPARTMENT_META_FILE),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
}

export async function createDepartmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = departmentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = rawSlug ? slugify(rawSlug) : slugify(parsed.data.name);

  if (!isValidSlug(slug)) {
    return actionError("O nome precisa gerar um slug válido (letras ou números).");
  }

  const dir = departmentDir(slug);

  try {
    // Falha se a pasta já existir, para não sequestrar um departamento existente.
    await fs.mkdir(dir, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return actionError(`A pasta "${slug}" já existe em content/departamentos/.`);
    }
    return describeError(error, "Não foi possível criar a pasta do departamento.");
  }

  try {
    await writeDepartmentMeta(slug, parsed.data.name, parsed.data.description);
  } catch (error) {
    return describeError(error, "Pasta criada, mas os metadados falharam.");
  }

  // Todo departamento nasce com o tutorial de como documentar — ninguém deve
  // ficar sem saber como publicar. "wx" para nunca sobrescrever se já existir.
  try {
    await fs.writeFile(
      path.join(dir, `${TUTORIAL_DOCUMENT_SLUG}.html`),
      buildTutorialDocument(),
      { flag: "wx", encoding: "utf8" },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      console.error("[createDepartmentAction] falha ao gravar tutorial:", error);
    }
  }

  await syncContent({ trigger: "MANUAL", force: true });
  revalidateAdmin();
  return actionSuccess(`Departamento "${parsed.data.name}" criado em ${slug}/.`);
}

export async function updateDepartmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const slug = String(formData.get("slug") ?? "");
  if (!isValidSlug(slug)) return actionError("Departamento inválido.");

  const parsed = departmentSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  try {
    await writeDepartmentMeta(slug, parsed.data.name, parsed.data.description);
  } catch (error) {
    return describeError(error, "Não foi possível gravar os metadados.");
  }

  await syncContent({ trigger: "MANUAL", force: true });
  revalidateAdmin();
  return actionSuccess("Departamento atualizado.");
}

/**
 * Exclusão definitiva de um departamento ativo: apaga a pasta inteira do
 * disco (todas as documentações dentro dela) e o registro no banco, cujo
 * cascade também remove documentos e atribuições de papel associadas.
 * Usuários que só tinham acesso a este departamento ficam sem nenhum —
 * quem confirma esta ação já foi avisado disso na tela.
 */
export async function deleteDepartmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();
  const departmentId = String(formData.get("departmentId") ?? "");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, slug: true, name: true, isOrphan: true },
  });
  if (!department) return actionError("Departamento não encontrado.");

  if (!department.isOrphan) {
    try {
      await fs.rm(departmentDir(department.slug), { recursive: true, force: true });
    } catch (error) {
      return describeError(error, "Não foi possível remover a pasta do departamento.");
    }
  }

  try {
    await prisma.department.delete({ where: { id: departmentId } });
  } catch (error) {
    return describeError(error, "Não foi possível remover o departamento.");
  }

  revalidateAdmin();
  return actionSuccess(
    `Departamento "${department.name}" e toda a sua documentação foram excluídos.`,
  );
}

/**
 * Remove do banco um departamento cuja pasta já não existe. Só órfãos: apagar
 * um departamento ativo apagaria conteúdo real do disco, e isso é uma decisão
 * que fica com quem administra o filesystem.
 */
export async function purgeOrphanDepartmentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();
  const departmentId = String(formData.get("departmentId") ?? "");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { isOrphan: true, name: true },
  });

  if (!department) return actionError("Departamento não encontrado.");
  if (!department.isOrphan) {
    return actionError(
      "Este departamento ainda existe no disco. Remova a pasta primeiro.",
    );
  }

  try {
    await prisma.department.delete({ where: { id: departmentId } });
  } catch (error) {
    return describeError(error, "Não foi possível remover o registro.");
  }

  revalidateAdmin();
  return actionSuccess(
    `Registro de "${department.name}" removido, junto com suas permissões.`,
  );
}

// ---------------------------------------------------------------------------
// Papéis e permissões
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do papel.").max(60),
  description: z.string().trim().max(200).optional(),
});

export async function createRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = roleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const permissionIds = formData.getAll("permissionIds").map(String);

  try {
    await prisma.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return actionError("Já existe um papel com este nome.");
    }
    return describeError(error, "Não foi possível criar o papel.");
  }

  revalidateAdmin();
  return actionSuccess(`Papel "${parsed.data.name}" criado.`);
}

export async function updateRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const roleId = String(formData.get("roleId") ?? "");
  const parsed = roleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const permissionIds = formData.getAll("permissionIds").map(String);

  try {
    // Substitui o conjunto inteiro: o formulário envia o estado final desejado.
    await prisma.$transaction([
      prisma.role.update({
        where: { id: roleId },
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
        },
      }),
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return actionError("Já existe um papel com este nome.");
    }
    return describeError(error, "Não foi possível salvar o papel.");
  }

  revalidateAdmin();
  return actionSuccess("Papel atualizado.");
}

export async function deleteRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();
  const roleId = String(formData.get("roleId") ?? "");

  const assignments = await prisma.userDepartmentRole.count({ where: { roleId } });
  if (assignments > 0) {
    return actionError(
      `Este papel está atribuído a ${assignments} usuário(s). Remova as atribuições antes de excluir.`,
    );
  }

  try {
    await prisma.role.delete({ where: { id: roleId } });
  } catch (error) {
    return describeError(error, "Não foi possível excluir o papel.");
  }

  revalidateAdmin();
  return actionSuccess("Papel excluído.");
}

const permissionSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/,
      'Use o formato "recurso:acao", ex: document:read.',
    ),
  description: z.string().trim().max(200).optional(),
});

export async function createPermissionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = permissionSchema.safeParse({
    key: String(formData.get("key") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  try {
    await prisma.permission.create({
      data: { key: parsed.data.key, description: parsed.data.description || null },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return actionError("Esta permissão já existe.");
    }
    return describeError(error, "Não foi possível criar a permissão.");
  }

  revalidateAdmin();
  return actionSuccess(`Permissão "${parsed.data.key}" criada.`);
}

export async function deletePermissionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();
  const permissionId = String(formData.get("permissionId") ?? "");

  try {
    await prisma.permission.delete({ where: { id: permissionId } });
  } catch (error) {
    return describeError(error, "Não foi possível excluir a permissão.");
  }

  revalidateAdmin();
  return actionSuccess("Permissão excluída de todos os papéis.");
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

export async function triggerSyncAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const force = formData.get("force") === "1";
  const result = await syncContent({ trigger: "MANUAL", force });

  revalidateAdmin();

  if (!result.ok) {
    return actionError(result.error ?? "A sincronização falhou.");
  }

  return actionSuccess(
    `Sync concluído em ${result.durationMs} ms — ` +
      `${result.documentsCreated} criado(s), ${result.documentsUpdated} atualizado(s), ` +
      `${result.documentsSkipped} inalterado(s), ${result.documentsOrphaned} órfão(s).`,
  );
}
