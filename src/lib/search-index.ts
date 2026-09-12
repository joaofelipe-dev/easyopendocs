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
 *
 * O índice mora na tabela virtual `DocumentFts` (SQLite FTS5, criada por
 * migration) e espelha `plainText`/`searchVersion` do Document — o FTS5 faz a
 * normalização de caixa e acento na indexação e na consulta, então
 * "manutencao" encontra "manutenção" nos dois sentidos.
 */

/**
 * Versão do indexador. Ao mudar como o índice é montado (pesos, tokenizer,
 * extração de texto), incremente: o sync passa a reprocessar todo documento
 * cujo `searchVersion` não bate, mesmo com mtime e hash intactos. É o que faz
 * o backfill dos documentos já indexados acontecer sozinho no primeiro sync
 * depois do deploy, sem `?force=1` manual.
 */
export const SEARCH_INDEX_VERSION = 2;

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
 * Grava o índice de busca de um documento. O FTS5 não faz UPSERT, então o
 * caminho idempotente é remover e reinserir a linha (documentId é a chave).
 * O `searchVersion` é atualizado na mesma transação que o índice.
 */
export async function indexDocumentSearch(input: {
  documentId: string;
  title: string;
  description: string | null;
  plainText: string;
}): Promise<void> {
  await prisma.$transaction([ 
    prisma.$executeRaw`
      DELETE FROM "DocumentFts" WHERE "documentId" = ${input.documentId}
    `,
    prisma.$executeRaw`
      INSERT INTO "DocumentFts" ("documentId", "title", "description", "plainText")
      VALUES (${input.documentId}, ${input.title}, ${input.description ?? ""}, ${input.plainText})
    `,
    prisma.$executeRaw`
      UPDATE "Document" SET "searchVersion" = ${SEARCH_INDEX_VERSION} WHERE "id" = ${input.documentId}
    `,
  ]);
}