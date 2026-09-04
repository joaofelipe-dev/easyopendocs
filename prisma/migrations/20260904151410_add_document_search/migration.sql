-- Busca full-text em português.
--
-- `unaccent` é uma extensão *trusted* desde o PG13: o dono do banco cria sem
-- precisar ser superuser, e ela vem no postgres:17-alpine do docker-compose e
-- do CI. É o que faz "manutencao" encontrar "manutenção" — sem ela, metade das
-- buscas de um portal em português falha por causa de um acento não digitado.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Uma cópia de `portuguese` com o dicionário `unaccent` na frente do
-- `portuguese_stem`: primeiro tira o acento, depois reduz ao radical. A config
-- precisa existir com nome próprio porque tanto a indexação quanto a consulta
-- a referenciam por nome (src/lib/search.ts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);

    ALTER TEXT SEARCH CONFIGURATION pt_unaccent
      ALTER MAPPING FOR
        asciiword, asciihword, hword_asciipart,
        word, hword, hword_part, hword_numpart,
        numword, numhword
      WITH unaccent, portuguese_stem;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "plainText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "searchVector" tsvector,
ADD COLUMN     "searchVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");
