"use client";

import { useId } from "react";
import { Undo2 } from "lucide-react";

import { restoreDocumentVersionAction } from "@/actions/documents";
import { ActionForm, ConfirmSubmit } from "@/components/action-form";

/**
 * Restaurar reescreve o arquivo no disco, então pede confirmação — o mesmo
 * padrão do botão de excluir na tela do documento.
 */
export function RestoreVersionButton({
  departmentSlug,
  documentSlug,
  version,
}: {
  departmentSlug: string;
  documentSlug: string;
  version: number;
}) {
  const formId = useId();

  return (
    <>
      <ActionForm action={restoreDocumentVersionAction} id={formId}>
        <input type="hidden" name="departmentSlug" value={departmentSlug} />
        <input type="hidden" name="documentSlug" value={documentSlug} />
        <input type="hidden" name="version" value={version} />
      </ActionForm>
      <ConfirmSubmit
        formId={formId}
        size="sm"
        aria-label={`Restaurar a versão ${version}`}
        title={`Restaurar a v${version}?`}
        description="O arquivo no disco volta a ser exatamente o desta versão. O que está publicado agora não se perde: vira mais uma entrada do histórico, e dá para voltar a ele do mesmo jeito."
        confirmLabel="Restaurar"
      >
        <Undo2 />
        Restaurar
      </ConfirmSubmit>
    </>
  );
}
