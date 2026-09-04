import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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
    url: env("DATABASE_URL"),
  },
});
