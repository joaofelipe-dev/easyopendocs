"use server";

import fs from "node:fs/promises";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  departmentDir,
  documentFile,
  hashContent,
  isValidSlug,
  renderDocumentFile,
  slugify,
  toRelativePath,
} from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { claimDocumentVersion, getDocumentVersion } from "@/lib/document-version";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, getCurrentUser, requireDepartmentAccess } from "@/lib/rbac";
import { sanitizeDocumentHtml } from "@/lib/sanitize";
import { actionError, type ActionState } from "@/lib/action-state";

// Arquivo "use server": só pode exportar funções async (tipos são apagados na
// compilação, então `export type` é permitido).
export type DocumentFormState = {
  error: string | null;
  fieldErrors?: Partial<Record<"title" | "description" | "bodyHtml", string>>;
};

/**
 * Segmentos estáticos das rotas de departamento. Um documento com um desses
 * slugs existiria no disco mas nunca seria alcançável pela URL. "diagrama"
 * ainda não é rota — fica reservado para a tela de setas que virá depois.
 */
const RESERVED_SLUGS = new Set([
  "nova-documentacao",
  "editar",
  "responsabilidades",
  "diagrama",
  "api",
]);

const documentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "O título precisa de pelo menos 3 caracteres.")
    .max(160, "O título pode ter no máximo 160 caracteres."),
  description: z
    .string()
    .trim()
    .max(300, "A descrição pode ter no máximo 300 caracteres.")
    .optional(),
  bodyHtml: z.string().trim().min(1, "O conteúdo não pode ficar vazio."),
});

function parseForm(formData: FormData) {
  return documentSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    bodyHtml: String(formData.get("bodyHtml") ?? ""),
  });
}

function toFieldErrors(
  issues: z.ZodIssue[],
): DocumentFormState["fieldErrors"] {
  const fieldErrors: DocumentFormState["fieldErrors"] = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field === "title" || field === "description" || field === "bodyHtml") {
      fieldErrors[field] ??= issue.message;
    }
  }
  return fieldErrors;
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export async function createDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const departmentSlug = String(formData.get("departmentSlug") ?? "");

  if (!isValidSlug(departmentSlug)) {
    return { error: "Departamento inválido." };
  }

  const { user, access } = await requireDepartmentAccess(
    departmentSlug,
    PERMISSIONS.documentCreate,
  );

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      error: "Corrija os campos destacados.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const { title, description, bodyHtml } = parsed.data;
  const documentSlug = slugify(title);

  if (!isValidSlug(documentSlug)) {
    return {
      error: null,
      fieldErrors: {
        title: "O título precisa conter ao menos uma letra ou número.",
      },
    };
  }

  if (RESERVED_SLUGS.has(documentSlug)) {
    return {
      error: null,
      fieldErrors: { title: `"${documentSlug}" é um nome reservado pelo sistema.` },
    };
  }

  const filePath = documentFile(departmentSlug, documentSlug);

  // Grava sanitizado: o arquivo no disco fica idêntico ao que é renderizado.
  const fileContents = renderDocumentFile({
    title,
    description: description || null,
    bodyHtml: sanitizeDocumentHtml(bodyHtml),
    author: user.name,
  });

  try {
    await fs.mkdir(departmentDir(departmentSlug), { recursive: true });
    // wx falha se o arquivo já existir — evita sobrescrever doc de outra pessoa
    // por colisão de slug.
    await fs.writeFile(filePath, fileContents, { flag: "wx", encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return {
        error: null,
        fieldErrors: {
          title: `Já existe uma documentação com este título (${documentSlug}.html). Escolha outro.`,
        },
      };
    }
    console.error("[createDocumentAction] falha ao gravar arquivo:", error);
    return { error: "Não foi possível gravar o arquivo. Verifique as permissões da pasta." };
  }

  // Indexa imediatamente para que a doc apareça já na próxima renderização.
  await syncContent({ trigger: "DOCUMENT_CREATE", force: true });

  await prisma.document.updateMany({
    where: { filePath: toRelativePath(filePath), createdById: null },
    data: { createdById: user.id },
  });

  // O sync acabou de gravar a v1 como "alterada no filesystem", que é tudo o
  // que ele sabe. Aqui a versão ganha autor e origem.
  const created = await prisma.document.findUnique({
    where: { filePath: toRelativePath(filePath) },
    select: { id: true },
  });
  if (created) {
    await claimDocumentVersion({
      documentId: created.id,
      contentHash: hashContent(fileContents),
      source: "UI_CREATE",
      authorId: user.id,
    });
  }

  revalidatePath("/", "layout");
  redirect(`/departamentos/${access.department.slug}/${documentSlug}`);
}

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

