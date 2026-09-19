import Link from "next/link";
import { BookMarked, KeyRound, LogOut, Shield } from "lucide-react";

import { logoutAction } from "@/actions/session";
import { SearchBox } from "@/components/search-box";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/rbac";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/75 print:hidden sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 md:flex-nowrap md:gap-6">
        <Link
          href="/"
          className="mr-auto flex shrink-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:mr-0"
        >
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <BookMarked aria-hidden="true" className="size-5" />
          </span>
          <span className="flex flex-col"><span className="text-base">easyopendocs</span><span className="text-muted-foreground text-xs font-normal tracking-normal">Portal de conhecimento</span></span>
        </Link>

        <div className="order-last w-full min-w-0 md:order-none md:flex-1">
          <SearchBox globalShortcut className="w-full" />
        </div>

        {user.isSuperAdmin ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin" aria-label="Administração">
              <Shield />
              <span className="hidden sm:inline">Administração</span>
            </Link>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Menu do usuário"
            >
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
                {user.isSuperAdmin ? (
                  <span className="text-muted-foreground mt-1 text-xs">
                    Administrador geral
                  </span>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/trocar-senha">
                <KeyRound />
                Alterar senha
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut />
                  Sair
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
