import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ListChecks, Share2, TriangleAlert } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { ResponsibilitiesDiagram } from "@/components/responsibilities-diagram";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveResponsibilities } from "@/lib/department-responsibilities";
import {
  readDepartmentResponsibilities,
  responsibilitiesRelativePath,
} from "@/lib/department-responsibilities-file";
import { prisma } from "@/lib/prisma";
import { buildResponsibilitiesGraph } from "@/lib/responsibilities-graph";
import { requireDepartmentAccess } from "@/lib/rbac";

export const metadata: Metadata = { title: "Diagrama de responsabilidades" };
export const dynamic = "force-dynamic";

function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

export default async function DepartmentDiagramPage({
  params,
}: PageProps<"/departamentos/[slug]/diagrama">) {
  const { slug } = await params;
  const { access } = await requireDepartmentAccess(slug);

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

  const resolved =
    result.status === "ok"
      ? resolveResponsibilities(result.responsibilities, documents)
      : null;
  const graph = resolved ? buildResponsibilitiesGraph(resolved) : null;

  return (
    <main>
      <nav
        aria-label="Trilha de navegação"
        className="text-muted-foreground print:hidden mb-4 flex flex-wrap items-center gap-1 text-xs"
      >
        <BackLink href={`${base}/responsabilidades`} />
        <Link href="/" className="hover:text-foreground">
          Departamentos
        </Link>
        <ChevronRight className="size-3" />
        <Link href={base} className="hover:text-foreground">
          {access.department.name}
        </Link>
        <ChevronRight className="size-3" />
        <Link href={`${base}/responsabilidades`} className="hover:text-foreground">
          Responsabilidades
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Diagrama</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            Diagrama de {access.department.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {graph
              ? `${plural(graph.nodes.length, "responsabilidade", "responsabilidades")} em ${plural(
                  graph.columns.length,
                  "frente",
                  "frentes",
                )} · ${plural(graph.edges.length, "entrega mapeada", "entregas mapeadas")}`
              : "Quem entrega para quem, dentro do departamento."}
          </p>
        </div>

        {graph ? (
          <div className="print:hidden flex flex-wrap items-center gap-2">
            <PrintButton />
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/responsabilidades`}>
                <ListChecks />
                Ver em lista
              </Link>
            </Button>
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
              Corrija <code className="font-mono">{filePath}</code> direto no disco.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {result.status === "missing" ? (
        <EmptyState
          title="Este departamento ainda não mapeou suas responsabilidades"
          description="O diagrama desenha o mapa de responsabilidades. Monte o mapa primeiro e as setas aparecem aqui."
          href={`${base}/responsabilidades`}
        />
      ) : null}

      {graph && graph.nodes.length === 0 ? (
        <EmptyState
          title="O mapa está vazio"
          description="Não há nenhuma responsabilidade para desenhar ainda."
          href={`${base}/responsabilidades`}
        />
      ) : null}

      {graph && graph.nodes.length > 0 ? (
        <>
          {graph.edges.length === 0 ? (
            <Alert className="print:hidden mb-4">
              <Share2 />
              <AlertTitle>Nenhuma entrega mapeada ainda</AlertTitle>
              <AlertDescription>
                <p>
                  Os blocos aparecem, mas sem setas: nenhuma responsabilidade
                  declarou para quem entrega. Preencha{" "}
                  <code className="font-mono">deliversTo</code> em{" "}
                  <code className="font-mono">{filePath}</code> para as ligações
                  aparecerem.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          <ResponsibilitiesDiagram
            graph={graph}
            departmentSlug={access.department.slug}
          />

          <Legend />
        </>
      ) : null}
    </main>
  );
}

function Legend() {
  return (
    <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
      <span className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            width="25"
            height="9"
            rx="3"
            className="fill-card stroke-border"
          />
        </svg>
        Responsabilidade com documentação
      </span>
      <span className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            width="25"
            height="9"
            rx="3"
            className="fill-card stroke-muted-foreground/50 [stroke-dasharray:4_3]"
          />
        </svg>
        Sem documentação
      </span>
      <span className="flex items-center gap-2">
        <svg width="26" height="10" aria-hidden>
          <path
            d="M 1 5 L 22 5"
            className="stroke-muted-foreground/70"
            strokeWidth="1.5"
          />
          <path d="M 20 2 L 25 5 L 20 8 z" className="fill-muted-foreground" />
        </svg>
        Entrega para
      </span>
      <span className="print:hidden">
        Passe o mouse num bloco para destacar só as ligações dele.
      </span>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
          <Share2 className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {description}
          </p>
        </div>
        <Button asChild variant="outline" className="mt-1">
          <Link href={href}>
            <ListChecks />
            Ir para as responsabilidades
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
