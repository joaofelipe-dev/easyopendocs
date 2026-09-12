import { prisma } from "@/lib/prisma";

export { seedPermissionsAndRoles, upsertUser, assignRole } from "@/lib/rbac-seed";

/**
 * SQLite não tem TRUNCATE; o caminho limpo é DELETE por tabela, na ordem
 * filho→pai. `DocumentFts` (tabela virtual FTS5) não tem FK e precisa ir junto,
 * senão o índice sobrevive aos documentos que o teste desfez. Rodado antes de
 * CADA teste (ver tests/setup.ts) — cada teste que precisa de papéis/permissões
 * chama `seedPermissionsAndRoles()` explicitamente.
 */
const TABLES = [
  "DocumentFts",
  "SyncLog",
  "DocumentVersion",
  "UserDepartmentRole",
  "RolePermission",
  "Document",
  "Department",
  "User",
  "Role",
  "Permission",
];

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    ...TABLES.map(
      (table) => prisma.$executeRawUnsafe(`DELETE FROM "${table}"`),
    ),
  ]);
}