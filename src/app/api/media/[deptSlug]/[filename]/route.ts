import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { contentRoot, isValidSlug } from "@/lib/content";
import { getCurrentUser, getDepartmentAccess } from "@/lib/rbac";

import { MEDIA_DIR_NAME } from "../../upload/route";

/**
 * Serve imagens/vídeos enviados pelo editor. CONTENT_ROOT pode viver fora de
 * `public/`, então precisa de rota própria em vez de servir estático — e essa
 * rota reaplica a mesma checagem de acesso por departamento das documentações,
 * já que o navegador busca <img>/<video> com o cookie de sessão de qualquer jeito.
 */

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

// Só aceitamos os nomes que a própria rota de upload gera: uuid + extensão
// conhecida. Qualquer outra coisa é tratada como inválida antes de tocar o disco.
const FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|gif|webp|mp4|webm)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deptSlug: string; filename: string }> },
): Promise<NextResponse> {
  const { deptSlug, filename } = await params;

  if (!isValidSlug(deptSlug) || !FILENAME_PATTERN.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const access = await getDepartmentAccess(user, deptSlug);
  if (!access) return new NextResponse("Forbidden", { status: 403 });

  const filePath = path.join(contentRoot(), deptSlug, MEDIA_DIR_NAME, filename);

  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
