"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";

import {
  createPermissionAction,
  createRoleAction,
  deletePermissionAction,
  deleteRoleAction,
  updateRoleAction,
} from "@/actions/admin";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AdminRole = {
  id: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  assignmentCount: number;
};

export type AdminPermission = {
  id: string;
  key: string;
  description: string | null;
  roleCount: number;
};

export function RolesManager({
  roles,
  permissions,
}: {
  roles: AdminRole[];
  permissions: AdminPermission[];
}) {
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [createPermissionOpen, setCreatePermissionOpen] = useState(false);

  const permissionByIdKey = new Map(permissions.map((p) => [p.id, p.key]));

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      {/* Papéis --------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Papéis</CardTitle>
              <CardDescription>
                Um papel é um conjunto de permissões. Ele só vale dentro do
                departamento em que foi atribuído.
              </CardDescription>
            </div>

            <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus />
                  Novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <ActionForm
                  action={createRoleAction}
                  onSuccess={() => setCreateRoleOpen(false)}
                >
                  <DialogHeader>
                    <DialogTitle>Novo papel</DialogTitle>
                    <DialogDescription>
                      Selecione as permissões que este papel concede.
                    </DialogDescription>
                  </DialogHeader>
                  <RoleFields permissions={permissions} />
                  <DialogFooter>
                    <SubmitButton pendingLabel="Criando…">Criar papel</SubmitButton>
                  </DialogFooter>
                </ActionForm>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{role.name}</p>
                  {role.description ? (
                    <p className="text-muted-foreground text-xs">
                      {role.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">
                    {role.assignmentCount} atribuição(ões)
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${role.name}`}
                    onClick={() => setEditingRole(role)}
                  >
                    <Pencil />
                  </Button>
                  <ActionForm action={deleteRoleAction} id={`delete-role-${role.id}`}>
                    <input type="hidden" name="roleId" value={role.id} />
                  </ActionForm>
                  <ConfirmSubmit
                    formId={`delete-role-${role.id}`}
                    aria-label={`Excluir ${role.name}`}
                    title={`Excluir o papel "${role.name}"?`}
                    description="A exclusão é permanente. Papéis com atribuições ativas são recusados pelo servidor — remova as atribuições primeiro."
                  >
                    <Trash2 />
                  </ConfirmSubmit>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {role.permissionIds.length === 0 ? (
                  <span className="text-muted-foreground text-xs">
                    Sem permissões — quem tem só este papel não vê nada.
                  </span>
                ) : (
                  role.permissionIds.map((permissionId) => (
                    <Badge key={permissionId} variant="outline" className="font-mono text-[11px]">
                      {permissionByIdKey.get(permissionId) ?? permissionId}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          ))}

          {roles.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhum papel cadastrado.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Permissões ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Permissões</CardTitle>
              <CardDescription>
                As chaves conhecidas pelo código são{" "}
                <code className="font-mono text-xs">document:read</code>,{" "}
                <code className="font-mono text-xs">document:create</code>,{" "}
                <code className="font-mono text-xs">document:edit</code> e{" "}
                <code className="font-mono text-xs">department:manage</code>.
              </CardDescription>
            </div>

            <Dialog open={createPermissionOpen} onOpenChange={setCreatePermissionOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus />
                  Nova
                </Button>
              </DialogTrigger>
              <DialogContent>
                <ActionForm
                  action={createPermissionAction}
                  onSuccess={() => setCreatePermissionOpen(false)}
                >
                  <DialogHeader>
                    <DialogTitle>Nova permissão</DialogTitle>
                    <DialogDescription>
                      Uma chave nova só passa a ter efeito quando o código
                      passar a verificá-la.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="permission-key">Chave</Label>
                      <Input
                        id="permission-key"
                        name="key"
                        placeholder="document:publish"
                        pattern="[a-z][a-z0-9-]*:[a-z][a-z0-9-]*"
                        required
                        className="font-mono"
                      />
                      <p className="text-muted-foreground text-xs">
                        Formato <code className="font-mono">recurso:acao</code>,
                        tudo em minúsculas.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permission-description">Descrição</Label>
                      <Input
                        id="permission-description"
                        name="description"
                        maxLength={200}
                        placeholder="O que esta permissão libera"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <SubmitButton pendingLabel="Criando…">Criar permissão</SubmitButton>
                  </DialogFooter>
                </ActionForm>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {permissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-start justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <code className="text-sm font-medium">{permission.key}</code>
                {permission.description ? (
                  <p className="text-muted-foreground text-xs">
                    {permission.description}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-1 text-xs">
                  Usada em {permission.roleCount} papel(éis)
                </p>
              </div>
              <ActionForm
                action={deletePermissionAction}
                id={`delete-permission-${permission.id}`}
              >
                <input type="hidden" name="permissionId" value={permission.id} />
              </ActionForm>
              <ConfirmSubmit
                formId={`delete-permission-${permission.id}`}
                aria-label={`Excluir ${permission.key}`}
                title={`Excluir a permissão "${permission.key}"?`}
                description={`Ela será removida dos ${permission.roleCount} papel(éis) que a usam, e quem depende dela perde o acesso imediatamente. Não há como desfazer.`}
              >
                <Trash2 />
              </ConfirmSubmit>
            </div>
          ))}

          {permissions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              <KeyRound className="mx-auto mb-2 size-5" />
              Nenhuma permissão cadastrada.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {editingRole ? (
        <Dialog open onOpenChange={(open) => !open && setEditingRole(null)}>
          <DialogContent>
            <ActionForm
              action={updateRoleAction}
              onSuccess={() => setEditingRole(null)}
            >
              <input type="hidden" name="roleId" value={editingRole.id} />
              <DialogHeader>
                <DialogTitle>Editar papel</DialogTitle>
                <DialogDescription>
                  A mudança vale imediatamente para todos os{" "}
                  {editingRole.assignmentCount} acesso(s) que usam este papel.
                </DialogDescription>
              </DialogHeader>
              <RoleFields permissions={permissions} role={editingRole} />
              <DialogFooter>
                <SubmitButton>Salvar</SubmitButton>
              </DialogFooter>
            </ActionForm>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function RoleFields({
  permissions,
  role,
}: {
  permissions: AdminPermission[];
  role?: AdminRole;
}) {
  const selected = new Set(role?.permissionIds ?? []);
  const idPrefix = role?.id ?? "new";

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`role-name-${idPrefix}`}>Nome</Label>
        <Input
          id={`role-name-${idPrefix}`}
          name="name"
          defaultValue={role?.name}
          placeholder="Editor"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`role-description-${idPrefix}`}>Descrição</Label>
        <Input
          id={`role-description-${idPrefix}`}
          name="description"
          defaultValue={role?.description ?? ""}
          maxLength={200}
          placeholder="Lê, cria e edita documentações do departamento"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Permissões</legend>
        {permissions.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Nenhuma permissão cadastrada ainda.
          </p>
        ) : (
          permissions.map((permission) => (
            <div key={permission.id} className="flex items-start gap-3">
              <Checkbox
                id={`perm-${idPrefix}-${permission.id}`}
                name="permissionIds"
                value={permission.id}
                defaultChecked={selected.has(permission.id)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={`perm-${idPrefix}-${permission.id}`}
                  className="font-mono text-xs"
                >
                  {permission.key}
                </Label>
                {permission.description ? (
                  <p className="text-muted-foreground text-xs">
                    {permission.description}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </fieldset>
    </div>
  );
}