export async function updateDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const departmentSlug = String(formData.get("departmentSlug") ?? "");
  const documentSlug = String(formData.get("documentSlug") ?? "");

  if (!isValidSlug(departmentSlug) || !isValidSlug(documentSlug)) {
    return { error: "Documento inválido." };
  }

  const { user, access } = await requireDepartmentAccess(
    departmentSlug,
    PERMISSIONS.documentEdit,
  );

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      error: "Corrija os campos destacados.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const existing = await prisma.document.findUnique({
    where: {
      departmentId_slug: { departmentId: access.department.id, slug: documentSlug },
    },
  });

  if (!existing || existing.isOrphan) {
    return { error: "Esta documentação não existe mais." };
  }

  const { title, description, bodyHtml } = parsed.data;

  // O nome do arquivo (e portanto a URL) não muda ao editar: renomear quebraria
  // todo link já compartilhado. Só o front-matter `title` é atualizado.
  const fileContents = renderDocumentFile({
    title,
    description: description || null,
    bodyHtml: sanitizeDocumentHtml(bodyHtml),
    author: user.name,
    createdAt: existing.createdAt,
  });

  try {
    await fs.writeFile(documentFile(departmentSlug, documentSlug), fileContents, "utf8");
  } catch (error) {
    console.error("[updateDocumentAction] falha ao gravar arquivo:", error);
    return { error: "Não foi possível gravar o arquivo. Verifique as permissões da pasta." };
  }

  await syncContent({ trigger: "DOCUMENT_CREATE", force: true });

  await claimDocumentVersion({
    documentId: existing.id,
    contentHash: hashContent(fileContents),
    source: "UI_EDIT",
    authorId: user.id,
  });

  revalidatePath("/", "layout");
  redirect(`/departamentos/${access.department.slug}/${documentSlug}`);
}

// ---------------------------------------------------------------------------
// Exclusão
// ---------------------------------------------------------------------------

/**
 * Exclusão definitiva: remove o arquivo do disco e o registro do banco na
 * hora — diferente do que acontece quando um arquivo some por fora do
 * portal, aqui não faz sentido deixar um órfão para trás.
 */
export async function deleteDocumentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const departmentSlug = String(formData.get("departmentSlug") ?? "");
  const documentSlug = String(formData.get("documentSlug") ?? "");

  if (!isValidSlug(departmentSlug) || !isValidSlug(documentSlug)) {
    return actionError("Documento inválido.");
  }

  const { access } = await requireDepartmentAccess(
    departmentSlug,
    PERMISSIONS.documentDelete,
  );

  const existing = await prisma.document.findUnique({
    where: {
      departmentId_slug: { departmentId: access.department.id, slug: documentSlug },
    },
  });
  if (!existing) return actionError("Esta documentação não existe mais.");

  try {
    await fs.unlink(documentFile(departmentSlug, documentSlug));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[deleteDocumentAction] falha ao remover arquivo:", error);
      return actionError("Não foi possível remover o arquivo do disco.");
    }
  }

  await prisma.document.delete({ where: { id: existing.id } });

  revalidatePath("/", "layout");
  redirect(`/departamentos/${access.department.slug}`);
}

// ---------------------------------------------------------------------------
// Restauração de versão
// ---------------------------------------------------------------------------

/**
 * Restaurar não desfaz: reescreve o arquivo com o conteúdo da versão antiga e
 * deixa o sync gravar isso como uma versão NOVA. O histórico só cresce — o que
 * estava publicado antes da restauração continua recuperável, e é justamente
 * quem restaurou por engano que mais vai precisar disso.
 */
export async function restoreDocumentVersionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const departmentSlug = String(formData.get("departmentSlug") ?? "");
  const documentSlug = String(formData.get("documentSlug") ?? "");
  const version = Number(formData.get("version"));

  if (!isValidSlug(departmentSlug) || !isValidSlug(documentSlug)) {
    return actionError("Documento inválido.");
  }
  if (!Number.isInteger(version) || version < 1) {
    return actionError("Versão inválida.");
  }

  const { user, access } = await requireDepartmentAccess(
    departmentSlug,
    PERMISSIONS.documentEdit,
  );

  const existing = await prisma.document.findUnique({
    where: {
      departmentId_slug: { departmentId: access.department.id, slug: documentSlug },
    },
  });

  if (!existing || existing.isOrphan) {
    return actionError("Esta documentação não existe mais.");
  }

  const snapshot = await getDocumentVersion(existing.id, version);
  if (!snapshot) return actionError("Esta versão não existe mais no histórico.");

  if (snapshot.contentHash === existing.contentHash) {
    return actionError("Esta já é a versão publicada — não há o que restaurar.");
  }

  try {
    // Grava o arquivo byte a byte como estava, front-matter incluído: é para
    // isso que o snapshot guarda o arquivo inteiro, e não só o corpo.
    await fs.writeFile(
      documentFile(departmentSlug, documentSlug),
      snapshot.rawHtml,
      "utf8",
    );
  } catch (error) {
    console.error("[restoreDocumentVersionAction] falha ao gravar arquivo:", error);
    return actionError(
      "Não foi possível gravar o arquivo. Verifique as permissões da pasta.",
    );
  }

  await syncContent({ trigger: "DOCUMENT_CREATE", force: true });

  await claimDocumentVersion({
    documentId: existing.id,
    contentHash: snapshot.contentHash,
    source: "RESTORE",
    authorId: user.id,
  });

  revalidatePath("/", "layout");
  redirect(`/departamentos/${access.department.slug}/${documentSlug}`);
}

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

/**
 * A prévia passa pelo mesmo sanitizador da renderização final, então o autor vê
 * exatamente o que será publicado — inclusive o que foi removido.
 */
export async function previewDocumentAction(bodyHtml: string): Promise<string> {
  // Server action é um endpoint público; não há motivo para responder a quem
  // não está autenticado.
  const user = await getCurrentUser();
  if (!user) return "";

  return sanitizeDocumentHtml(bodyHtml);
}
