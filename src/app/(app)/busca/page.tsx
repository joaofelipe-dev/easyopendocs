import type { Metadata } from "next";
import Link from "next/link";
import { FileText, SearchX, Search as SearchIcon } from "lucide-react";

import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listReadableDepartments, requireUser } from "@/lib/rbac";
import { searchDocuments } from "@/lib/search";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Busca" };

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SearchPage({ searchParams }: PageProps<"/busca">) {
  const user = await requireUser();
  const params = await searchParams;

  const query = firstValue(params.q).trim();
  const requestedDepartment = firstValue(params.departamento).trim();

  const departments = await listReadableDepartments(user);
  // Um slug que o usuário não pode ler é tratado como filtro nenhum, e não
  // como "zero resultados": responder diferente confirmaria que o
  // departamento existe.
  const departmentSlug = departments.some((d) => d.slug === requestedDepartment)
    ? requestedDepartment
    : undefined;

  const results = query
    ? await searchDocuments(user, query, { departmentSlug })
    : [];

  const activeDepartment = departments.find((d) => d.slug === departmentSlug);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Busca</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Procura no título, na descrição e no conteúdo das documentações que você
        pode ler.
      </p>

      <div className="mt-6">
        <SearchBox
          defaultValue={query}
          departmentSlug={departmentSlug}
          autoFocus={!query}
          placeholder={
            activeDepartment
              ? `Buscar em ${activeDepartment.name}…`
              : "Buscar documentação…"
          }
        />
      </div>

      {departments.length > 1 ? (
        <nav
          aria-label="Filtrar por departamento"
          className="mt-4 flex flex-wrap gap-2"
        >
          <FilterChip
            href={`/busca?q=${encodeURIComponent(query)}`}
            active={!departmentSlug}
          >
            Todos
          </FilterChip>
          {departments.map((department) => (
            <FilterChip
              key={department.id}
              href={`/busca?q=${encodeURIComponent(query)}&departamento=${encodeURIComponent(department.slug)}`}
              active={department.slug === departmentSlug}
            >
              {department.name}
            </FilterChip>
          ))}
        </nav>
      ) : null}

      <div className="mt-8">
        {!query ? (
          <Placeholder
            icon={<SearchIcon className="size-5" />}
            title="Digite o que você procura"
            description="Busque por qualquer palavra do título ou do conteúdo. Acento é opcional."
          />
        ) : results.length === 0 ? (
          <Placeholder
            icon={<SearchX className="size-5" />}
            title={`Nada encontrado para “${query}”`}
            description={
              activeDepartment
                ? `Nenhuma documentação de ${activeDepartment.name} corresponde. Tente buscar em todos os departamentos.`
                : "Tente outras palavras, ou termos mais gerais."
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground mb-4 text-sm">
              {results.length === 1
                ? "1 documentação encontrada"
                : `${results.length} documentações encontradas`}
            </p>
            <ul className="space-y-3">
              {results.map((result) => (
                <li key={result.documentId}>
                  <Link
                    href={`/departamentos/${result.departmentSlug}/${result.documentSlug}`}
                    className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Card className="hover:border-foreground/20 transition-colors">
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="text-muted-foreground size-4 shrink-0" />
                          <span className="font-medium">{result.title}</span>
                          <Badge variant="secondary">
                            {result.departmentName}
                          </Badge>
                        </div>
                        {result.description ? (
                          <p className="text-muted-foreground text-sm">
                            {result.description}
                          </p>
                        ) : null}
                        {/* Só o <mark> do ts_headline sobrevive à sanitização. */}
                        <p
                          className="text-muted-foreground [&_mark]:bg-primary/20 [&_mark]:text-foreground text-sm [&_mark]:rounded [&_mark]:px-0.5"
                          dangerouslySetInnerHTML={{ __html: result.snippetHtml }}
                        />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function Placeholder({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
