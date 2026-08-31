import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { DepartmentResponsibilitiesEditor } from "@/components/department-responsibilities-editor";
import { BackLink } from "@/components/back-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EMPTY_RESPONSIBILITIES } from "@/lib/department-responsibilities";
import {
  readDepartmentResponsibilities,
  responsibilitiesRelativePath,
} from "@/lib/department-responsibilities-file";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requireDepartmentAccess } from "@/lib/rbac";

export const metadata: Metadata = { title: "Editar responsabilidades" };
export const dynamic = "force-dynamic";

export default async function EditDepartmentResponsibilitiesPage({
  params,
}: PageProps<"/departamentos/[slug]/responsabilidades/editar">) {
  const { slug } = await params;
  const { access } = await requireDepartmentAccess(slug, PERMISSIONS.departmentManage);

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

  return (
    <main>
        <nav
          aria-label="Trilha de navegação"
          className="text-muted-foreground mb-4 flex flex-wrap items-center gap-1 text-xs"
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
        <span className="text-foreground">Editar</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {result.status === "missing"
            ? "Mapear responsabilidades"
            : "Editar responsabilidades"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Agrupe o que o departamento faz em frentes, e vincule cada
          responsabilidade às documentações que a cobrem. As alterações são
          gravadas em <code className="font-mono">{filePath}</code>.
        </p>
      </header>

      {result.status === "invalid" ? (
        <div className="space-y-4">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>O arquivo existente não pôde ser lido</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{result.error}</p>
              <p>
                Editar aqui começaria de uma lista vazia e apagaria o conteúdo
                atual do arquivo ao salvar. Corrija{" "}
                <code className="font-mono">{filePath}</code> no disco — ou apague o
                arquivo, se quiser recomeçar do zero.
              </p>
            </AlertDescription>
          </Alert>

          <Button asChild variant="outline">
            <Link href={`${base}/responsabilidades`}>Voltar</Link>
          </Button>
        </div>
      ) : (
        <DepartmentResponsibilitiesEditor
          departmentSlug={access.department.slug}
          documents={documents}
          initialResponsibilities={
            result.status === "ok" ? result.responsibilities : EMPTY_RESPONSIBILITIES
          }
          hasExisting={result.status === "ok"}
          filePath={filePath}
        />
      )}
    </main>
  );
}
