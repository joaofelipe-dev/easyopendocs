import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sem acesso" };

const PERMISSION_LABELS: Record<string, string> = {
  "document:read": "visualizar documentações",
  "document:create": "criar documentações",
  "document:edit": "editar documentações",
  "department:manage": "gerenciar o departamento",
};

export default async function SemAcessoPage({
  searchParams,
}: PageProps<"/sem-acesso">) {
  const params = await searchParams;
  const permission =
    typeof params.permissao === "string" ? params.permissao : null;
  const reason = typeof params.motivo === "string" ? params.motivo : null;

  const message = reason === "admin"
    ? "Esta área é exclusiva do administrador geral do portal."
    : permission
      ? `Você tem acesso a este departamento, mas não à permissão necessária para ${
          PERMISSION_LABELS[permission] ?? permission
        }.`
      : "Você não tem acesso a este departamento — ou ele não existe.";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-xl">
            <ShieldAlert className="size-5" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Acesso negado</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            Se você acredita que deveria ter acesso, fale com o administrador
            geral do portal.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Voltar para a home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
