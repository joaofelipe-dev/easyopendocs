import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// No Next 16 o antigo `middleware.ts` virou `proxy.ts`.
//
// Aqui roda apenas a checagem *otimista*: existe cookie de sessão? Se não,
// manda para o login sem nem tocar no banco. A autorização de verdade
// (usuário ativo, super admin, roles por departamento) fica em rbac.ts, no
// server component de cada rota — este arquivo não é a fonte de verdade.

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

const PUBLIC_PATHS = ["/login", "/sem-acesso"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSession = SESSION_COOKIES.some(
    (name) => request.cookies.get(name)?.value,
  );
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tudo, menos as rotas do NextAuth, assets estáticos e arquivos com extensão.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
};
