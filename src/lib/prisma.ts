import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

// O dev server do Next recarrega módulos a cada edição; sem o cache global cada
// reload abriria uma nova conexão com o arquivo SQLite.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function sqliteFilePath(connectionString: string): string {
  // `file:` é relativo à raiz do repo (mesma regra do prisma.config.ts); URLs
  // absolutas (ex.: file:/tmp/... na Vercel) passam direto.
  if (!connectionString.startsWith("file:")) return connectionString;
  return path.resolve(process.cwd(), connectionString.slice("file:".length));
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não está definida. Copie .env.example para .env antes de iniciar o app.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: sqliteFilePath(connectionString) }),
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}