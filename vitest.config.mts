import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

/**
 * Testes de integração/funcionais: batem num Postgres de teste real (não
 * mockado) e num CONTENT_ROOT temporário — ver tests/README.md.
 *
 * `fileParallelism: false` porque todo arquivo de teste compartilha o mesmo
 * Postgres de teste e o `beforeEach` de tests/setup.ts trunca as tabelas antes
 * de cada teste. Rodar arquivos em paralelo faria um arquivo apagar os dados
 * que outro acabou de inserir. Isolamento entre TESTES (dentro de um mesmo
 * arquivo) já é serial por padrão do Vitest — só entre ARQUIVOS que precisa
 * ser forçado aqui.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Ver tests/stubs/server-only.ts: reproduz a troca que o bundler do
      // Next faz nas compilações de servidor, que o Vitest não faz sozinho.
      "server-only": serverOnlyStub,
      "@": srcDir,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    env: {
      // O throttle existe para não bater disco a cada carregamento de página
      // (ver SYNC_THROTTLE_MS em content-sync.ts); testes não devem depender
      // de esperar essa janela passar.
      SYNC_THROTTLE_MS: "0",
    },
  },
});
