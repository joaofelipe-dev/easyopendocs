import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  FolderTree,
  KeyRound,
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Administração" };

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function AdminOverviewPage() {
  const [
    users,
    activeUsers,
    departments,
    orphanDepartments,
    documents,
    orphanDocuments,
    roles,
    permissions,
    assignments,
    lastSync,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.department.count({ where: { isOrphan: false } }),
    prisma.department.count({ where: { isOrphan: true } }),
    prisma.document.count({ where: { isOrphan: false } }),
    prisma.document.count({ where: { isOrphan: true } }),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.userDepartmentRole.count(),
    prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  const stats = [
    {
      label: "Usuários",
      value: users,
      detail: `${activeUsers} ativos`,
      href: "/admin/usuarios",
      icon: Users,
    },
    {
      label: "Departamentos",
      value: departments,
      detail: orphanDepartments > 0 ? `${orphanDepartments} órfão(s)` : "todos no disco",
      href: "/admin/departamentos",
      icon: FolderTree,
    },
    {
      label: "Documentações",
      value: documents,
      detail: orphanDocuments > 0 ? `${orphanDocuments} órfã(s)` : "todas no disco",
      href: "/admin/sync",
      icon: FileText,
    },
    {
      label: "Papéis",
      value: roles,
      detail: `${permissions} permissões · ${assignments} atribuições`,
      href: "/admin/papeis",
      icon: KeyRound,
    },
  ];

  const hasOrphans = orphanDepartments + orphanDocuments > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, detail, href, icon: Icon }) => (
          <Link key={label} href={href} className="rounded-xl">
            <Card className="hover:border-foreground/20 h-full gap-2 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    {label}
                  </CardTitle>
                  <Icon className="text-muted-foreground size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="size-4" />
              Última sincronização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {lastSync ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={lastSync.ok ? "secondary" : "destructive"}>
                    {lastSync.ok ? "Sucesso" : "Falha"}
                  </Badge>
                  <Badge variant="outline">{lastSync.trigger}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {DATE_TIME_FORMAT.format(lastSync.startedAt)} ·{" "}
                    {lastSync.durationMs} ms
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {lastSync.documentsCreated} criado(s) ·{" "}
                  {lastSync.documentsUpdated} atualizado(s) ·{" "}
                  {lastSync.documentsSkipped} inalterado(s) ·{" "}
                  {lastSync.documentsOrphaned} órfão(s)
                </p>
                {lastSync.error ? (
                  <p className="text-destructive text-xs">{lastSync.error}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                Nenhuma sincronização registrada ainda.
              </p>
            )}
            <Link
              href="/admin/sync"
              className="inline-block text-xs underline underline-offset-4"
            >
              Ver histórico completo
            </Link>
          </CardContent>
        </Card>

        <Card className={hasOrphans ? "border-amber-500/40" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4" />
              Conteúdo órfão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hasOrphans ? (
              <>
                <p>
                  {orphanDepartments} departamento(s) e {orphanDocuments}{" "}
                  documentação(ões) estão no banco mas não no disco.
                </p>
                <p className="text-muted-foreground text-xs">
                  Nada foi apagado — as permissões continuam guardadas caso os
                  arquivos voltem.
                </p>
                <Link
                  href="/admin/sync"
                  className="inline-block text-xs underline underline-offset-4"
                >
                  Revisar órfãos
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">
                Nenhum órfão: o banco e o filesystem estão em sincronia.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
