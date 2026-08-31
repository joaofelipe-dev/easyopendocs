"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

type ServerAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Envolve uma server action do admin: dispara o toast de sucesso/erro e avisa
 * o pai (para fechar o dialog) quando deu certo. Sem isso, cada tela do admin
 * repetiria o mesmo bloco de useActionState + useEffect.
 */
export function ActionForm({
  action,
  children,
  className,
  id,
  onSuccess,
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  /** Necessário quando o botão de submit vive fora do form (ConfirmSubmit). */
  id?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  useEffect(() => {
    if (!state.message) return;

    if (state.ok) {
      toast.success(state.message);
      onSuccess?.();
    } else {
      toast.error(state.message);
    }
    // onSuccess é recriado a cada render do pai; só o resultado da action
    // deve reabrir este efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form id={id} action={formAction} className={className}>
      {children}
    </form>
  );
}

/**
 * Botão que só submete o form depois de uma confirmação. O submit real vive
 * dentro do AlertDialog e alcança o form pelo atributo `form=`, o que evita
 * aninhar formulários.
 */
export function ConfirmSubmit({
  formId,
  title,
  description,
  confirmLabel = "Excluir",
  children,
  ...triggerProps
}: React.ComponentProps<typeof Button> & {
  formId: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" {...triggerProps}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction type="submit" form={formId}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
