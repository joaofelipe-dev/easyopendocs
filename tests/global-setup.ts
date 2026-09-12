import "dotenv/config";

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Roda uma vez antes da suíte inteira (não por arquivo): garante que o banco
 * de teste (arquivo SQLite) existe do zero e está com as migrations em dia.
 * Recria o arquivo a cada execução para testes sempre partindo limpos — o CI
 * não tem serviço nenhum, só este arquivo.
 */
export default async function globalSetup() {
  const testDatabaseUrl = requireTestDatabaseUrl();

  removeSqliteFile(testDatabaseUrl);

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
        "a variável `file:./data/easyopendocs-test.db` do .env.example.",
    );
  }
  return url;
}

/**
 * Apaga o arquivo de dump do SQLite e os companheiros que ele deixa pelo
 * caminho (-journal/-shm/-wal). `file:` é relativo à raiz do repo, mesma regra
 * do prisma.config.ts e do src/lib/prisma.ts.
 */
function removeSqliteFile(connectionString: string): void {
  const pathname = connectionString.replace(/^file:/, "");
  const base = path.resolve(process.cwd(), pathname);
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    fs.rmSync(`${base}${suffix}`, { force: true });
  }
}