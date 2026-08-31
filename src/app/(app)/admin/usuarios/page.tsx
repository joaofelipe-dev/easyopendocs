import type { Metadata } from "next";

import { UsersManager } from "@/components/admin/users-manager";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const currentUser = await requireSuperAdmin();

  const [users, departments, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
        departmentRoles: {
          select: {
            id: true,
            department: { select: { id: true, name: true, isOrphan: true } },
            role: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.department.findMany({
      where: { isOrphan: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <UsersManager
      users={users.map((user) => ({
        ...user,
        isCurrentUser: user.id === currentUser.id,
        createdAt: user.createdAt.toISOString(),
        assignments: user.departmentRoles.map((assignment) => ({
          id: assignment.id,
          departmentName: assignment.department.name,
          departmentIsOrphan: assignment.department.isOrphan,
          roleName: assignment.role.name,
        })),
      }))}
      departments={departments}
      roles={roles}
    />
  );
}
