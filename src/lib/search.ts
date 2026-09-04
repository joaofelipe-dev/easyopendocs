import "server-only";

import { prisma } from "@/lib/prisma";
import { listReadableDepartments, type CurrentUser } from "@/lib/rbac";
import { sanitizeDocumentHtml } from "@/lib/sanitize";
import { SEARCH_CONFIG } from "@/lib/search-index";

/**
 * Lado da LEITURA da busca full-text. Quem preenche o índice é o sync, via
 * search-index.ts.
 *
 * A configuração `pt_unaccent` (criada na migration `add_document_search`) é
 * `portuguese` com o dicionário `unaccent` na frente: quem digita "manutencao"
 * acha "manutenção". Indexação e consulta usam a mesma config — se
 * divergirem, o radical gravado não bate com o procurado e a busca devolve
 * vazio, sem erro nenhum para denunciar.
 */

/**
 * Trechos que o `ts_headline` devolve, já com `<mark>` nos termos achados.
 * O delimitador vai entre aspas porque o parser do Postgres come os espaços
 * de um valor sem aspas — sem elas, os dois fragmentos saem colados numa
 * palavra só ("programação…precisa").
 */
const HEADLINE_OPTIONS =
  'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, FragmentDelimiter=" … ", MaxWords=24, MinWords=10, ShortWord=2';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type SearchResult = {
  documentId: string;
  documentSlug: string;
  title: string;
  description: string | null;
  departmentSlug: string;
  departmentName: string;
  /** Trecho com `<mark>` nos termos, já sanitizado. */
  snippetHtml: string;
  rank: number;
};

export type SearchOptions = {
  /** Restringe a um departamento (o usuário ainda precisa ter acesso a ele). */
  departmentSlug?: string;
  limit?: number;
};

type SearchRow = {
  documentId: string;
  documentSlug: string;
  title: string;
  description: string | null;
  departmentSlug: string;
  departmentName: string;
  snippetHtml: string | null;
  rank: number;
};

/**
 * Busca dentro do que o usuário pode ler. O recorte de acesso vai no SQL, não
 * em memória: filtrar depois significaria decidir o `LIMIT` sobre documentos
 * que o usuário nem pode ver.
 */
export async function searchDocuments(
  user: CurrentUser,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const departments = await listReadableDepartments(user);
  const scoped = options.departmentSlug
    ? departments.filter((department) => department.slug === options.departmentSlug)
    : departments;

  if (scoped.length === 0) return [];

  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const departmentIds = scoped.map((department) => department.id);

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT d."id"           AS "documentId",
           d."slug"         AS "documentSlug",
           d."title"        AS "title",
           d."description"  AS "description",
           dep."slug"       AS "departmentSlug",
           dep."name"       AS "departmentName",
           ts_headline(
             ${SEARCH_CONFIG}::regconfig,
             coalesce(nullif(d."plainText", ''), d."description", d."title"),
             q,
             ${HEADLINE_OPTIONS}
           )                AS "snippetHtml",
           ts_rank_cd(d."searchVector", q) AS "rank"
      FROM "Document" d
      JOIN "Department" dep ON dep."id" = d."departmentId",
           websearch_to_tsquery(${SEARCH_CONFIG}::regconfig, ${trimmed}) q
     WHERE d."isOrphan" = false
       AND d."departmentId" = ANY(${departmentIds}::text[])
       AND d."searchVector" @@ q
     ORDER BY "rank" DESC, d."title" ASC
     LIMIT ${limit}
  `;

  return rows.map((row) => ({
    documentId: row.documentId,
    documentSlug: row.documentSlug,
    title: row.title,
    description: row.description,
    departmentSlug: row.departmentSlug,
    departmentName: row.departmentName,
    // O `ts_headline` monta HTML em cima de texto que veio do usuário: mesmo
    // sendo só `<mark>` o que o Postgres acrescenta, o resultado passa pelo
    // sanitizador antes de virar dangerouslySetInnerHTML, como todo o resto.
    snippetHtml: sanitizeDocumentHtml(row.snippetHtml ?? ""),
    rank: Number(row.rank),
  }));
}
