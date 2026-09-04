import "server-only";

import { parseFrontMatter } from "@/lib/content";
import { prisma } from "@/lib/prisma";
import { htmlToPlainText, sanitizeDocumentHtml } from "@/lib/sanitize";

/**
 * Lado da ESCRITA do índice de busca — o que o sync chama.
 *
 * Fica separado de search.ts (a consulta) porque aquele arquivo depende do
 * RBAC, que depende do NextAuth: o indexador roda dentro do `syncContent`, que
 * não tem nada a ver com sessão. Mesmo motivo de permissions.ts ser separado
 * de rbac.ts.
 */

/** Config de busca criada na migration `add_document_search`. */
export const SEARCH_CONFIG = "pt_unaccent";

/**
 * Versão do indexador. Ao mudar como o vetor é montado (pesos, config de
 * busca, extração de texto), incremente: o sync passa a reprocessar todo
 * documento cujo `searchVersion` não bate, mesmo com mtime e hash intactos.
 * É o que faz o backfill dos documentos já indexados acontecer sozinho no
 * primeiro sync depois do deploy, sem `?force=1` manual.
 */
export const SEARCH_INDEX_VERSION = 1;

/**
 * Texto puro do corpo de um documento, a partir do arquivo bruto. Passa pelo
 * mesmo sanitizador da renderização: o que não é exibido também não é
 * indexado, senão a busca acharia documento por conteúdo invisível.
 */
export function documentPlainText(rawHtml: string): string {
  const { body } = parseFrontMatter(rawHtml);
  return htmlToPlainText(sanitizeDocumentHtml(body), null);
}

/**
 * Grava o vetor de busca de um documento. Pesos: título A, descrição B, corpo
 * C — é o que faz "backup" no título ranquear acima de "backup" citado de
 * passagem no meio de um parágrafo.
 */
export async function indexDocumentSearch(input: {
  documentId: string;
  title: string;
  description: string | null;
  plainText: string;
}): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Document"
       SET "searchVector" =
             setweight(to_tsvector(${SEARCH_CONFIG}::regconfig, ${input.title}), 'A') ||
             setweight(to_tsvector(${SEARCH_CONFIG}::regconfig, ${input.description ?? ""}), 'B') ||
             setweight(to_tsvector(${SEARCH_CONFIG}::regconfig, ${input.plainText}), 'C'),
           "searchVersion" = ${SEARCH_INDEX_VERSION}
     WHERE "id" = ${input.documentId}
  `;
}
