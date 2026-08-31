"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderTree, KeyRound, LayoutDashboard, RefreshCw, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/departamentos", label: "Departamentos", icon: FolderTree },
  { href: "/admin/papeis", label: "Papéis e permissões", icon: KeyRound },
  { href: "/admin/sync", label: "Sincronização", icon: RefreshCw },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Seções do admin">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/admin" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "hover:bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              isActive && "bg-muted text-foreground font-medium",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
