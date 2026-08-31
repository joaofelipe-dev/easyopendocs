"use server";

import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

const BCRYPT_ROUNDS = 10;

export type ChangePasswordState = { error: string | null };

const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(200);

export async function changeOwnPasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(parsed.data, BCRYPT_ROUNDS),
      mustChangePassword: false,
    },
  });

  // Lança um NEXT_REDIRECT, que precisa subir sem ser capturado.
  redirect("/");
}
