import { prisma } from "@/lib/prisma";

export { seedPermissionsAndRoles, upsertUser, assignRole } from "@/lib/rbac-seed";

/**
 * Ordem não importa: TRUNCATE ... CASCADE resolve as dependências. Rodado
 * antes de CADA teste (ver tests/setup.ts) — cada teste que precisa de
 * papéis/permissões chama `seedPermissionsAndRoles()` explicitamente.
 */
const TABLES = [
  "SyncLog",
  "UserDepartmentRole",
  "RolePermission",
  "Document",
  "Department",
  "User",
  "Role",
  "Permission",
];

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}
