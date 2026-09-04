"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

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
}: {
  defaultValue?: string;
  /** Quando presente, a busca já nasce restrita a este departamento. */
  departmentSlug?: string;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" foca a busca, como na maioria dos portais de documentação. Só quando o
  // foco não está em outro campo — senão digitar uma barra viraria um atalho.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;

      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (typing) return;

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form action="/busca" method="get" role="search" className={className}>
      {departmentSlug ? (
        <input type="hidden" name="departamento" value={departmentSlug} />
      ) : null}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label="Buscar documentação"
          autoFocus={autoFocus}
          className="pl-8"
        />
      </div>
    </form>
  );
}
