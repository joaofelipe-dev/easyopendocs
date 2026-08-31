import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Seta de voltar: leva à mesma página que o item anterior da trilha de
 * navegação (breadcrumb) aponta — o "pai" da página atual.
 */
export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 shrink-0 items-center justify-center rounded-md"
    >
      <ArrowLeft className="size-4" />
    </Link>
  );
}
