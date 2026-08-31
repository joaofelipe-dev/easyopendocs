import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/rbac";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function TrocarSenhaPage() {
  // Usada tanto no primeiro acesso obrigatório quanto na troca voluntária
  // (link "Alterar senha" no menu do usuário). Só a segunda mostra "Cancelar".
  const user = await requireUser();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Defina sua nova senha
            </h1>
            <p className="text-muted-foreground text-sm">
              {user.mustChangePassword
                ? "Por segurança, troque a senha padrão antes de continuar."
                : "Escolha uma nova senha para sua conta."}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trocar senha</CardTitle>
            <CardDescription>
              Escolha uma senha só sua, com pelo menos 8 caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        {!user.mustChangePassword ? (
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
          >
            Cancelar
          </Link>
        ) : null}
      </div>
    </main>
  );
}
