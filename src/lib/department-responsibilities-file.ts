import "server-only";

import fs from "node:fs/promises";

import {
  departmentDir,
  departmentResponsibilitiesFile,
  toRelativePath,
} from "@/lib/content";
import {
  parseResponsibilities,
  type DepartmentResponsibilities,
} from "@/lib/department-responsibilities";

/**
 * Leitura e escrita do `_responsabilidades.json`. Mesmo princípio do resto do
 * conteúdo: o arquivo no disco é a fonte de verdade — o portal não guarda
 * cópia no banco, então editar o arquivo à mão e editar pela tela são a mesma
 * coisa.
 */

export type ResponsibilitiesReadResult =
  | { status: "missing" }
  | { status: "invalid"; error: string }
  | {
      status: "ok";
      responsibilities: DepartmentResponsibilities;
      updatedAt: Date;
    };

export function responsibilitiesRelativePath(departmentSlug: string): string {
  return toRelativePath(departmentResponsibilitiesFile(departmentSlug));
}

export async function readDepartmentResponsibilities(
  departmentSlug: string,
): Promise<ResponsibilitiesReadResult> {
  const file = departmentResponsibilitiesFile(departmentSlug);

  let raw: string;
  let updatedAt: Date;

  try {
    const [contents, stats] = await Promise.all([
      fs.readFile(file, "utf8"),
      fs.stat(file),
    ]);
    raw = contents;
    updatedAt = stats.mtime;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };

    console.error("[department-responsibilities] falha ao ler o arquivo:", error);
    return { status: "invalid", error: "Não foi possível ler o arquivo." };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "invalid", error: "O arquivo não é um JSON válido." };
  }

  const parsed = parseResponsibilities(value);
  if (!parsed.ok) return { status: "invalid", error: parsed.error };

  return { status: "ok", responsibilities: parsed.responsibilities, updatedAt };
}

/** Só a existência, para a barra lateral não pagar leitura + parse. */
export async function departmentResponsibilitiesExist(
  departmentSlug: string,
): Promise<boolean> {
  try {
    await fs.access(departmentResponsibilitiesFile(departmentSlug));
    return true;
  } catch {
    return false;
  }
}

export async function writeDepartmentResponsibilities(
  departmentSlug: string,
  responsibilities: DepartmentResponsibilities,
): Promise<void> {
  await fs.mkdir(departmentDir(departmentSlug), { recursive: true });
  await fs.writeFile(
    departmentResponsibilitiesFile(departmentSlug),
    `${JSON.stringify(responsibilities, null, 2)}\n`,
    "utf8",
  );
}

/** Sem órfão: aqui não há histórico nem permissão a preservar. */
export async function deleteDepartmentResponsibilities(
  departmentSlug: string,
): Promise<void> {
  try {
    await fs.unlink(departmentResponsibilitiesFile(departmentSlug));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
