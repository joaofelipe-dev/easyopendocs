import Link from "next/link";
import { Link2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentBacklink } from "@/lib/document-backlinks";

export function DocumentImpactNotice({
  links,
  action,
}: {
  links: DocumentBacklink[];
  action: "alterar" | "restaurar" | "excluir";
}) {
  if (links.length === 0) return null;

  return (
    <Card className="backlink-panel mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4" />
          Impacto da alteração
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          {links.length === 1
            ? "Uma documentação acessível referencia este conteúdo."
            : `${links.length} documentações acessíveis referenciam este conteúdo.`}{" "}
          Revise-as antes de {action}.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {links.map((link) => (
            <li key={link.id}>
              <Link
                href={`/departamentos/${link.sourceDocument.department.slug}/${link.sourceDocument.slug}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {link.sourceDocument.title}
              </Link>
              <span className="text-muted-foreground"> · {link.sourceDocument.department.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

