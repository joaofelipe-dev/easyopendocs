import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ChevronRight, History, Pencil, Trash2 } from "lucide-react";

import { deleteDocumentAction } from "@/actions/documents";
import { ActionForm, ConfirmSubmit } from "@/components/action-form";
import { MarkReviewedButton } from "@/components/mark-reviewed-button";
import { ReviewBadge } from "@/components/review-badge";
import { BackLink } from "@/components/back-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { renderDocument, type DocumentHeading } from "@/lib/document-render";
import { readDocumentSource } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, can, requireDepartmentAccess } from "@/lib/rbac";
import { reviewStatus } from "@/lib/review-cycle";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

async function findDocument(departmentId: string, docSlug: string) {
  return prisma.document.findUnique({
    where: { departmentId_slug: { departmentId, slug: docSlug } },
    include: { createdBy: { select: { name: true } } },
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/departamentos/[slug]/[docSlug]">): Promise<Metadata> {
  const { slug, docSlug } = await params;
  const department = await prisma.department.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!department) return { title: "Documentação" };

  const document = await findDocument(department.id, docSlug);

  return {
    title: document?.title ?? "Documentação",
    description: document?.description ?? undefined,
  };
}

export default async function DocumentPage({
  params,
}: PageProps<"/departamentos/[slug]/[docSlug]">) {
  const { slug, docSlug } = await params;
  const { access } = await requireDepartmentAccess(slug);

  const document = await findDocument(access.department.id, docSlug);
  if (!document || document.isOrphan) notFound();

  const source = await readDocumentSource(document.filePath);
  const rendered = source === null ? null : renderDocument(source);
  const canEdit = can(access, PERMISSIONS.documentEdit);
  const canDelete = can(access, PERMISSIONS.documentDelete);

  const review = reviewStatus({
    documentIntervalDays: document.reviewIntervalDays,
    departmentIntervalDays: access.department.reviewIntervalDays,
    lastReviewedAt: document.lastReviewedAt,
    // Sem `reviewedAt` no arquivo, a última alteração do conteúdo conta como
    // revisão: na prática, editar é revisar.
    fallbackDate: document.fileMtime,
  });
  const deleteFormId = `delete-document-${document.id}`;

  return (
    <main className="flex min-w-0 gap-8">
      <article className="min-w-0 flex-1">
        <nav
          aria-label="Trilha de navegação"
          className="text-muted-foreground print:hidden mb-4 flex flex-wrap items-center gap-1 text-xs"
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
          <span className="text-foreground">{document.title}</span>
        </nav>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">
              Atualizado em {DATE_FORMAT.format(document.fileMtime)}
              {document.createdBy ? ` · criado por ${document.createdBy.name}` : ""}
            </p>
            <ReviewBadge status={review} className="mt-2" />
            {access.isSuperAdmin ? (
              <code className="text-muted-foreground text-xs">
                {document.filePath}
              </code>
            ) : null}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <PrintButton />
            <Button asChild variant="ghost" size="sm">
              <Link
                href={`/departamentos/${access.department.slug}/${document.slug}/historico`}
              >
                <History />
                Histórico
              </Link>
            </Button>
            {canEdit && review.kind !== "off" ? (
              <MarkReviewedButton
                departmentSlug={access.department.slug}
                documentSlug={document.slug}
              />
            ) : null}
            {canEdit ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/departamentos/${access.department.slug}/${document.slug}/editar`}
                >
                  <Pencil />
                  Editar
                </Link>
              </Button>
            ) : null}
            {canDelete ? (
              <>
                <ActionForm action={deleteDocumentAction} id={deleteFormId}>
                  <input type="hidden" name="departmentSlug" value={access.department.slug} />
                  <input type="hidden" name="documentSlug" value={document.slug} />
                </ActionForm>
                <ConfirmSubmit
                  formId={deleteFormId}
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  aria-label="Excluir documentação"
                  title={`Excluir "${document.title}"?`}
                  description="Isso apaga o arquivo do disco e remove a documentação do portal permanentemente. Não pode ser desfeito."
                  confirmLabel="Excluir"
                >
                  <Trash2 />
                  Excluir
                </ConfirmSubmit>
              </>
            ) : null}
          </div>
        </div>

        {rendered === null ? (
          <MissingFileAlert filePath={document.filePath} />
        ) : (
          // O HTML já passou pelo sanitizador dentro de renderDocument().
          <div
            className="doc-content"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        )}
      </article>

      {rendered ? <OnThisPage headings={rendered.headings} /> : null}
    </main>
  );
}

function OnThisPage({ headings }: { headings: DocumentHeading[] }) {
  if (headings.length < 2) return null;

  return (
    <aside className="print:hidden hidden w-52 shrink-0 xl:block">
      <div className="sticky top-20">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Nesta página
        </p>
        <ul className="space-y-1 border-l text-sm">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={`text-muted-foreground hover:text-foreground block border-l-2 border-transparent py-0.5 leading-snug transition-colors hover:border-current ${
                  heading.level === 3 ? "pl-6 text-xs" : "pl-3"
                }`}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function MissingFileAlert({ filePath }: { filePath: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Arquivo não encontrado</AlertTitle>
      <AlertDescription>
        <p>
          Esta documentação está indexada, mas o arquivo{" "}
          <code className="font-mono">{filePath}</code> não pôde ser lido. Ele
          pode ter sido removido ou renomeado fora do portal — a próxima
          sincronização vai marcá-la como órfã.
        </p>
      </AlertDescription>
    </Alert>
  );
}
