"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderPlus, Pencil, Trash2, TriangleAlert } from "lucide-react";

import {
  createDepartmentAction,
  deleteDepartmentAction,
  purgeOrphanDepartmentAction,
  updateDepartmentAction,
} from "@/actions/admin";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { slugify } from "@/lib/slug";

export type AdminDepartment = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  path: string;
  isOrphan: boolean;
  documentCount: number;
  memberCount: number;
};

export function DepartmentsManager({
  departments,
  contentRoot,
}: {
  departments: AdminDepartment[];
  contentRoot: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDepartment | null>(null);
  const [name, setName] = useState("");

  const previewSlug = slugify(name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Cada departamento é uma pasta em{" "}
          <code className="font-mono text-xs">{contentRoot}/</code>. Criar aqui
          cria a pasta no disco.
        </p>

        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setName("");
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <FolderPlus />
              Novo departamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <ActionForm
              action={createDepartmentAction}
              onSuccess={() => {
                setCreateOpen(false);
                setName("");
              }}
            >
              <DialogHeader>
                <DialogTitle>Novo departamento</DialogTitle>
                <DialogDescription>
                  Cria a pasta e o arquivo de metadados. Depois é só colocar os
                  arquivos <code className="font-mono">.html</code> dentro dela.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="dep-name">Nome</Label>
                  <Input
                    id="dep-name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Financeiro"
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Pasta:{" "}
                    <code className="font-mono break-all">
                      {contentRoot}/{previewSlug || "…"}/
                    </code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dep-description">
                    Descrição{" "}
                    <span className="text-muted-foreground font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="dep-description"
                    name="description"
                    placeholder="Processos, prestação de contas e reembolsos"
                    maxLength={300}
                  />
                </div>
              </div>

              <DialogFooter>
                <SubmitButton pendingLabel="Criando…">Criar departamento</SubmitButton>
              </DialogFooter>
            </ActionForm>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead className="w-32">Pasta</TableHead>
                <TableHead className="w-24 text-right">Docs</TableHead>
                <TableHead className="w-28 text-right">Acessos</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Nenhum departamento indexado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((department) => (
                  <TableRow key={department.id} className={department.isOrphan ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{department.name}</span>
                        {department.description ? (
                          <span className="text-muted-foreground text-xs">
                            {department.description}
                          </span>
                        ) : null}
                        {department.isOrphan ? (
                          <Badge variant="outline" className="w-fit">
                            <TriangleAlert className="size-3" />
                            pasta não existe mais
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-muted-foreground text-xs">
                        {department.slug}/
                      </code>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {department.documentCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {department.memberCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {department.isOrphan ? (
                          <>
                            <ActionForm
                              action={purgeOrphanDepartmentAction}
                              id={`purge-department-${department.id}`}
                            >
                              <input
                                type="hidden"
                                name="departmentId"
                                value={department.id}
                              />
                            </ActionForm>
                            <ConfirmSubmit
                              formId={`purge-department-${department.id}`}
                              aria-label="Remover registro órfão"
                              title={`Descartar o registro de "${department.name}"?`}
                              description={`Isso apaga permanentemente o registro e os ${department.memberCount} acesso(s) atribuído(s). Se a pasta voltar ao disco depois, o departamento é recriado vazio, sem as permissões. Nenhum arquivo é tocado.`}
                              confirmLabel="Descartar registro"
                            >
                              <Trash2 />
                            </ConfirmSubmit>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Editar"
                              onClick={() => setEditing(department)}
                            >
                              <Pencil />
                            </Button>
                            <Button asChild variant="ghost" size="icon" aria-label="Abrir">
                              <Link href={`/departamentos/${department.slug}`}>
                                <ExternalLink />
                              </Link>
                            </Button>
                            <ActionForm
                              action={deleteDepartmentAction}
                              id={`delete-department-${department.id}`}
                            >
                              <input type="hidden" name="departmentId" value={department.id} />
                            </ActionForm>
                            <ConfirmSubmit
                              formId={`delete-department-${department.id}`}
                              className="text-destructive hover:text-destructive"
                              aria-label="Excluir departamento"
                              title={`Excluir "${department.name}" e toda a sua documentação?`}
                              description={`Isso apaga a pasta ${department.slug}/ do disco (${department.documentCount} documento(s)) e todos os ${department.memberCount} acesso(s) atribuído(s). Usuários que só tinham acesso a este departamento ficam sem nenhum — ajuste os acessos deles depois. Não pode ser desfeito.`}
                              confirmLabel="Excluir tudo"
                            >
                              <Trash2 />
                            </ConfirmSubmit>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert>
        <TriangleAlert />
        <AlertDescription>
          Excluir um departamento ativo apaga a pasta inteira do disco — toda a
          documentação dentro dela some junto, sem volta. Departamentos órfãos
          (pasta já removida por fora do portal) só descartam o registro; o
          disco nem é tocado.
        </AlertDescription>
      </Alert>

      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <ActionForm
              action={updateDepartmentAction}
              onSuccess={() => setEditing(null)}
            >
              <input type="hidden" name="slug" value={editing.slug} />
              <DialogHeader>
                <DialogTitle>Editar departamento</DialogTitle>
                <DialogDescription>
                  Grava em{" "}
                  <code className="font-mono break-all">
                    {editing.path}/_departamento.json
                  </code>
                  . O slug da pasta não muda — renomeá-la quebraria os links já
                  compartilhados.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor={`edit-name-${editing.id}`}>Nome</Label>
                  <Input
                    id={`edit-name-${editing.id}`}
                    name="name"
                    defaultValue={editing.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`edit-desc-${editing.id}`}>Descrição</Label>
                  <Input
                    id={`edit-desc-${editing.id}`}
                    name="description"
                    defaultValue={editing.description ?? ""}
                    maxLength={300}
                  />
                </div>
              </div>

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
