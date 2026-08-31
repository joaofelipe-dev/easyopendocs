import type { NextConfig } from "next";

// Só relevante em `next dev`, e só se você abre o servidor de desenvolvimento
// por outro host da rede em vez de localhost — nesse caso o Next exige que a
// origem seja declarada. Fica em env para não versionar IP de rede interna.
const devAllowedOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(devAllowedOrigins.length > 0 ? { allowedDevOrigins: devAllowedOrigins } : {}),
  // jsdom (usado pelo isomorphic-dompurify no servidor) e o Prisma não devem
  // passar pelo bundler — são dependências nativas de Node.
  serverExternalPackages: ["isomorphic-dompurify", "@prisma/client"],
};

export default nextConfig;
