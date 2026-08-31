import { z } from "zod";

import { slugify } from "@/lib/slug";

/**
 * Mapa de responsabilidades do departamento: o que o departamento faz,
 * agrupado em frentes, com os documentos que cobrem cada responsabilidade.
 *
 * Mora em `_responsabilidades.json` na pasta do departamento, ao lado do
 * `_departamento.json` — leitura e escrita ficam em
 * department-responsibilities-file.ts. Este arquivo tem só os tipos, o schema
 * e as funções puras, sem `server-only` e sem `node:fs`, para que o editor
 * (client component) possa importar os tipos — mesmo motivo pelo qual
 * permissions.ts é separado de rbac.ts.
 */

export const MAX_AREAS = 24;
export const MAX_ITEMS_PER_AREA = 60;
export const MAX_DOCS_PER_ITEM = 30;

export type Responsibility = {
  /** Estável: uma vez atribuído, nunca é regerado (é o alvo de `deliversTo`). */
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  /** Slugs de documentos do próprio departamento. */
  docs: string[];
  /**
   * Ids das responsabilidades para quem esta entrega. Gravado e preservado,
   * mas ainda não usado em lugar nenhum: por enquanto a tela é uma lista de
   * blocos agrupados. O campo existe desde já para que o diagrama de setas,
   * quando for implementado, não obrigue ninguém a remontar o mapa.
   */
  deliversTo: string[];
};

export type ResponsibilityArea = {
  id: string;
  title: string;
  items: Responsibility[];
};

export type DepartmentResponsibilities = {
  areas: ResponsibilityArea[];
};

export const EMPTY_RESPONSIBILITIES: DepartmentResponsibilities = { areas: [] };

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// Tolerante de propósito: o arquivo é editável à mão, então `id`, `docs` e
// `deliversTo` podem faltar — a normalização preenche o que der.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value?.trim() || null);

const responsibilitySchema = z.object({
  id: z.string().trim().max(100).nullish(),
  title: z
    .string()
    .trim()
    .min(1, "Toda responsabilidade precisa de um título.")
    .max(120, "O título da responsabilidade pode ter no máximo 120 caracteres."),
  description: optionalText(400),
  owner: optionalText(120),
  docs: z.array(z.string().trim().max(100)).max(MAX_DOCS_PER_ITEM).default([]),
  deliversTo: z.array(z.string().trim().max(100)).max(MAX_ITEMS_PER_AREA).default([]),
});

const areaSchema = z.object({
  id: z.string().trim().max(100).nullish(),
  title: z
    .string()
    .trim()
    .min(1, "Toda frente precisa de um título.")
    .max(120, "O título da frente pode ter no máximo 120 caracteres."),
  items: z
    .array(responsibilitySchema)
    .max(
      MAX_ITEMS_PER_AREA,
      `Uma frente pode ter no máximo ${MAX_ITEMS_PER_AREA} responsabilidades.`,
    )
    .default([]),
});

export const responsibilitiesSchema = z.object({
  areas: z
    .array(areaSchema)
    .max(MAX_AREAS, `O mapa pode ter no máximo ${MAX_AREAS} frentes.`)
    .default([]),
});

export type ResponsibilitiesInput = z.input<typeof responsibilitiesSchema>;

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

function assignId(
  existing: string | null | undefined,
  title: string,
  used: Set<string>,
  fallback: string,
): string {
  // Ids vindos do arquivo são preservados (só passam por slugify, que é
  // idempotente para ids já gerados aqui). Renomear um id quebraria as
  // referências de `deliversTo` que apontam para ele.
  const base = slugify(existing?.trim() || title) || fallback;

  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);

  return id;
}

/**
 * Preenche ids faltantes, resolve ids duplicados e descarta referências de
 * `deliversTo` que não apontam para nenhuma responsabilidade existente —
 * apagar um bloco não deve deixar referência pendurada no arquivo.
 */
export function normalizeResponsibilities(
  input: z.infer<typeof responsibilitiesSchema>,
): DepartmentResponsibilities {
  const areaIds = new Set<string>();
  const itemIds = new Set<string>();

  const areas: ResponsibilityArea[] = input.areas.map((area, areaIndex) => ({
    id: assignId(area.id, area.title, areaIds, `frente-${areaIndex + 1}`),
    title: area.title,
    items: area.items.map((item, itemIndex) => ({
      id: assignId(item.id, item.title, itemIds, `item-${areaIndex + 1}-${itemIndex + 1}`),
      title: item.title,
      description: item.description,
      owner: item.owner,
      docs: [...new Set(item.docs.filter(Boolean))],
      deliversTo: [...new Set(item.deliversTo.map((ref) => slugify(ref)).filter(Boolean))],
    })),
  }));

  for (const area of areas) {
    for (const item of area.items) {
      item.deliversTo = item.deliversTo.filter(
        (ref) => ref !== item.id && itemIds.has(ref),
      );
    }
  }

  return { areas };
}

export function parseResponsibilities(
  value: unknown,
):
  | { ok: true; responsibilities: DepartmentResponsibilities }
  | { ok: false; error: string } {
  const parsed = responsibilitiesSchema.safeParse(value);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (em \`${issue.path.join(".")}\`)` : "";
    return { ok: false, error: `${issue?.message ?? "Formato inválido."}${where}` };
  }

  return { ok: true, responsibilities: normalizeResponsibilities(parsed.data) };
}

// ---------------------------------------------------------------------------
// Resolução contra os documentos do departamento
// ---------------------------------------------------------------------------

export type ResponsibilityDocumentRef = {
  slug: string;
  title: string;
  /** O slug está no mapa mas não existe (mais) no departamento. */
  missing: boolean;
};

export type ResolvedResponsibility = Omit<Responsibility, "docs"> & {
  documents: ResponsibilityDocumentRef[];
};

export type ResolvedResponsibilityArea = {
  id: string;
  title: string;
  items: ResolvedResponsibility[];
};

export type ResolvedResponsibilities = {
  areas: ResolvedResponsibilityArea[];
  itemCount: number;
  /** Responsabilidades sem nenhum documento existente apontado. */
  uncoveredCount: number;
  /** Referências a documentos que sumiram do departamento. */
  missingDocCount: number;
};

/**
 * Cruza os slugs do mapa com os documentos que o departamento realmente tem.
 * É daqui que sai a informação que o portal ainda não dava: qual
 * responsabilidade não tem documentação nenhuma.
 */
export function resolveResponsibilities(
  responsibilities: DepartmentResponsibilities,
  documents: ReadonlyArray<{ slug: string; title: string }>,
): ResolvedResponsibilities {
  const titleBySlug = new Map(documents.map((document) => [document.slug, document.title]));

  let itemCount = 0;
  let uncoveredCount = 0;
  let missingDocCount = 0;

  const areas = responsibilities.areas.map((area) => ({
    id: area.id,
    title: area.title,
    items: area.items.map((item) => {
      const { docs, ...rest } = item;
      itemCount += 1;

      const resolved = docs.map((slug) => {
        const title = titleBySlug.get(slug);
        if (title === undefined) missingDocCount += 1;
        return { slug, title: title ?? slug, missing: title === undefined };
      });

      if (!resolved.some((document) => !document.missing)) uncoveredCount += 1;

      return { ...rest, documents: resolved };
    }),
  }));

  return { areas, itemCount, uncoveredCount, missingDocCount };
}
