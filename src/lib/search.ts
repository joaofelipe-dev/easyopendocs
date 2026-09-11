import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { listReadableDepartments, type CurrentUser } from "@/lib/rbac";
import { sanitizeDocumentHtml } from "@/lib/sanitize";

/**
 * Lado da LEITURA da busca full-text. Quem preenche o índice é o sync, via
 * search-index.ts.
 *
 * Índice: tabela virtual SQLite FTS5 `DocumentFts` (migration), com o tokenizer
 * `unicode61 remove_diacritics 2`: caixa e acento são normalizados na
 * indexação E na consulta, então quem digita "manutencao" acha "manutenção".
 *
 * Pesos da ordenação via `bm25(…, 5.0, 3.0, 1.0)`: acerto no título vale mais
 * que na descrição, que vale mais que no corpo — o equivalente do
 * setweight(A/B/C) que a versão tsvector usava.
 */

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
 * Monta a expressão `MATCH` do FTS5 a partir do texto do usuário, sem deixar
 * a sintaxe própria do FTS5 (aspas, `*`, `:` etc.) quebrar a consulta ou virar
 * injeção de operador. Frases entre aspas viram frase exata; o restante vira
 * palavras unidas por AND (mesmo comportamento do websearch que havia).
 */
function toFtsQuery(input: string): string {
  const tokens =
    input.match(/"[^"]+"|[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];

  const terms: string[] = [];
  for (const token of tokens) {
    if (token.startsWith('"') && token.endsWith('"')) {
      const phrase = token.slice(1, -1).trim();
      // Uma "frase" sem nenhuma palavra não casa com nada — descartar.
      if (/[\p{L}\p{N}]/u.test(phrase)) terms.push(phrase);
    } else {
      terms.push(token);
    }
  }

  return terms.length > 0 ? terms.map((term) => `"${term}"`).join(" AND ") : "";
}

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

  const ftsQuery = toFtsQuery(trimmed);
  if (!ftsQuery) return [];

  const departments = await listReadableDepartments(user);
  const scoped = options.departmentSlug
    ? departments.filter((department) => department.slug === options.departmentSlug)
    : departments;

  if (scoped.length === 0) return [];

  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT d."id"           AS "documentId",
           d."slug"         AS "documentSlug",
           d."title"        AS "title",
           d."description"  AS "description",
           dep."slug"       AS "departmentSlug",
           dep."name"       AS "departmentName",
           coalesce(
             NULLIF(highlight(DocumentFts, 3, '<mark>', '</mark>'), ''),
             NULLIF(d."description", ''),
             d."title"
           )                AS "snippetHtml",
           bm25(DocumentFts, 5.0, 3.0, 1.0) AS "rank"
      FROM DocumentFts
      JOIN "Document" d    ON d."id" = DocumentFts."documentId"
      JOIN "Department" dep ON dep."id" = d."departmentId"
     WHERE DocumentFts MATCH ${ftsQuery}
       AND d."departmentId" IN (${Prisma.join(scoped.map((department) => department.id))})
       AND d."isOrphan" = false
     ORDER BY "rank" ASC, d."title" ASC
     LIMIT ${limit}
  `;

  return rows.map((row) => ({
    documentId: row.documentId,
    documentSlug: row.documentSlug,
    title: row.title,
    description: row.description,
    departmentSlug: row.departmentSlug,
    departmentName: row.departmentName,
    // O `highlight` monta HTML em cima de texto que veio do usuário: mesmo
    // sendo só `<mark>` o que o FTS5 acrescenta, o resultado passa pelo
    // sanitizador antes de virar dangerouslySetInnerHTML, como todo o resto.
    snippetHtml: sanitizeDocumentHtml(row.snippetHtml ?? ""),
    rank: Number(row.rank),
  }));
}