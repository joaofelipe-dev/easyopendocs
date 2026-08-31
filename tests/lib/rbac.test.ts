import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS,
  can,
  getDepartmentAccess,
  listAccessibleDepartments,
  type CurrentUser,
} from "@/lib/rbac";
import { upsertUser } from "@/lib/rbac-seed";

/**
 * Cobre `getDepartmentAccess`, `listAccessibleDepartments` e `can` — as
 * funções que recebem um `CurrentUser` já resolvido e decidem acesso contra o
 * banco real. Propositalmente NÃO cobre `getCurrentUser`/`requireUser`
 * (dependem de `auth()`/cookies de sessão, isto é, uma request de verdade) —
 * isso fica para os testes de navegador (Playwright, fase 2). Ver
 * tests/README.md.
 */

async function createDepartment(
  slug: string,
  overrides: Partial<{ isOrphan: boolean }> = {},
) {
  return prisma.department.create({
    data: {
      slug,
      name: slug,
      path: `content/departamentos/${slug}`,
      isOrphan: overrides.isOrphan ?? false,
    },
  });
}

async function createUser(overrides: Partial<{ isSuperAdmin: boolean }> = {}): Promise<CurrentUser> {
  const id = await upsertUser({
    name: "Usuário de teste",
    email: `teste-${Math.random().toString(36).slice(2)}@exemplo.com`,
    password: "senha-qualquer",
    isSuperAdmin: overrides.isSuperAdmin ?? false,
  });

  return {
    id,
    name: "Usuário de teste",
    email: "irrelevante@exemplo.com",
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    mustChangePassword: false,
  };
}

describe("can", () => {
  it("super admin passa mesmo sem a permissão no conjunto", () => {
    const access = {
      department: {} as never,
      roleNames: [],
      permissions: new Set<string>(),
      isSuperAdmin: true,
    };
    expect(can(access, PERMISSIONS.departmentManage)).toBe(true);
  });

  it("usuário comum depende só do que está no conjunto", () => {
    const access = {
      department: {} as never,
      roleNames: ["Viewer"],
      permissions: new Set([PERMISSIONS.documentRead]),
      isSuperAdmin: false,
    };
    expect(can(access, PERMISSIONS.documentRead)).toBe(true);
    expect(can(access, PERMISSIONS.departmentManage)).toBe(false);
  });
});

describe("getDepartmentAccess", () => {
  it("nega acesso a quem não tem nenhuma role no departamento", async () => {
    const department = await createDepartment("ti");
    const user = await createUser();

    expect(await getDepartmentAccess(user, department.slug)).toBeNull();
  });

  it("super admin acessa mesmo sem role atribuída, com todas as permissões", async () => {
    const department = await createDepartment("ti");
    const admin = await createUser({ isSuperAdmin: true });

    const access = await getDepartmentAccess(admin, department.slug);

    expect(access).not.toBeNull();
    expect(access!.isSuperAdmin).toBe(true);
    expect(access!.roleNames).toEqual([]);
    expect(can(access!, PERMISSIONS.departmentManage)).toBe(true);
  });

  it("departamento órfão fica inacessível mesmo com role atribuída", async () => {
    const department = await createDepartment("ti", { isOrphan: true });
    const user = await createUser();
    const role = await prisma.role.create({ data: { name: "Papel de teste" } });
    await prisma.userDepartmentRole.create({
      data: { userId: user.id, departmentId: department.id, roleId: role.id },
    });

    expect(await getDepartmentAccess(user, department.slug)).toBeNull();
  });

  it("duas roles no mesmo departamento somam permissões (união, não substituição)", async () => {
    const department = await createDepartment("ti");
    const user = await createUser();

    const permissionRead = await prisma.permission.create({
      data: { key: PERMISSIONS.documentRead },
    });
    const permissionManage = await prisma.permission.create({
      data: { key: PERMISSIONS.departmentManage },
    });

    const roleA = await prisma.role.create({ data: { name: "Só leitura" } });
    await prisma.rolePermission.create({
      data: { roleId: roleA.id, permissionId: permissionRead.id },
    });

    const roleB = await prisma.role.create({ data: { name: "Só gestão" } });
    await prisma.rolePermission.create({
      data: { roleId: roleB.id, permissionId: permissionManage.id },
    });

    await prisma.userDepartmentRole.createMany({
      data: [
        { userId: user.id, departmentId: department.id, roleId: roleA.id },
        { userId: user.id, departmentId: department.id, roleId: roleB.id },
      ],
    });

    const access = await getDepartmentAccess(user, department.slug);

    expect(access).not.toBeNull();
    expect(access!.roleNames.sort()).toEqual(["Só gestão", "Só leitura"]);
    // Nenhuma das duas roles sozinha tem as duas permissões — só a união tem.
    expect(can(access!, PERMISSIONS.documentRead)).toBe(true);
    expect(can(access!, PERMISSIONS.departmentManage)).toBe(true);
    expect(can(access!, PERMISSIONS.documentDelete)).toBe(false);
  });

  it("revogar a role tira o acesso na PRÓXIMA chamada, sem cache", async () => {
    const department = await createDepartment("ti");
    const user = await createUser();
    const role = await prisma.role.create({ data: { name: "Papel de teste" } });
    const permission = await prisma.permission.create({
      data: { key: PERMISSIONS.documentRead },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
    const assignment = await prisma.userDepartmentRole.create({
      data: { userId: user.id, departmentId: department.id, roleId: role.id },
    });

    expect(await getDepartmentAccess(user, department.slug)).not.toBeNull();

    await prisma.userDepartmentRole.delete({ where: { id: assignment.id } });

    // Nenhuma sessão/JWT envolvida nesta função — é por isso que revogar vale
    // imediatamente. `getCurrentUser()` (não coberto aqui) é quem faz esse
    // mesmo tipo de checagem valer no request seguinte de um usuário logado.
    expect(await getDepartmentAccess(user, department.slug)).toBeNull();
  });
});

describe("listAccessibleDepartments", () => {
  it("usuário comum só vê departamentos onde tem role — não vê os outros nem os órfãos", async () => {
    const visible = await createDepartment("ti");
    await createDepartment("marketing"); // sem role para o usuário
    const orphan = await createDepartment("descontinuado", { isOrphan: true });

    const user = await createUser();
    const role = await prisma.role.create({ data: { name: "Papel de teste" } });
    await prisma.userDepartmentRole.create({
      data: { userId: user.id, departmentId: visible.id, roleId: role.id },
    });
    // Mesmo com role atribuída, um departamento órfão não deve aparecer.
    await prisma.userDepartmentRole.create({
      data: { userId: user.id, departmentId: orphan.id, roleId: role.id },
    });

    const departments = await listAccessibleDepartments(user);

    expect(departments.map((department) => department.slug)).toEqual(["ti"]);
  });

  it("super admin vê todos os departamentos não órfãos, sem precisar de role", async () => {
    await createDepartment("ti");
    await createDepartment("marketing");
    await createDepartment("descontinuado", { isOrphan: true });

    const admin = await createUser({ isSuperAdmin: true });
    const departments = await listAccessibleDepartments(admin);

    expect(departments.map((department) => department.slug).sort()).toEqual([
      "marketing",
      "ti",
    ]);
  });
});
