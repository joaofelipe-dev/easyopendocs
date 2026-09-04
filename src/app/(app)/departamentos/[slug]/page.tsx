import type { Metadata } from "next";
import Link from "next/link";
import { FileText, FilePlus2, Inbox } from "lucide-react";

import { SearchBox } from "@/components/search-box";
import { ReviewBadge } from "@/components/review-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
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
            {access.isSuperAdmin ? (
              <code className="text-muted-foreground text-xs">
                {access.department.path}/
              </code>
            ) : null}
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

      {documents.length > 0 ? (
        <SearchBox
          departmentSlug={access.department.slug}
          placeholder={`Buscar em ${access.department.name}…`}
          className="mb-6 max-w-md"
        />
      ) : null}

      {overdueCount > 0 ? (
        <nav aria-label="Filtrar por revisão" className="mb-6 flex flex-wrap gap-2">
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
                  ? "Crie a primeira pela UI ou coloque um arquivo .html na pasta do departamento — ele aparece automaticamente."
                  : "Assim que alguém publicar uma documentação neste departamento, ela aparece aqui."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((document) => (
            <li key={document.id}>
              <Link
                href={`/departamentos/${access.department.slug}/${document.slug}`}
                className="focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Card className="hover:border-foreground/20 h-full gap-3 transition-colors">
                  <CardHeader>
                    <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                      <FileText className="size-4" />
                    </span>
                    <CardTitle className="mt-2 text-base leading-snug">
                      {document.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {document.description ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {document.description}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      Atualizado em {DATE_FORMAT.format(document.fileMtime)}
                    </p>
                    <ReviewBadge status={document.review} />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
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
          ? "bg-primary text-primary-foreground rounded-full border border-transparent px-3 py-1 text-xs"
          : "text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border px-3 py-1 text-xs transition-colors"
      }
    >
      {children}
    </Link>
  );
}
