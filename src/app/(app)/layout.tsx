import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/rbac";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // O proxy.ts só checa se existe cookie. A verificação real (usuário existe,
  // está ativo) é aqui, e vale para tudo que estiver dentro deste grupo.
  const user = await requireUser();

  // /trocar-senha fica fora deste grupo de rotas (sem AppHeader), então não
  // há risco de loop de redirecionamento aqui.
  if (user.mustChangePassword) redirect("/trocar-senha");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
