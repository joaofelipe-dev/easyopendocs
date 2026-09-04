import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Department } from "@/generated/prisma/client";
import { ALL_PERMISSION_KEYS, PERMISSIONS, type PermissionKey } from "@/lib/permissions";

// O catálogo vive em permissions.ts para que o seed (que roda fora do Next)
// consiga importá-lo sem esbarrar no `server-only` deste arquivo.
export {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_NAME,
  PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_CATALOG,
} from "@/lib/permissions";
export type { PermissionKey } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Usuário corrente
// ---------------------------------------------------------------------------

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
};

/**
 * Lê a sessão e revalida o usuário no banco. A checagem sempre bate no banco
 * porque o JWT é um snapshot: desativar um usuário ou remover uma role precisa
 * valer no próximo request, sem esperar o token expirar.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/sem-acesso?motivo=admin");
  return user;
}

// ---------------------------------------------------------------------------
// Acesso por departamento
// ---------------------------------------------------------------------------

export type DepartmentAccess = {
  department: Department;
  /** Nomes das roles do usuário neste departamento (vazio para super admin). */
  roleNames: string[];
  permissions: Set<string>;
  isSuperAdmin: boolean;
};

export type AccessibleDepartment = Department & {
  documentCount: number;
  /** Roles do usuário neste departamento. Vazio quando ele é super admin. */
  roleNames: string[];
};

/**
 * Departamentos que o usuário enxerga na home: todos, se super admin; senão
 * apenas aqueles onde ele tem ao menos uma role. Órfãos ficam de fora.
 */
export async function listAccessibleDepartments(
  user: CurrentUser,
): Promise<AccessibleDepartment[]> {
  const departments = await prisma.department.findMany({
    where: user.isSuperAdmin
      ? { isOrphan: false }
      : { isOrphan: false, userRoles: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { documents: { where: { isOrphan: false } } } },
      userRoles: {
        where: { userId: user.id },
        select: { role: { select: { name: true } } },
      },
    },
  });

  return departments.map(({ _count, userRoles, ...department }) => ({
    ...department,
    documentCount: _count.documents,
    roleNames: [...new Set(userRoles.map((entry) => entry.role.name))].sort(),
  }));
}

export type ReadableDepartment = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Departamentos em que o usuário pode LER documentação — recorte mais estrito
 * que `listAccessibleDepartments`, que só exige ter algum papel. A busca usa
 * este: um resultado já revela título e trecho do documento, então quem não
 * tem `document:read` não pode nem chegar na lista.
 */
export async function listReadableDepartments(
  user: CurrentUser,
): Promise<ReadableDepartment[]> {
  return prisma.department.findMany({
    where: user.isSuperAdmin
      ? { isOrphan: false }
      : {
          isOrphan: false,
          userRoles: {
            some: {
              userId: user.id,
              role: {
                permissions: {
                  some: { permission: { key: PERMISSIONS.documentRead } },
                },
              },
            },
          },
        },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

/**
 * Resolve o que o usuário pode fazer dentro de um departamento.
 * Retorna null quando o departamento não existe ou o usuário não tem acesso.
 */
export async function getDepartmentAccess(
  user: CurrentUser,
  departmentSlug: string,
): Promise<DepartmentAccess | null> {
  const department = await prisma.department.findUnique({
    where: { slug: departmentSlug },
  });

  if (!department || department.isOrphan) return null;

  if (user.isSuperAdmin) {
    return {
      department,
      roleNames: [],
      permissions: new Set(ALL_PERMISSION_KEYS),
      isSuperAdmin: true,
    };
  }

  const assignments = await prisma.userDepartmentRole.findMany({
    where: { userId: user.id, departmentId: department.id },
    select: {
      role: {
        select: {
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  if (assignments.length === 0) return null;

  // Múltiplas roles no mesmo departamento se somam (união das permissões).
  const permissions = new Set<string>();
  const roleNames: string[] = [];

  for (const assignment of assignments) {
    roleNames.push(assignment.role.name);
    for (const rolePermission of assignment.role.permissions) {
      permissions.add(rolePermission.permission.key);
    }
  }

  return { department, roleNames, permissions, isSuperAdmin: false };
}

export function can(access: DepartmentAccess, permission: PermissionKey): boolean {
  return access.isSuperAdmin || access.permissions.has(permission);
}

/**
 * Porta de entrada das rotas de departamento. Sem acesso nenhum e sem a
 * permissão exigida caem na mesma tela, de propósito: um usuário sem acesso
 * não deve conseguir descobrir quais departamentos existem.
 */
export async function requireDepartmentAccess(
  departmentSlug: string,
  permission: PermissionKey = PERMISSIONS.documentRead,
): Promise<{ user: CurrentUser; access: DepartmentAccess }> {
  const user = await requireUser();
  const access = await getDepartmentAccess(user, departmentSlug);

  if (!access) redirect(`/sem-acesso?departamento=${encodeURIComponent(departmentSlug)}`);
  if (!can(access, permission)) {
    redirect(
      `/sem-acesso?departamento=${encodeURIComponent(departmentSlug)}&permissao=${encodeURIComponent(permission)}`,
    );
  }

  return { user, access };
}
