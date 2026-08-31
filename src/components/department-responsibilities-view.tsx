import Link from "next/link";
import { FileText, TriangleAlert, UserRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { ResolvedResponsibilities } from "@/lib/department-responsibilities";

/**
 * Blocos agrupados por frente. Sem ligações entre eles — o campo `deliversTo`
 * já existe no arquivo, mas desenhar as setas é o diagrama, que vem depois e
 * não vai exigir remontar o que foi preenchido aqui.
 */
export function DepartmentResponsibilitiesView({
  responsibilities,
  departmentSlug,
}: {
  responsibilities: ResolvedResponsibilities;
  departmentSlug: string;
}) {
  return (
    <div className="doc-responsibilities space-y-8">
      {responsibilities.areas.map((area) => (
        <section key={area.id} aria-labelledby={`frente-${area.id}`}>
          <h2
            id={`frente-${area.id}`}
            className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase"
          >
            {area.title}
          </h2>

          {area.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma responsabilidade nesta frente ainda.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {area.items.map((item) => {
                const hasCoverage = item.documents.some((document) => !document.missing);

                return (
                  <li key={item.id} className="break-inside-avoid">
                    <Card className="h-full gap-2">
                      <CardContent className="space-y-2">
                        <p className="leading-snug font-medium">{item.title}</p>

                        {item.description ? (
                          <p className="text-muted-foreground text-sm leading-snug">
                            {item.description}
                          </p>
                        ) : null}

                        {item.owner ? (
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <UserRound className="size-3.5 shrink-0" />
                            {item.owner}
                          </p>
                        ) : null}

                        {item.documents.length > 0 ? (
                          <ul className="space-y-1 pt-1">
                            {item.documents.map((document) =>
                              document.missing ? (
                                <li
                                  key={document.slug}
                                  className="text-destructive flex items-start gap-1.5 text-xs"
                                >
                                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                                  <span className="leading-snug">
                                    <code className="font-mono">{document.slug}</code> não
                                    existe mais
                                  </span>
                                </li>
                              ) : (
                                <li key={document.slug}>
                                  <Link
                                    href={`/departamentos/${departmentSlug}/${document.slug}`}
                                    className="text-muted-foreground hover:text-foreground flex items-start gap-1.5 text-xs transition-colors"
                                  >
                                    <FileText className="mt-0.5 size-3.5 shrink-0" />
                                    <span className="leading-snug underline-offset-2 hover:underline">
                                      {document.title}
                                    </span>
                                  </Link>
                                </li>
                              ),
                            )}
                          </ul>
                        ) : null}

                        {hasCoverage ? null : (
                          <p className="text-muted-foreground flex items-center gap-1.5 pt-1 text-xs">
                            <TriangleAlert className="size-3.5 shrink-0" />
                            Sem documentação
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
