import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ListChecks, Pencil, Plus, Share2, TriangleAlert } from "lucide-react";

import { DepartmentResponsibilitiesView } from "@/components/department-responsibilities-view";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveResponsibilities } from "@/lib/department-responsibilities";
import {
  readDepartmentResponsibilities,
  responsibilitiesRelativePath,
} from "@/lib/department-responsibilities-file";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, can, requireDepartmentAccess } from "@/lib/rbac";

export const metadata: Metadata = { title: "Responsabilidades do departamento" };
export const dynamic = "force-dynamic";

function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

export default async function DepartmentResponsibilitiesPage({
  params,
}: PageProps<"/departamentos/[slug]/responsabilidades">) {
  const { slug } = await params;
  const { access } = await requireDepartmentAccess(slug);

  const canManage = can(access, PERMISSIONS.departmentManage);
  const base = `/departamentos/${access.department.slug}`;
  const filePath = responsibilitiesRelativePath(access.department.slug);

  const [result, documents] = await Promise.all([
    readDepartmentResponsibilities(access.department.slug),
    prisma.document.findMany({
      where: { departmentId: access.department.id, isOrphan: false },
      select: { slug: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const responsibilities =
    result.status === "ok"
      ? resolveResponsibilities(result.responsibilities, documents)
      : null;

  return (
    <main>
        <nav
          aria-label="Trilha de navegação"
          className="text-muted-foreground print:hidden mb-4 flex flex-wrap items-center gap-1 text-xs"
        >
          <BackLink href={base} />
          <Link href="/" className="hover:text-foreground">
            Departamentos
          </Link>
        <ChevronRight className="size-3" />
        <Link href={base} className="hover:text-foreground">
          {access.department.name}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Responsabilidades</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            Responsabilidades de {access.department.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {responsibilities
              ? `${plural(responsibilities.itemCount, "responsabilidade", "responsabilidades")} em ${plural(responsibilities.areas.length, "frente", "frentes")}${
                  responsibilities.uncoveredCount > 0
                    ? ` · ${responsibilities.uncoveredCount} sem documentação`
                    : ""
                }`
              : "O que este departamento faz, e quais documentações cobrem cada responsabilidade."}
          </p>
        </div>

        {responsibilities ? (
          <div className="print:hidden flex flex-wrap items-center gap-2">
            <PrintButton />
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/diagrama`}>
                <Share2 />
                Diagrama
              </Link>
            </Button>
            {canManage ? (
              <Button asChild size="sm">
                <Link href={`${base}/responsabilidades/editar`}>
                  <Pencil />
                  Editar
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {result.status === "invalid" ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>O arquivo não pôde ser lido</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{result.error}</p>
            <p>
              Corrija <code className="font-mono">{filePath}</code> direto no disco. O
              editor fica indisponível enquanto o arquivo estiver inválido — abri-lo
              mostraria uma lista vazia e salvar por cima apagaria o que está lá.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {result.status === "missing" ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
              <ListChecks className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">
                Este departamento ainda não mapeou suas responsabilidades
              </p>
              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                {canManage
                  ? "O mapa mostra as frentes do departamento, quem responde por cada responsabilidade e quais documentações cobrem cada uma — inclusive as que ainda não têm nenhuma."
                  : "Assim que alguém que administra este departamento montar o mapa, ele aparece aqui."}
              </p>
            </div>
            {canManage ? (
              <Button asChild className="mt-1">
                <Link href={`${base}/responsabilidades/editar`}>
                  <Plus />
                  Mapear responsabilidades
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {responsibilities ? (
        <DepartmentResponsibilitiesView
          responsibilities={responsibilities}
          departmentSlug={access.department.slug}
        />
      ) : null}

      {responsibilities && responsibilities.missingDocCount > 0 ? (
        <p className="text-muted-foreground print:hidden mt-6 text-xs">
          {plural(responsibilities.missingDocCount, "vínculo aponta", "vínculos apontam")}{" "}
          para documentações que não existem mais neste departamento. Elas voltam sozinhas
          se o arquivo correspondente voltar para a pasta.
        </p>
      ) : null}
    </main>
  );
}
