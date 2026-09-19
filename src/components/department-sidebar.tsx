"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderOpen, ListChecks, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DepartmentNavigation } from "@/components/department-navigation";
import { cn } from "@/lib/utils";

export type SidebarDocument = {
  slug: string;
  title: string;
};

export function DepartmentSidebar({
  departmentSlug,
  departmentName,
  documents,
  canCreate,
  hasResponsibilities,
  canManage,
}: {
  departmentSlug: string;
  departmentName: string;
  documents: SidebarDocument[];
  canCreate: boolean;
  /** Existe `_responsabilidades.json` na pasta do departamento. */
  hasResponsibilities: boolean;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const base = `/departamentos/${departmentSlug}`;

  return (
    <DepartmentNavigation name={departmentName}>
    <nav
      aria-label={`Documentações de ${departmentName}`}
      className="flex flex-col gap-3"
    >
      <p className="text-muted-foreground px-3 text-xs font-medium uppercase tracking-widest">Neste departamento</p>
      <Link
        href={base}
        aria-current={pathname === base ? "page" : undefined}
        className={cn(
          "hover:bg-muted flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-ring",
          pathname === base && "bg-muted text-foreground",
        )}
      >
        <FolderOpen className="size-4 shrink-0" />
        <span className="truncate">{departmentName}</span>
      </Link>

      {hasResponsibilities || canManage ? (
        <Link
          href={`${base}/responsabilidades`}
          aria-current={pathname.startsWith(`${base}/responsabilidades`) ? "page" : undefined}
          className={cn(
            "hover:bg-muted text-muted-foreground hover:text-foreground -mt-1 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-ring",
            pathname.startsWith(`${base}/responsabilidades`) &&
              "bg-muted text-foreground font-medium",
          )}
        >
          <ListChecks className="size-4 shrink-0" />
          <span className="truncate">Responsabilidades</span>
          {hasResponsibilities ? null : (
            <span className="text-muted-foreground ml-auto text-xs">criar</span>
          )}
        </Link>
      ) : null}

      {documents.length > 0 ? (
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          <ul className="border-border/70 ml-4 space-y-0.5 border-l pl-2">
            {documents.map((document) => {
              const href = `${base}/${document.slug}`;
              const isActive = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <li key={document.slug}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "hover:bg-muted hover:text-foreground text-muted-foreground flex min-h-11 items-start gap-2 rounded-lg px-3 py-2.5 text-sm transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-ring",
                      isActive && "bg-primary/10 text-primary font-semibold",
                    )}
                  >
                    <FileText className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 break-words leading-snug">{document.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground px-3 text-xs">
          Nenhuma documentação ainda.
        </p>
      )}

      {canCreate ? (
        <Button asChild variant="outline" size="sm" className="mt-1 justify-start">
          <Link href={`${base}/nova-documentacao`}>
            <Plus />
            Nova documentação
          </Link>
        </Button>
      ) : null}
    </nav>
    </DepartmentNavigation>
  );
}
