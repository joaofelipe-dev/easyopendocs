import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileText, FilePlus2, Inbox } from "lucide-react";

import { SearchBox } from "@/components/search-box";
import { ReviewBadge } from "@/components/review-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, can, requireDepartmentAccess } from "@/lib/rbac";
import { reviewStatus, type ReviewStatus } from "@/lib/review-cycle";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/departamentos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const department = await prisma.department.findUnique({
    where: { slug },
    select: { name: true },
  });

  return { title: department?.name ?? "Departamento" };
}

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function DepartmentPage({
  params,
  searchParams,
}: PageProps<"/departamentos/[slug]">) {
  const { slug } = await params;
  const { access } = await requireDepartmentAccess(slug);
  const query = await searchParams;

  const rows = await prisma.document.findMany({
    where: { departmentId: access.department.id, isOrphan: false },
    orderBy: { title: "asc" },
  });

  const documents = rows.map((document) => ({
    ...document,
    review: reviewStatus({
      documentIntervalDays: document.reviewIntervalDays,
      departmentIntervalDays: access.department.reviewIntervalDays,
      lastReviewedAt: document.lastReviewedAt,
      // Sem `reviewedAt` no arquivo, a última alteração conta como revisão.
      fallbackDate: document.fileMtime,
    }) satisfies ReviewStatus,
  }));

  const overdueCount = documents.filter((d) => d.review.kind === "overdue").length;
  const onlyOverdue = query.revisao === "vencidas";
  const visible = onlyOverdue
    ? documents.filter((d) => d.review.kind === "overdue")
    : documents;

  const canCreate = can(access, PERMISSIONS.documentCreate);

  return (
    <main>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="min-w-0">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-widest">Departamento</p>
          <h1 className="text-3xl font-semibold tracking-tight break-words">
            {access.department.name}
          </h1>
          {access.department.description ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {access.department.description}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {access.isSuperAdmin ? (
              <Badge variant="outline">Administrador geral</Badge>
            ) : (
              access.roleNames.map((roleName) => (
                <Badge key={roleName} variant="outline">
                  {roleName}
                </Badge>
              ))
            )}
          </div>
        </div>

        {canCreate ? (
          <Button asChild>
            <Link href={`/departamentos/${access.department.slug}/nova-documentacao`}>
              <FilePlus2 />
              Nova documentação
            </Link>
          </Button>
        ) : null}
      </header>

      <section aria-label="Encontrar documentação" className="mb-6 space-y-4">
      {documents.length > 0 ? (
        <SearchBox
          departmentSlug={access.department.slug}
          placeholder={`Buscar em ${access.department.name}…`}
          className="max-w-xl"
        />
      ) : null}

      {overdueCount > 0 || onlyOverdue ? (
        <nav aria-label="Filtrar por revisão" className="flex flex-wrap gap-2">
          <FilterChip
            href={`/departamentos/${access.department.slug}`}
            active={!onlyOverdue}
          >
            Todas ({documents.length})
          </FilterChip>
          <FilterChip
            href={`/departamentos/${access.department.slug}?revisao=vencidas`}
            active={onlyOverdue}
          >
            Revisão vencida ({overdueCount})
          </FilterChip>
        </nav>
      ) : null}
      </section>

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
              <Inbox className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">Nenhuma documentação por aqui</p>
              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                {canCreate
                  ? "Use Nova documentação para compartilhar o primeiro guia ou processo da equipe."
                  : "Assim que alguém publicar uma documentação neste departamento, ela aparece aqui."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <h2 className="font-semibold">Nenhuma revisão vencida</h2>
          <p className="text-muted-foreground mt-2 text-sm">As documentações deste departamento estão em dia com o ciclo de revisão.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/departamentos/${access.department.slug}`}>Ver todas as documentações</Link>
          </Button>
        </div>
      ) : (
        <section aria-labelledby="document-list-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="document-list-title" className="text-sm font-semibold">{onlyOverdue ? "Para revisar" : "Documentações"}</h2>
          <span className="text-muted-foreground text-xs tabular-nums">{visible.length} {visible.length === 1 ? "documentação" : "documentações"}</span>
        </div>
        <ul className="bg-card divide-y overflow-hidden rounded-xl border">
          {visible.map((document) => (
            <li key={document.id}>
              <Link
                href={`/departamentos/${access.department.slug}/${document.slug}`}
                className="group hover:bg-muted/60 focus-visible:ring-ring flex min-w-0 items-start gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none sm:gap-4 sm:p-5"
              >
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-medium leading-snug break-words group-hover:underline group-hover:underline-offset-4">
                      {document.title}
                    </h3>
                    {document.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm break-words">
                        {document.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <p className="text-muted-foreground text-xs">Atualizado em {DATE_FORMAT.format(document.fileMtime)}</p>
                      <ReviewBadge status={document.review} />
                    </div>
                </div>
                <ArrowUpRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        </section>
      )}
    </main>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "bg-primary text-primary-foreground inline-flex min-h-9 items-center rounded-lg border border-transparent px-3 py-1 text-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex min-h-9 items-center rounded-lg border px-3 py-1 text-sm transition-colors"
      }
    >
      {children}
    </Link>
  );
}
