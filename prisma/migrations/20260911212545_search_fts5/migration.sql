-- Índice de busca: tabela virtual SQLite FTS5 que espelha
-- Document (titulo/descricao/plainText) e alimenta src/lib/search.ts.
--
-- `unicode61 remove_diacritics 2`: normaliza caixa e acento na indexação e na
-- consulta, nos dois sentidos ("manutencao" acha "manutenção" e vice-versa).
-- É uma tabela virtual, fora do modelo do Prisma: as migrations seguintes não
-- a apagam (o engine preserva o que o histórico de migrations criou).

CREATE VIRTUAL TABLE "DocumentFts" USING fts5(
  "documentId" UNINDEXED,
  "title",
  "description",
  "plainText",
  tokenize = 'unicode61 remove_diacritics 2'
);