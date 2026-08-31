import { ThemeToggle } from "@/components/theme-toggle";

export function Footer() {
  return (
    <footer className="print:hidden border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col-reverse items-center justify-between gap-3 px-4 py-4 text-xs sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} Portal de Documentações</p>
        <ThemeToggle />
      </div>
    </footer>
  );
}
