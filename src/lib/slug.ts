/**
 * Sem imports de `node:` — este módulo é usado tanto no servidor quanto no
 * client (a tela de nova documentação mostra o slug enquanto você digita, e
 * ele precisa bater exatamente com o que o servidor vai gravar no disco).
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length <= 100;
}

/** "Política de Férias 2025" -> "politica-de-ferias-2025" */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

/** "recursos-humanos" -> "Recursos Humanos" (fallback quando não há metadados). */
export function humanizeSlug(slug: string): string {
  const lowercaseWords = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);

  return slug
    .split("-")
    .map((word, index) =>
      index > 0 && lowercaseWords.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
