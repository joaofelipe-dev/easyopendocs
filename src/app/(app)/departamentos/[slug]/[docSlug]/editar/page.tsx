import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { updateDocumentAction } from "@/actions/documents";
import { BackLink } from "@/components/back-link";
import { DocumentEditor } from "@/components/document-editor";
import { parseFrontMatter } from "@/lib/content";
import { readDocumentSource } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requireDepartmentAccess } from "@/lib/rbac";

export const metadata: Metadata = { title: "Editar documentação" };
export const dynamic = "force-dynamic";

export default async function EditDocumentPage({
  params,
}: PageProps<"/departamentos/[slug]/[docSlug]/editar">) {
  const { slug, docSlug } = await params;
  const { access } = await requireDepartmentAccess(slug, PERMISSIONS.documentEdit);

  const document = await prisma.document.findUnique({
    where: { departmentId_slug: { departmentId: access.department.id, slug: docSlug } },
  });
  if (!document || document.isOrphan) notFound();

  const source = await readDocumentSource(document.filePath);
  if (source === null) notFound();

  // O front-matter é reconstruído a partir dos campos do formulário na hora de
  // salvar, então o textarea recebe só o corpo.
  const { body } = parseFrontMatter(source);

  return (
    <main>
        <nav
          aria-label="Trilha de navegação"
          className="text-muted-foreground mb-4 flex flex-wrap items-center gap-1 text-xs"
        >
          <BackLink
            href={`/departamentos/${access.department.slug}/${document.slug}`}
          />
          <Link href="/" className="hover:text-foreground">
            Departamentos
          </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/departamentos/${access.department.slug}`}
          className="hover:text-foreground"
        >
          {access.department.name}
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/departamentos/${access.department.slug}/${document.slug}`}
          className="hover:text-foreground"
        >
          {document.title}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Editar</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar documentação
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          As alterações são gravadas direto no arquivo{" "}
          <code className="font-mono">{document.filePath}</code>.
        </p>
      </header>

      <DocumentEditor
        action={updateDocumentAction}
        departmentSlug={access.department.slug}
        departmentName={access.department.name}
        mode="edit"
        initialValues={{
          documentSlug: document.slug,
          title: document.title,
          description: document.description ?? "",
          bodyHtml: body,
        }}
      />
    </main>
  );
}
