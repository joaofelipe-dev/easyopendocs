/**
 * Catálogo de permissões e papéis padrão.
 *
 * Fica separado de rbac.ts (que é `server-only`) porque o seed roda fora do
 * Next, via tsx, e precisa desta mesma lista para popular o banco — as chaves
 * verificadas pelo código e as gravadas no banco não podem divergir.
 */

export const PERMISSIONS = {
  documentRead: "document:read",
  documentCreate: "document:create",
  documentEdit: "document:edit",
  documentDelete: "document:delete",
  departmentManage: "department:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: ReadonlyArray<{
  key: PermissionKey;
  description: string;
}> = [
  {
    key: PERMISSIONS.documentRead,
    description: "Visualizar documentações do departamento",
  },
  {
    key: PERMISSIONS.documentCreate,
    description: "Criar novas documentações no departamento",
  },
  {
    key: PERMISSIONS.documentEdit,
    description: "Editar documentações existentes do departamento",
  },
  {
    key: PERMISSIONS.documentDelete,
    description: "Excluir documentações do departamento",
  },
  {
    key: PERMISSIONS.departmentManage,
    description: "Gerenciar o departamento e os acessos dos seus membros",
  },
];

export const ROLE_CATALOG: ReadonlyArray<{
  name: string;
  description: string;
  permissions: PermissionKey[];
}> = [
  {
    name: "Viewer",
    description: "Somente leitura das documentações do departamento",
    permissions: [PERMISSIONS.documentRead],
  },
  {
    name: "Editor",
    description: "Lê, cria e edita documentações do departamento",
    permissions: [
      PERMISSIONS.documentRead,
      PERMISSIONS.documentCreate,
      PERMISSIONS.documentEdit,
    ],
  },
  {
    name: "Department Admin",
    description: "Controle total sobre o departamento, incluindo acessos",
    permissions: [
      PERMISSIONS.documentRead,
      PERMISSIONS.documentCreate,
      PERMISSIONS.documentEdit,
      PERMISSIONS.documentDelete,
      PERMISSIONS.departmentManage,
    ],
  },
];

/** Papel atribuído por padrão a todo novo usuário (não administrador geral). */
export const DEFAULT_ROLE_NAME = "Editor";

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.map((p) => p.key);
