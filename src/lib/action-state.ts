/**
 * Retorno padrão das server actions do admin, consumido por `useActionState`.
 * Vive fora dos arquivos "use server" porque eles só podem exportar funções.
 */
export type ActionState = {
  ok: boolean;
  message: string | null;
};

export const INITIAL_ACTION_STATE: ActionState = { ok: false, message: null };

export function actionError(message: string): ActionState {
  return { ok: false, message };
}

export function actionSuccess(message: string): ActionState {
  return { ok: true, message };
}
