import Link from "next/link";
import { ArrowRight, FolderOpen, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncContent } from "@/lib/content-sync";
import { listAccessibleDepartments, requireUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();

  // Descoberta automática: abrir a home já reflete pastas/arquivos novos.
  await syncContent({ trigger: "AUTOMATIC" });

  const departments = await listAccessibleDepartments(user);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Departamentos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {user.isSuperAdmin
            ? "Como administrador geral, você tem acesso a todos os departamentos."
            : "Estes são os departamentos aos quais você tem acesso."}
        </p>
      </div>

      {departments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <Link
              key={department.id}
              href={`/departamentos/${department.slug}`}
              className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Card className="hover:border-foreground/20 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <FolderOpen className="size-4" />
                    </span>
                    <ArrowRight className="text-muted-foreground size-4" />
                  </div>
                  <CardTitle className="mt-3">{department.name}</CardTitle>
                  {department.description ? (
                    <p className="text-muted-foreground text-sm">
                      {department.description}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {department.documentCount}{" "}
                    {department.documentCount === 1
                      ? "documentação"
                      : "documentações"}
                  </Badge>
                  {department.roleNames.map((roleName) => (
                    <Badge key={roleName} variant="outline">
                      {roleName}
                    </Badge>
                  ))}
                  {user.isSuperAdmin ? (
                    <Badge variant="outline">Admin geral</Badge>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
          <Inbox className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Nenhum departamento disponível</p>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Você ainda não tem acesso a nenhum departamento. Peça ao
            administrador geral para atribuir um papel ao seu usuário.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
