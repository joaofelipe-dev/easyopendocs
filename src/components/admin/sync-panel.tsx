"use client";

import { FileWarning, FolderX, RefreshCw } from "lucide-react";

import { triggerSyncAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SyncLogEntry = {
  id: string;
  trigger: string;
  startedAt: string;
  durationMs: number;
  ok: boolean;
  error: string | null;
  departmentsCreated: number;
  departmentsUpdated: number;
  departmentsOrphaned: number;
  documentsCreated: number;
  documentsUpdated: number;
  documentsOrphaned: number;
  documentsSkipped: number;
};

export type OrphanDocument = {
  id: string;
  title: string;
  filePath: string;
  departmentName: string;
  updatedAt: string;
};

export type OrphanDepartment = {
  id: string;
  name: string;
  path: string;
  documentCount: number;
  memberCount: number;
};

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

const TRIGGER_LABELS: Record<string, string> = {
  AUTOMATIC: "automático",
  MANUAL: "manual",
  SEED: "seed",
  DOCUMENT_CREATE: "criação de doc",
};

export function SyncPanel({
  contentRoot,
  logs,
  orphanDocuments,
  orphanDepartments,
}: {
  contentRoot: string;
  logs: SyncLogEntry[];
  orphanDocuments: OrphanDocument[];
  orphanDepartments: OrphanDepartment[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronizar agora</CardTitle>
          <CardDescription>
            O sync roda sozinho ao abrir a home e a página de um departamento.
            Use os botões abaixo quando precisar forçar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <ActionForm action={triggerSyncAction}>
            <SubmitButton size="sm" pendingLabel="Sincronizando…">
              <RefreshCw />
              Sync incremental
            </SubmitButton>
          </ActionForm>

          <ActionForm action={triggerSyncAction}>
            <input type="hidden" name="force" value="1" />
            <SubmitButton variant="outline" size="sm" pendingLabel="Sincronizando…">
              <RefreshCw />
              Sync completo (relê todos os arquivos)
            </SubmitButton>
          </ActionForm>

          <span className="text-muted-foreground text-xs">
            Lendo de <code className="font-mono">{contentRoot}/</code>
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="size-4" />
              Documentações órfãs
            </CardTitle>
            <CardDescription>
              Indexadas no banco, mas o arquivo não está mais no disco. Se o
              arquivo voltar com o mesmo nome, elas voltam automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orphanDocuments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma.</p>
            ) : (
              <ul className="space-y-2">
                {orphanDocuments.map((document) => (
                  <li key={document.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{document.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {document.departmentName}
                    </p>
                    <code className="text-muted-foreground text-xs">
                      {document.filePath}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderX className="size-4" />
              Departamentos órfãos
            </CardTitle>
            <CardDescription>
              A pasta sumiu de {contentRoot}/. As permissões continuam
              guardadas; descarte o registro na aba Departamentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orphanDepartments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum.</p>
            ) : (
              <ul className="space-y-2">
                {orphanDepartments.map((department) => (
                  <li key={department.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{department.name}</p>
                    <code className="text-muted-foreground text-xs">
                      {department.path}/
                    </code>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {department.documentCount} doc(s) ·{" "}
                      {department.memberCount} acesso(s) preservado(s)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead className="w-32">Gatilho</TableHead>
                <TableHead className="w-24">Resultado</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead className="w-24 text-right">Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Nenhuma sincronização registrada.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {DATE_TIME_FORMAT.format(new Date(log.startedAt))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TRIGGER_LABELS[log.trigger] ?? log.trigger}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.ok ? "secondary" : "destructive"}>
                        {log.ok ? "ok" : "falha"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.error ? (
                        <span className="text-destructive">{log.error}</span>
                      ) : (
                        <>
                          +{log.documentsCreated} criado(s) · ~
                          {log.documentsUpdated} atualizado(s) ·{" "}
                          {log.documentsSkipped} inalterado(s) ·{" "}
                          {log.documentsOrphaned} órfão(s)
                          {log.departmentsCreated + log.departmentsOrphaned > 0 ? (
                            <span className="text-muted-foreground">
                              {" "}
                              | departamentos: +{log.departmentsCreated} /{" "}
                              {log.departmentsOrphaned} órfão(s)
                            </span>
                          ) : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {log.durationMs} ms
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
