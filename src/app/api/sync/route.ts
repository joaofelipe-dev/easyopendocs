import { NextResponse } from "next/server";

import { syncContent } from "@/lib/content-sync";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Status do último sync — qualquer usuário autenticado pode consultar. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const result = await syncContent({ trigger: "AUTOMATIC" });
  return NextResponse.json(result);
}

/**
 * Sync manual. `?force=1` reprocessa todos os arquivos ignorando hash/mtime;
 * como isso lê o disco inteiro, exige super admin.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";

  if (force && !user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Apenas o administrador geral pode forçar um sync completo" },
      { status: 403 },
    );
  }

  const result = await syncContent({ trigger: "MANUAL", force });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
