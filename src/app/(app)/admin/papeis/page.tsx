import type { Metadata } from "next";

import { RolesManager } from "@/components/admin/roles-manager";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Papéis e permissões" };
export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { select: { permissionId: true } },
        _count: { select: { departmentRoles: true } },
      },
    }),
    prisma.permission.findMany({
      orderBy: { key: "asc" },
      include: { _count: { select: { roles: true } } },
    }),
  ]);

  return (
    <RolesManager
      roles={roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissionIds: role.permissions.map((entry) => entry.permissionId),
        assignmentCount: role._count.departmentRoles,
      }))}
      permissions={permissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        description: permission.description,
        roleCount: permission._count.roles,
      }))}
    />
  );
}
