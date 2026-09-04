import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileClock, History } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { DiffView } from "@/components/diff-view";
import { RestoreVersionButton } from "@/components/restore-version-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { renderDocument } from "@/lib/document-render";
import {
  HISTORY_LIMIT,
  SOURCE_LABEL,
  getDocumentVersion,
  listDocumentVersions,
  type DocumentVersionSummary,
} from "@/lib/document-version";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, can, requireDepartmentAccess } from "@/lib/rbac";
import { diffDocuments } from "@/lib/text-diff";

export const dynamic = "force-dynamic";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export async function generateMetadata({
  params,
}: PageProps<"/departamentos/[slug]/[docSlug]/historico">): Promise<Metadata> {
  const { docSlug } = await params;
  return { title: `Histórico · ${docSlug}` };
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseVersion(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

export default async function DocumentHistoryPage({
  params,
  searchParams,
}: PageProps<"/departamentos/[slug]/[docSlug]/historico">) {
  const { slug, docSlug } = await params;
  const { access } = await requireDepartmentAccess(slug);
  const query = await searchParams;

  const document = await prisma.document.findUnique({
    where: { departmentId_slug: { departmentId: access.department.id, slug: docSlug } },
  });
  if (!document || document.isOrphan) notFound();

  const versions = await listDocumentVersions(document.id);
  const canRestore = can(access, PERMISSIONS.documentEdit);

  const selected = parseVersion(firstValue(query.v));
  const compareFrom = parseVersion(firstValue(query.de));
  const compareTo = parseVersion(firstValue(query.para));

  const documentHref = `/departamentos/${access.department.slug}/${document.slug}`;
  const historyHref = `${documentHref}/historico`;

  return (
    <main className="min-w-0 flex-1">
      <nav
        aria-label="Trilha de navegação"
        className="text-muted-foreground print:hidden mb-4 flex flex-wrap items-center gap-1 text-xs"
      >
        <BackLink href={documentHref} />
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
        <Link href={documentHref} className="hover:text-foreground">
          {document.title}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Histórico</span>
      </nav>

      <header className="mb-6 border-b pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <History className="size-5" />
          Histórico
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cada mudança de conteúdo vira uma versão — inclusive as feitas fora do
          portal, direto no arquivo. Ficam guardadas as {HISTORY_LIMIT} últimas.
        </p>
      </header>

      {versions.length === 0 ? (
        <EmptyHistory />
      ) : (
        <div className="space-y-8">
          {compareFrom && compareTo ? (
            <ComparePanel
              documentId={document.id}
              from={compareFrom}
              to={compareTo}
              historyHref={historyHref}
            />
          ) : selected ? (
            <VersionPanel
              documentId={document.id}
              version={selected}
              currentHash={document.contentHash}
              historyHref={historyHref}
            />
          ) : null}

          <VersionList
            versions={versions}
            currentHash={document.contentHash}
            historyHref={historyHref}
            departmentSlug={access.department.slug}
            documentSlug={document.slug}
            canRestore={canRestore}
          />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function VersionList({
  versions,
  currentHash,
  historyHref,
  departmentSlug,
  documentSlug,
  canRestore,
}: {
  versions: DocumentVersionSummary[];
  currentHash: string;
  historyHref: string;
  departmentSlug: string;
  documentSlug: string;
  canRestore: boolean;
}) {
  return (
    <ul className="space-y-3">
      {versions.map((version, index) => {
        const isCurrent = version.contentHash === currentHash;
        // A versão anterior na ordem cronológica é a seguinte na lista, que
        // vem do mais novo para o mais velho.
        const previous = versions[index + 1];

        return (
          <li key={version.version}>
            <Card>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">v{version.version}</span>
                    <Badge variant="secondary">{SOURCE_LABEL[version.source]}</Badge>
                    {isCurrent ? <Badge>Publicada</Badge> : null}
                  </div>
                  <p className="text-muted-foreground text-sm">{version.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {DATE_TIME_FORMAT.format(version.createdAt)}
                    {version.authorName ? ` · ${version.authorName}` : ""}
                    {" · "}
                    {formatBytes(version.byteSize)}
                    {version.byteDelta !== null && version.byteDelta !== 0 ? (
                      <span
                        className={
                          version.byteDelta > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }
                      >
                        {" "}
                        ({version.byteDelta > 0 ? "+" : "−"}
                        {formatBytes(Math.abs(version.byteDelta))})
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`${historyHref}?v=${version.version}`}>Ver</Link>
                  </Button>
                  {previous ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`${historyHref}?de=${previous.version}&para=${version.version}`}
                      >
                        Comparar
                      </Link>
                    </Button>
                  ) : null}
                  {canRestore && !isCurrent ? (
                    <RestoreVersionButton
                      departmentSlug={departmentSlug}
                      documentSlug={documentSlug}
                      version={version.version}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

async function VersionPanel({
  documentId,
  version,
  currentHash,
  historyHref,
}: {
  documentId: string;
  version: number;
  currentHash: string;
  historyHref: string;
}) {
  const snapshot = await getDocumentVersion(documentId, version);
  if (!snapshot) return <MissingVersion historyHref={historyHref} />;

  // A versão antiga passa pelo MESMO pipeline de renderização do documento
  // atual — inclusive o sanitizador. Um snapshot gravado antes de uma regra
  // de sanitização mudar não pode escapar dela ao ser reexibido.
  const rendered = renderDocument(snapshot.rawHtml);

  return (
    <section className="space-y-4">
      <Alert>
        <FileClock />
        <AlertTitle>
          Você está vendo a v{version}
          {snapshot.contentHash === currentHash ? " (a versão publicada)" : ", que não é a publicada"}
        </AlertTitle>
        <AlertDescription>
          <p>
            {SOURCE_LABEL[snapshot.source]} em{" "}
            {DATE_TIME_FORMAT.format(snapshot.createdAt)}
            {snapshot.authorName ? ` por ${snapshot.authorName}` : ""}.{" "}
            <Link href={historyHref} className="underline">
              Voltar ao histórico
            </Link>
          </p>
        </AlertDescription>
      </Alert>

      <div
        className="doc-content"
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
    </section>
  );
}

async function ComparePanel({
  documentId,
  from,
  to,
  historyHref,
}: {
  documentId: string;
  from: number;
  to: number;
  historyHref: string;
}) {
  const [before, after] = await Promise.all([
    getDocumentVersion(documentId, from),
    getDocumentVersion(documentId, to),
  ]);

  if (!before || !after) return <MissingVersion historyHref={historyHref} />;

  const diff = diffDocuments(before.rawHtml, after.rawHtml);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">
          Comparando v{from} → v{to}
        </h2>
        <p className="text-muted-foreground text-xs">
          {diff.truncated ? (
            "Arquivos grandes demais para comparar linha a linha."
          ) : (
            <>
              <span className="text-emerald-600 dark:text-emerald-400">
                +{diff.added}
              </span>{" "}
              <span className="text-destructive">−{diff.removed}</span> ·{" "}
              <Link href={historyHref} className="underline">
                voltar ao histórico
              </Link>
            </>
          )}
        </p>
      </div>

      <DiffView diff={diff} />
    </section>
  );
}

function MissingVersion({ historyHref }: { historyHref: string }) {
  return (
    <Alert variant="destructive">
      <FileClock />
      <AlertTitle>Versão não encontrada</AlertTitle>
      <AlertDescription>
        <p>
          Ela pode ter saído do histórico pela política de retenção (as{" "}
          {HISTORY_LIMIT} últimas).{" "}
          <Link href={historyHref} className="underline">
            Voltar ao histórico
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}

function EmptyHistory() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
          <History className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Nenhuma versão guardada ainda</p>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Documentações indexadas antes do histórico existir só ganham a
            primeira versão na próxima vez que o conteúdo mudar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}
