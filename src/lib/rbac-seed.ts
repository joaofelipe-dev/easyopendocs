import { hash } from "bcryptjs";

import { PERMISSION_CATALOG, ROLE_CATALOG } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Fixtures de RBAC reutilizáveis por `prisma/seed.ts` e pelos testes de
 * integração (tests/helpers/db.ts). Sem `server-only`, no mesmo espírito de
 * permissions.ts: o seed roda fora do Next, via tsx, e os testes rodam fora
 * do Next também — nenhum dos dois pode depender de um módulo que só existe
 * dentro de uma request do App Router.
 *
 * Fica separado do próprio seed.ts para que o catálogo de papéis/permissões
 * usado pelos testes seja o mesmo aplicado em produção, não uma cópia que
 * pode divergir.
 */

const BCRYPT_ROUNDS = 10;

/** Aplica PERMISSION_CATALOG e ROLE_CATALOG ao banco. Idempotente. */
export async function seedPermissionsAndRoles(): Promise<Map<string, string>> {
  const permissionIdByKey = new Map<string, string>();

  for (const permission of PERMISSION_CATALOG) {
    const record = await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
    permissionIdByKey.set(record.key, record.id);
  }

  const roleIdByName = new Map<string, string>();

  for (const role of ROLE_CATALOG) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });

    // Reaplica o conjunto de permissões do catálogo — o seed é a fonte de
    // verdade dos papéis padrão e precisa ser idempotente.
    await prisma.rolePermission.deleteMany({ where: { roleId: record.id } });
    await prisma.rolePermission.createMany({
      data: role.permissions.map((key) => ({
        roleId: record.id,
        permissionId: permissionIdByKey.get(key)!,
      })),
    });

    roleIdByName.set(record.name, record.id);
  }

  return roleIdByName;
}

export async function upsertUser(input: {
  name: string;
  email: string;
  password: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  mustChangePassword?: boolean;
}): Promise<string> {
  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
  const email = input.email.toLowerCase();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: input.name,
      passwordHash,
      isSuperAdmin: input.isSuperAdmin ?? false,
      isActive: input.isActive ?? true,
      mustChangePassword: input.mustChangePassword ?? false,
    },
    create: {
      name: input.name,
      email,
      passwordHash,
      isSuperAdmin: input.isSuperAdmin ?? false,
      mustChangePassword: input.mustChangePassword ?? false,
      isActive: input.isActive ?? true,
    },
  });

  return user.id;
}

export async function assignRole(
  userId: string,
  departmentSlug: string,
  roleId: string,
): Promise<void> {
  const department = await prisma.department.findUnique({
    where: { slug: departmentSlug },
    select: { id: true },
  });

  if (!department) {
    throw new Error(
      `Departamento "${departmentSlug}" não foi indexado — o sync do conteúdo falhou?`,
    );
  }

  await prisma.userDepartmentRole.upsert({
    where: {
      userId_departmentId_roleId: { userId, departmentId: department.id, roleId },
    },
    update: {},
    create: { userId, departmentId: department.id, roleId },
  });
}
