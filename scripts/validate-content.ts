import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import { contentRoot, isValidSlug, parseFrontMatter } from "../src/lib/content";
import { validateDocumentMetadata } from "../src/lib/document-health";

type ValidationResult = { errors: string[]; warnings: string[] };

async function validateContent(): Promise<ValidationResult> {
  const result: ValidationResult = { errors: [], warnings: [] };
  const root = contentRoot();

  let departments: Dirent<string>[];
  try {
    departments = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return result;
    throw error;
  }

  for (const department of departments) {
    if (!department.isDirectory() || department.name.startsWith("_") || department.name.startsWith(".")) continue;
    if (!isValidSlug(department.name)) {
      result.errors.push(`${department.name}: slug de departamento inválido.`);
      continue;
    }

    const directory = path.join(root, department.name);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith("_") || !entry.name.endsWith(".html")) continue;
      const slug = entry.name.slice(0, -".html".length);
      const relativePath = path.join(department.name, entry.name);
      if (!isValidSlug(slug)) {
        result.errors.push(`${relativePath}: slug de documentação inválido.`);
        continue;
      }

      const raw = await fs.readFile(path.join(directory, entry.name), "utf8");
      const { frontMatter } = parseFrontMatter(raw);
      for (const issue of validateDocumentMetadata(frontMatter)) {
        result.errors.push(`${relativePath}: ${issue.message}`);
      }
      if (!frontMatter.title) result.warnings.push(`${relativePath}: sem title explícito.`);
      if (!frontMatter.description) result.warnings.push(`${relativePath}: sem description.`);
      if (!frontMatter.owner) result.warnings.push(`${relativePath}: sem owner.`);
    }
  }

  return result;
}

validateContent()
  .then(({ errors, warnings }) => {
    for (const warning of warnings) console.warn(`aviso: ${warning}`);
    for (const error of errors) console.error(`erro: ${error}`);
    if (errors.length > 0) process.exitCode = 1;
    else console.log(`Conteúdo válido${warnings.length ? ` (${warnings.length} aviso(s)).` : "."}`);
  })
  .catch((error: unknown) => {
    console.error("Não foi possível validar o conteúdo:", error);
    process.exitCode = 1;
  });
