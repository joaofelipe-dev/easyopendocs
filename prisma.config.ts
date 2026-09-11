import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * `file:` é relativo à raiz do repo em TODOS os pontos (CLI, adapter, seed,
 * testes), não ao diretório do schema. SQLite cria o arquivo no primeiro
 * uso, então o diretório precisa existir (data/ é versionada).
 */
function resolveDatasourceUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  const filePath = path.resolve(process.cwd(), url.slice("file:".length));
  return `file:${filePath}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `--conditions=react-server` reproduz a resolução que o bundler do Next
    // faz nas compilações de servidor: é o que troca o pacote `server-only`
    // por um módulo vazio. Sem isso, o seed quebra ao importar o sync, que
    // desde a busca alcança o sanitizador (`server-only`). Mesmo motivo do
    // alias em vitest.config.mts — ver tests/stubs/server-only.ts.
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: resolveDatasourceUrl(env("DATABASE_URL")),
  },
});