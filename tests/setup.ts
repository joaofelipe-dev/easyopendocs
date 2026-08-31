import "dotenv/config";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeEach, vi } from "vitest";

/**
 * `@/lib/auth` chama `NextAuth(...)` no carregamento do módulo, o que importa
 * "next/server" — inexistente fora de uma build/runtime real do Next.js (não
 * é um problema do Next em si, é que não estamos dentro de uma requisição
 * real). `@/lib/rbac.ts` importa `auth` de lá só para `getCurrentUser()`.
 *
 * Mockado uma vez aqui, globalmente, porque qualquer teste que toque
 * `@/lib/rbac` ou uma server action puxa essa cadeia de import mesmo sem usar
 * `getCurrentUser()`. Testes que precisam simular "quem está logado" chamam
 * `vi.mocked(auth).mockResolvedValue(...)` — o resto da cadeia (busca no
 * banco, isActive, permissões) continua 100% real.
 */
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));

/**
 * setupFile: roda uma vez por ARQUIVO de teste, antes dos imports desse
 * arquivo (é o que garante que nenhum teste escreve sem querer em
 * content/departamentos/ de verdade nem no Postgres de desenvolvimento).
 *
 * As duas linhas abaixo têm que vir antes de qualquer import de módulo do
 * app: `src/lib/prisma.ts` e `src/lib/content.ts` leem essas variáveis uma
 * única vez, no carregamento do módulo — por isso os imports de "@/lib/*"
 * neste arquivo são todos dinâmicos (`await import(...)`), depois de setar o
 * ambiente. Um import estático no topo seria hospedado (hoisted) antes destas
 * linhas rodarem.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL não definida. Veja tests/README.md — normalmente é " +
      "a mesma instância do docker-compose, banco `easyopendocs_test`.",
  );
}
process.env.DATABASE_URL = testDatabaseUrl;

const contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "easyopendocs-test-"));
process.env.CONTENT_ROOT = contentRoot;

afterAll(() => {
  fs.rmSync(contentRoot, { recursive: true, force: true });
});

const { resetDatabase } = await import("./helpers/db");

// Banco limpo antes de CADA teste — cada teste declara explicitamente (via
// os helpers de tests/helpers/db.ts) o estado que precisa, em vez de herdar
// dados de um teste anterior sem querer.
beforeEach(async () => {
  await resetDatabase();
});
