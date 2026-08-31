import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { createDocumentAction } from "@/actions/documents";
import { BackLink } from "@/components/back-link";
import { DocumentEditor } from "@/components/document-editor";
import { PERMISSIONS, requireDepartmentAccess } from "@/lib/rbac";

export const metadata: Metadata = { title: "Nova documentação" };

export default async function NewDocumentPage({
  params,
}: PageProps<"/departamentos/[slug]/nova-documentacao">) {
  const { slug } = await params;
  const { access } = await requireDepartmentAccess(
    slug,
    PERMISSIONS.documentCreate,
  );

  return (
    <main>
        <nav
          aria-label="Trilha de navegação"
          className="text-muted-foreground mb-4 flex items-center gap-1 text-xs"
        >
          <BackLink href={`/departamentos/${access.department.slug}`} />
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
        <span className="text-foreground">Nova documentação</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nova documentação
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          O arquivo <code className="font-mono">.html</code> é gravado na pasta
          de {access.department.name} e indexado na hora — igual a um arquivo
          colocado ali manualmente.
        </p>
      </header>

      <DocumentEditor
        action={createDocumentAction}
        departmentSlug={access.department.slug}
        departmentName={access.department.name}
        mode="create"
      />
    </main>
  );
}
