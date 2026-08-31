import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isSuperAdmin?: boolean;
  }
}

// `next-auth/jwt` só reexporta `@auth/core/jwt`; a augmentação precisa mirar o
// módulo que realmente declara a interface.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    isSuperAdmin?: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials Provider exige sessão em JWT — não há adapter de banco aqui.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Usuário e senha",
      credentials: {
        email: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });

        // Compara mesmo sem usuário para não vazar quais e-mails existem via
        // diferença de tempo de resposta.
        const hash =
          user?.passwordHash ??
          "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
        const passwordMatches = await compare(parsed.data.password, hash);

        if (!user || !user.isActive || !passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
      }

      // O token é só um atalho para a UI. Toda decisão de autorização passa
      // por getCurrentUser()/rbac.ts, que relê o banco a cada request.
      if (trigger === "update") {
        token.isSuperAdmin = token.isSuperAdmin ?? false;
      }

      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.isSuperAdmin = token.isSuperAdmin ?? false;
      return session;
    },
  },
});
