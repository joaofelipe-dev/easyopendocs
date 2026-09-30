-- Metadados continuam no front-matter do arquivo. Estas colunas só aceleram
-- a página de saúde e evitam reler o filesystem a cada request.
ALTER TABLE "Document" ADD COLUMN "owner" TEXT;
ALTER TABLE "Document" ADD COLUMN "criticality" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "Document" ADD COLUMN "contentStatus" TEXT NOT NULL DEFAULT 'active';

