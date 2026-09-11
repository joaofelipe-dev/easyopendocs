"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

const THEME_TRANSITION_MS = 300;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const themeTimer = React.useRef<number | null>(null);

  // Toggles rápidos em sequência não podem cortar a transição anterior.
  React.useEffect(() => {
    return () => {
      if (themeTimer.current !== null) window.clearTimeout(themeTimer.current);
    };
  }, []);

  const toggleTheme = React.useCallback(() => {
    // Transição suave de cores na troca do tema (FR-014). A classe é
    // temporária: transições permanentes globais custariam caro em jank.
    if (!prefersReducedMotion()) {
      const root = document.documentElement;
      root.classList.add("theme-transition");
      if (themeTimer.current !== null) window.clearTimeout(themeTimer.current);
      themeTimer.current = window.setTimeout(
        () => root.classList.remove("theme-transition"),
        THEME_TRANSITION_MS,
      );
    }
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Atalho "d" alterna o tema, igual ao botão. Ignorado enquanto o foco
  // está em campo de texto/editor para não atrapalhar quem está digitando.
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "d" && event.key !== "D") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      toggleTheme();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label="Alternar tema"
      title="Alternar tema (atalho: d)"
    >
      <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
