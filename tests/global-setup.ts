import "dotenv/config";

import { execSync } from "node:child_process";

import { Client } from "pg";

/**
 * Roda uma vez antes da suíte inteira (não por arquivo): garante que o banco
 * de teste existe e está com as migrations em dia. Local ou CI, o efeito é o
 * mesmo — em CI o banco do serviço Postgres já existe vazio, então só a
 * migration roda; localmente, a primeira execução também cria o banco.
 */
export default async function globalSetup() {
  const testDatabaseUrl = requireTestDatabaseUrl();

  await ensureDatabaseExists(testDatabaseUrl);

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}

function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL não definida. Veja tests/README.md — normalmente é " +
        "a mesma instância do docker-compose, banco `easyopendocs_test`.",
    );
  }
  return url;
}

async function ensureDatabaseExists(connectionString: string): Promise<void> {
  const target = new URL(connectionString);
  const databaseName = target.pathname.replace(/^\//, "");

  // `postgres` é o banco de manutenção, sempre existe — é nele que se roda um
  // CREATE DATABASE para o banco de teste em si.
  const maintenance = new URL(connectionString);
  maintenance.pathname = "/postgres";

  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();

  try {
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    // 42P04 = "database already exists". Postgres não tem CREATE DATABASE
    // IF NOT EXISTS, então o caminho idempotente é tentar e ignorar esse erro.
    if ((error as { code?: string }).code !== "42P04") throw error;
  } finally {
    await client.end();
  }
}
