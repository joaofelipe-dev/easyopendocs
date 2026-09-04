import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { reviewLabel, type ReviewStatus } from "@/lib/review-cycle";

/**
 * Selo de revisão. Devolve null quando o documento está fora do ciclo — não
 * declarar intervalo é o padrão, e encher a listagem de "sem ciclo de revisão"
 * seria ruído em cima de quem nunca pediu a feature.
 */
export function ReviewBadge({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const label = reviewLabel(status);
  if (!label) return null;

  // "Em dia" fica discreto de propósito: o selo que precisa ser visto é o
  // vencido. Um portal onde tudo brilha não destaca nada.
  if (status.kind === "ok") {
    return (
      <Badge variant="outline" className={className}>
        <CalendarCheck />
        {label}
      </Badge>
    );
  }

  if (status.kind === "soon") {
    return (
      <Badge variant="secondary" className={className}>
        <CalendarClock />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className={className}>
      <CalendarX />
      {label}
    </Badge>
  );
}
