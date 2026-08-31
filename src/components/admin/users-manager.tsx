"use client";

import { useState } from "react";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Power,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import {
  assignRoleAction,
  bulkCreateUsersAction,
  createUserAction,
  deleteUserAction,
  removeRoleAction,
  resetPasswordAction,
  toggleUserActiveAction,
  updateUserAction,
} from "@/actions/admin";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Assignment = {
  id: string;
  departmentName: string;
  departmentIsOrphan: boolean;
  roleName: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  isCurrentUser: boolean;
  createdAt: string;
  assignments: Assignment[];
};

type Option = { id: string; name: string };

type DialogKind = "edit" | "password" | "access";

export function UsersManager({
  users,
  departments,
  roles,
}: {
  users: AdminUser[];
  departments: Option[];
  roles: Option[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createIsSuperAdmin, setCreateIsSuperAdmin] = useState(false);
  const [openDialog, setOpenDialog] = useState<{
    kind: DialogKind;
    user: AdminUser;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const close = () => setOpenDialog(null);
  const defaultRole = roles.find((role) => role.name === "Editor") ?? roles[0];

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      user.name.toLowerCase().includes(normalizedSearch) ||
      user.email.toLowerCase().includes(normalizedSearch);

    const matchesDepartment =
      departmentFilter === "all" ||
      user.assignments.some((assignment) => assignment.departmentName === departmentFilter);

    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {filteredUsers.length === users.length
            ? `${users.length} usuário(s) cadastrado(s).`
            : `${filteredUsers.length} de ${users.length} usuário(s).`}
        </p>

        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateIsSuperAdmin(false);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus />
              Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <ActionForm
              action={createUserAction}
              onSuccess={() => {
                setCreateOpen(false);
                setCreateIsSuperAdmin(false);
              }}
            >
              <DialogHeader>
                <DialogTitle>Novo usuário</DialogTitle>
                <DialogDescription>
                  O usuário entra com usuário e senha. Todo usuário comum
                  precisa de ao menos um departamento — sem isso ele entra e
                  não vê nada.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <UserFields />
                <div className="space-y-2">
                  <Label htmlFor="new-password">Senha inicial</Label>
                  <Input
                    id="new-password"
                    name="password"
                    type="text"
                    minLength={8}
                    required
                    placeholder="Mínimo de 8 caracteres"
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="new-superadmin"
                    name="isSuperAdmin"
                    checked={createIsSuperAdmin}
                    onCheckedChange={(checked) => setCreateIsSuperAdmin(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="new-superadmin">Administrador geral</Label>
                    <p className="text-muted-foreground text-xs">
                      Acesso irrestrito a todos os departamentos e ao /admin.
                      Marcando isto, os departamentos abaixo ficam desnecessários.
                    </p>
                  </div>
                </div>

                {!createIsSuperAdmin ? (
                  <DepartmentRoleFields
                    idPrefix="new"
                    departments={departments}
                    roles={roles}
                    defaultRole={defaultRole}
                  />
                ) : null}
              </div>

              <DialogFooter>
                <SubmitButton pendingLabel="Criando…">Criar usuário</SubmitButton>
              </DialogFooter>
            </ActionForm>
          </DialogContent>
        </Dialog>

        <BulkCreateDialog departments={departments} roles={roles} defaultRole={defaultRole} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou usuário…"
          className="max-w-xs"
          aria-label="Buscar usuário"
        />
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-48" aria-label="Filtrar por departamento">
            <SelectValue placeholder="Todos os departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.name}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Acessos por departamento</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Nenhum usuário encontrado para esse filtro.
                  </TableCell>
                </TableRow>
              ) : null}
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className={user.isActive ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    {user.isSuperAdmin ? (
                      <Badge variant="secondary">
                        <ShieldCheck className="size-3" />
                        Todos os departamentos
                      </Badge>
                    ) : user.assignments.length === 0 ? (
                      <span className="text-muted-foreground text-xs">
                        Nenhum acesso — vê a home vazia
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.assignments.map((assignment) => (
                          <Badge
                            key={assignment.id}
                            variant="outline"
                            className={
                              assignment.departmentIsOrphan ? "opacity-50" : undefined
                            }
                          >
                            {assignment.departmentName} · {assignment.roleName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "destructive"}>
                      {user.isActive ? "Ativo" : "Desativado"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setOpenDialog({ kind: "edit", user })}
                          >
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setOpenDialog({ kind: "password", user })}
                          >
                            <KeyRound />
                            Redefinir senha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setOpenDialog({ kind: "access", user })}
                          >
                            <Users />
                            Gerenciar acessos
                          </DropdownMenuItem>
                          <ToggleActiveItem user={user} />
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {user.isCurrentUser ? null : (
                        <>
                          <ActionForm action={deleteUserAction} id={`delete-user-${user.id}`}>
                            <input type="hidden" name="userId" value={user.id} />
                          </ActionForm>
                          <ConfirmSubmit
                            formId={`delete-user-${user.id}`}
                            className="text-destructive hover:text-destructive"
                            aria-label="Excluir usuário"
                            title={`Excluir ${user.name}?`}
                            description="A conta é removida permanentemente, junto com todos os acessos por departamento. Documentações criadas por esta pessoa continuam publicadas, só deixam de mostrar o nome do autor. Não pode ser desfeito."
                            confirmLabel="Excluir permanentemente"
                          >
                            <Trash2 />
                          </ConfirmSubmit>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {openDialog?.kind === "edit" ? (
        <EditUserDialog user={openDialog.user} onClose={close} />
      ) : null}
      {openDialog?.kind === "password" ? (
        <ResetPasswordDialog user={openDialog.user} onClose={close} />
      ) : null}
      {openDialog?.kind === "access" ? (
        <AccessDialog
          user={openDialog.user}
          departments={departments}
          roles={roles}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function UserFields({ user }: { user?: AdminUser }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`name-${user?.id ?? "new"}`}>Nome</Label>
        <Input
          id={`name-${user?.id ?? "new"}`}
          name="name"
          defaultValue={user?.name}
          required
          placeholder="Maria Silva"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`email-${user?.id ?? "new"}`}>Usuário</Label>
        <Input
          id={`email-${user?.id ?? "new"}`}
          name="email"
          type="text"
          defaultValue={user?.email}
          required
          placeholder="maria.silva"
        />
      </div>
    </>
  );
}

function DepartmentRoleFields({
  idPrefix,
  departments,
  roles,
  defaultRole,
}: {
  idPrefix: string;
  departments: Option[];
  roles: Option[];
  defaultRole?: Option;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-2">
        <Label>
          Departamento{departments.length !== 1 ? "s" : ""}{" "}
          <span className="text-destructive">*</span>
        </Label>
        {departments.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Nenhum departamento cadastrado ainda — crie um antes de cadastrar
            usuários comuns.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <div key={department.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-dept-${department.id}`}
                  name="departmentIds"
                  value={department.id}
                />
                <Label
                  htmlFor={`${idPrefix}-dept-${department.id}`}
                  className="text-sm font-normal"
                >
                  {department.name}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-default-role`}>Papel nesses departamentos</Label>
        <select
          id={`${idPrefix}-default-role`}
          name="defaultRoleId"
          required
          defaultValue={defaultRole?.id ?? ""}
          className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Padrão recomendado: <strong>Editor</strong> — cria e edita
          documentações, sem poder excluir nem gerenciar acessos. Ajuste
          depois em &ldquo;Gerenciar acessos&rdquo; se precisar.
        </p>
      </div>
    </div>
  );
}

function BulkCreateDialog({
  departments,
  roles,
  defaultRole,
}: {
  departments: Option[];
  roles: Option[];
  defaultRole?: Option;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UsersRound />
          Criar em massa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <ActionForm action={bulkCreateUsersAction} onSuccess={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Criar usuários em massa</DialogTitle>
            <DialogDescription>
              Todos entram com a senha padrão <strong>mudeasenha</strong> e
              precisam trocá-la no primeiro acesso. Todos recebem os mesmos
              departamentos e o mesmo papel — ajuste individualmente depois em
              &ldquo;Gerenciar acessos&rdquo; se precisar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-lines">Lista de usuários</Label>
              <Textarea
                id="bulk-lines"
                name="lines"
                required
                rows={8}
                placeholder={"Maria Silva;maria.silva\nJoão Souza;joao.souza"}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Uma pessoa por linha, no formato{" "}
                <code>Nome completo;usuario</code>.
              </p>
            </div>

            <DepartmentRoleFields
              idPrefix="bulk"
              departments={departments}
              roles={roles}
              defaultRole={defaultRole}
            />
          </div>

          <DialogFooter>
            <SubmitButton pendingLabel="Criando…">Criar usuários</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxField({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

function ToggleActiveItem({ user }: { user: AdminUser }) {
  return (
    <ActionForm action={toggleUserActiveAction}>
      <input type="hidden" name="userId" value={user.id} />
      <DropdownMenuItem asChild variant={user.isActive ? "destructive" : "default"}>
        <button type="submit" className="w-full">
          <Power />
          {user.isActive ? "Desativar" : "Reativar"}
        </button>
      </DropdownMenuItem>
    </ActionForm>
  );
}

function EditUserDialog({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <ActionForm action={updateUserAction} onSuccess={onClose}>
          <input type="hidden" name="userId" value={user.id} />
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <UserFields user={user} />
            <CheckboxField
              id={`superadmin-${user.id}`}
              name="isSuperAdmin"
              label="Administrador geral"
              hint="Acesso irrestrito a todos os departamentos e ao /admin."
              defaultChecked={user.isSuperAdmin}
            />
            <CheckboxField
              id={`active-${user.id}`}
              name="isActive"
              label="Ativo"
              hint="Usuários desativados não conseguem entrar."
              defaultChecked={user.isActive}
            />
          </div>

          <DialogFooter>
            <SubmitButton>Salvar</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <ActionForm action={resetPasswordAction} onSuccess={onClose}>
          <input type="hidden" name="userId" value={user.id} />
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              A senha de {user.name} será substituída imediatamente. Combine a
              troca com a pessoa antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`password-${user.id}`}>Nova senha</Label>
            <Input
              id={`password-${user.id}`}
              name="password"
              type="text"
              minLength={8}
              required
              placeholder="Mínimo de 8 caracteres"
            />
          </div>

          <DialogFooter>
            <SubmitButton pendingLabel="Redefinindo…">Redefinir</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({
  user,
  departments,
  roles,
  onClose,
}: {
  user: AdminUser;
  departments: Option[];
  roles: Option[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acessos de {user.name}</DialogTitle>
          <DialogDescription>
            Um usuário pode acumular vários papéis, em vários departamentos. As
            permissões se somam dentro de cada departamento.
          </DialogDescription>
        </DialogHeader>

        {user.isSuperAdmin ? (
          <p className="text-muted-foreground py-2 text-sm">
            Este usuário é administrador geral e já enxerga todos os
            departamentos. Papéis atribuídos aqui só passam a valer se o
            privilégio de administrador for removido.
          </p>
        ) : null}

        <div className="space-y-2 py-2">
          {user.assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum papel atribuído ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {user.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">{assignment.departmentName}</span>
                    <span className="text-muted-foreground"> · {assignment.roleName}</span>
                    {assignment.departmentIsOrphan ? (
                      <Badge variant="outline" className="ml-2">
                        órfão
                      </Badge>
                    ) : null}
                  </div>
                  <ActionForm action={removeRoleAction}>
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <SubmitButton
                      variant="ghost"
                      size="icon"
                      aria-label="Remover papel"
                      pendingLabel="…"
                    >
                      <X />
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ActionForm action={assignRoleAction} className="border-t pt-4">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor={`department-${user.id}`}>Departamento</Label>
              <select
                id={`department-${user.id}`}
                name="departmentId"
                required
                className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Selecione…</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`role-${user.id}`}>Papel</Label>
              <select
                id={`role-${user.id}`}
                name="roleId"
                required
                className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Selecione…</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton pendingLabel="…">Atribuir</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
