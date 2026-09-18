import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, FileCheck2, Link2Off, ShieldAlert, UserRoundX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  documentHealthIssues,
  healthIssueLabel,
  type HealthIssue,
} from "@/lib/document-health";
import { prisma } from "@/lib/prisma";
import { reviewStatus } from "@/lib/review-cycle";

export const metadata: Metadata = { title: "Saúde da documentação" };
export const dynamic = "force-dynamic";

type HealthDocument = {
  id: string;
  title: string;
  slug: string;
  owner: string | null;
  criticality: string;
  contentStatus: string;
  description: string | null;
  issues: HealthIssue[];
  department: { slug: string; name: string };
};

export default async function DocumentationHealthPage() {
  const [departments, indexedLinks] = await Promise.all([
    prisma.department.findMany({
      where: { isOrphan: false },
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
        reviewIntervalDays: true,
        documents: {
          where: { isOrphan: false },
          orderBy: { title: "asc" },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            owner: true,
            criticality: true,
            contentStatus: true,
            reviewIntervalDays: true,
            lastReviewedAt: true,
            fileMtime: true,
          },
        },
      },
    }),
    prisma.documentLink.findMany({
      where: { sourceDocument: { isOrphan: false, department: { isOrphan: false } } },
      orderBy: { sourceDocument: { title: "asc" } },
      include: {
        sourceDocument: {
          select: {
            title: true,
            slug: true,
            department: { select: { slug: true, name: true } },
          },
        },
      },
    }),
  ]);

  const documents: HealthDocument[] = departments.flatMap((department) =>
    department.documents.map((document) => {
      const review = reviewStatus({
        documentIntervalDays: document.reviewIntervalDays,
        departmentIntervalDays: department.reviewIntervalDays,
        lastReviewedAt: document.lastReviewedAt,
        fallbackDate: document.fileMtime,
      });
      const issues = documentHealthIssues({
        owner: document.owner,
        description: document.description,
        criticality: document.criticality as "low" | "normal" | "high",
        status: document.contentStatus as "active" | "deprecated",
        review,
      });
      return {
        ...document,
        issues,
        department: { slug: department.slug, name: department.name },
      };
    }),
  );

  const needingAttention = documents.filter((document) => document.issues.length > 0);
  const withoutOwner = documents.filter(
    (document) => document.contentStatus === "active" && !document.owner,
  ).length;
  const criticalWithoutReview = documents.filter((document) =>
    document.issues.includes("high-without-review"),
  ).length;
  const existingTargets = new Set(
    documents.map((document) => `${document.department.slug}/${document.slug}`),
  );
  const brokenLinks = indexedLinks.filter(
    (link) => !existingTargets.has(`${link.targetDepartmentSlug}/${link.targetDocumentSlug}`),
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Saúde da documentação</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Uma fila objetiva para manter conteúdo operacional confiável. Os dados vêm do
          front-matter de cada arquivo; esta tela não cria uma segunda fonte de verdade.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthStat
          label="Precisam de atenção"
          value={needingAttention.length}
          detail="ativas com lacunas de qualidade"
          icon={CircleAlert}
          tone="attention"
        />
        <HealthStat
          label="Links quebrados"
          value={brokenLinks.length}
          detail="apontam para conteúdo ausente"
          icon={Link2Off}
          tone="attention"
        />
        <HealthStat
          label="Sem responsável"
          value={withoutOwner}
          detail="sem uma pessoa ou time definido"
          icon={UserRoundX}
          tone="neutral"
        />
        <HealthStat
          label="Críticas sem revisão"
          value={criticalWithoutReview}
          detail="precisam declarar um ciclo"
          icon={ShieldAlert}
          tone="attention"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 className="size-4" />
            Fila de melhoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {needingAttention.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma lacuna encontrada nas documentações ativas. Conteúdo descontinuado
              permanece acessível, mas não entra nesta fila.
            </p>
          ) : (
            <ul className="divide-y">
              {needingAttention.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      href={`/departamentos/${document.department.slug}/${document.slug}/editar`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {document.title}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {document.department.name}
                      {document.owner ? ` · responsável: ${document.owner}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {document.issues.map((issue) => (
                      <Badge key={issue} variant={issue === "high-without-review" ? "destructive" : "outline"}>
                        {healthIssueLabel(issue)}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {brokenLinks.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2Off className="size-4" />
              Destinos internos ausentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {brokenLinks.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/departamentos/${link.sourceDocument.department.slug}/${link.sourceDocument.slug}/editar`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {link.sourceDocument.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {link.sourceDocument.department.name} → {link.href}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Critério inicial: documentação ativa precisa de resumo e responsável; conteúdo de
        criticidade alta também precisa participar do ciclo de revisão. O comando{" "}
        <code className="font-mono">npm run docs:validate</code> valida valores inválidos no CI sem bloquear a migração gradual de arquivos antigos.
      </p>
    </div>
  );
}

function HealthStat({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof CircleAlert;
  tone: "attention" | "neutral";
}) {
  return (
    <Card className={`health-summary health-summary--${tone} gap-2`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}
