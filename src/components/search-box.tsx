"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Campo de busca do cabeçalho. É um `<form method="get">` de propósito: sem
 * JavaScript ele continua funcionando, e o resultado vira uma URL que dá para
 * compartilhar (`/busca?q=...`).
 */
export function SearchBox({
  defaultValue = "",
  departmentSlug,
  className,
  placeholder = "Buscar documentação…",
  autoFocus = false,
  globalShortcut = false,
}: {
  defaultValue?: string;
  /** Quando presente, a busca já nasce restrita a este departamento. */
  departmentSlug?: string;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  globalShortcut?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" foca a busca, como na maioria dos portais de documentação. Só quando o
  // foco não está em outro campo — senão digitar uma barra viraria um atalho.
  useEffect(() => {
    if (!globalShortcut) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && (active.isContentEditable || !!active.closest('[role="dialog"], [role="textbox"], [role="combobox"], [role="menu"]')));
      if (typing) return;

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [globalShortcut]);

  return (
    <form action="/busca" method="get" role="search" className={className}>
      {departmentSlug ? (
        <input type="hidden" name="departamento" value={departmentSlug} />
      ) : null}
      <div className="relative flex items-center gap-2">
        <Search aria-hidden="true" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label="Buscar documentação"
          aria-keyshortcuts={globalShortcut ? "/" : undefined}
          autoFocus={autoFocus}
          className="h-11 rounded-xl bg-muted/40 pl-9"
        />
        <Button type="submit" variant="secondary" className="h-11 rounded-xl px-4">Buscar</Button>
      </div>
    </form>
  );
}
