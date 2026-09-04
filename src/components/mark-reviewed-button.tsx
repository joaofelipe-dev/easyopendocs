"use client";

import { CalendarCheck } from "lucide-react";

import { markDocumentReviewedAction } from "@/actions/documents";
import { ActionForm, SubmitButton } from "@/components/action-form";

/**
 * Marca a documentação como revisada hoje. Sem confirmação: a ação só carimba
 * uma data no front-matter e é trivialmente refeita — pedir confirmação para
 * isso treinaria as pessoas a clicar em "sim" sem ler.
 */
export function MarkReviewedButton({
  departmentSlug,
  documentSlug,
}: {
  departmentSlug: string;
  documentSlug: string;
}) {
  return (
    <ActionForm action={markDocumentReviewedAction}>
      <input type="hidden" name="departmentSlug" value={departmentSlug} />
      <input type="hidden" name="documentSlug" value={documentSlug} />
      <SubmitButton
        variant="outline"
        size="sm"
        pendingLabel="Marcando…"
      >
        <CalendarCheck />
        Marcar como revisada
      </SubmitButton>
    </ActionForm>
  );
}
