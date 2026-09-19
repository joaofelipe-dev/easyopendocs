import Link from "next/link";
import { ArrowRight, BookOpen, FolderOpen, Inbox } from "lucide-react";

import { SearchBox } from "@/components/search-box";
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
  const documentCount = departments.reduce((total, department) => total + department.documentCount, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="grid gap-6 border-b pb-8 sm:pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-2xl">
          <p className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest">
            <BookOpen className="size-4" aria-hidden="true" /> Base de conhecimento
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Encontre o que você precisa saber.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-base leading-relaxed">
            Guias, processos e referências da sua equipe, organizados em um só lugar.
          </p>
          <SearchBox className="mt-6 max-w-xl" placeholder="Busque um assunto, processo ou documentação…" />
        </div>
        <dl className="flex gap-8 text-sm lg:border-l lg:pl-8">
          <div>
            <dt className="text-muted-foreground">Departamentos</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{departments.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documentações</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{documentCount}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="departments-title" className="pt-8">
        <div className="mb-5">
          <h2 id="departments-title" className="text-xl font-semibold tracking-tight">Explore por departamento</h2>
          <p className="text-muted-foreground mt-1 text-sm">Acesse os conteúdos disponíveis para você.</p>
        </div>

      {departments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <Link
              key={department.id}
              href={`/departamentos/${department.slug}`}
              className="group focus-visible:ring-ring min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Card className="h-full transition-colors group-hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <FolderOpen className="size-4" />
                    </span>
                    <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                  <CardTitle className="mt-3 text-lg break-words">{department.name}</CardTitle>
                  {department.description ? (
                    <p className="text-muted-foreground text-sm">
                      {department.description}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
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
      </section>
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
