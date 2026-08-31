"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidSlug } from "@/lib/content";
import { parseResponsibilities } from "@/lib/department-responsibilities";
import {
  deleteDepartmentResponsibilities,
  writeDepartmentResponsibilities,
} from "@/lib/department-responsibilities-file";
import { PERMISSIONS, requireDepartmentAccess } from "@/lib/rbac";
import { actionError, type ActionState } from "@/lib/action-state";

/**
 * O mapa é do departamento, não de um documento — por isso a permissão
 * exigida é `department:manage`, a mesma de quem cuida do departamento, e não
 * `document:edit`.
 */
export async function saveDepartmentResponsibilitiesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const departmentSlug = String(formData.get("departmentSlug") ?? "");
  if (!isValidSlug(departmentSlug)) return actionError("Departamento inválido.");

  const { access } = await requireDepartmentAccess(
    departmentSlug,
    PERMISSIONS.departmentManage,
  );

  let value: unknown;
  try {
    value = JSON.parse(String(formData.get("responsibilities") ?? ""));
  } catch {
    return actionError("Não foi possível ler os dados enviados.");
  }

  // Referências a documentos que não existem mais são preservadas de
  // propósito, no mesmo espírito dos órfãos do sync: o arquivo pode voltar
  // (git checkout, restore) e o vínculo volta com ele. A tela mostra essas
  // referências como quebradas em vez de apagá-las por conta.
  const parsed = parseResponsibilities(value);
  if (!parsed.ok) return actionError(parsed.error);

  try {
    await writeDepartmentResponsibilities(departmentSlug, parsed.responsibilities);
  } catch (error) {
    console.error(
      "[saveDepartmentResponsibilitiesAction] falha ao gravar arquivo:",
      error,
    );
    return actionError(
      "Não foi possível gravar o arquivo. Verifique as permissões da pasta.",
    );
  }

  revalidatePath("/", "layout");
  redirect(`/departamentos/${access.department.slug}/responsabilidades`);
}

export async function deleteDepartmentResponsibilitiesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const departmentSlug = String(formData.get("departmentSlug") ?? "");
  if (!isValidSlug(departmentSlug)) return actionError("Departamento inválido.");

  const { access } = await requireDepartmentAccess(
    departmentSlug,
    PERMISSIONS.departmentManage,
  );

  try {
    await deleteDepartmentResponsibilities(departmentSlug);
  } catch (error) {
    console.error(
      "[deleteDepartmentResponsibilitiesAction] falha ao remover arquivo:",
      error,
    );
    return actionError("Não foi possível remover o arquivo do disco.");
  }

  revalidatePath("/", "layout");
  redirect(`/departamentos/${access.department.slug}`);
}
