import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { contentRoot, isValidSlug } from "@/lib/content";
import { can, getCurrentUser, getDepartmentAccess, PERMISSIONS } from "@/lib/rbac";

/**
 * Upload de imagem/vídeo para o editor de documentação. Serve como caminho
 * de entrada para o par com src/app/api/media/[deptSlug]/[filename]/route.ts,
 * que serve o arquivo de volta.
 *
 * É uma rota (não uma server action) de propósito: server actions no Next
 * têm um limite de corpo padrão de 1 MB, baixo demais para vídeo.
 */

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const VIDEO_EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const MEDIA_DIR_NAME = "_media";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const departmentSlug = String(formData.get("departmentSlug") ?? "");

  if (!isValidSlug(departmentSlug)) {
    return NextResponse.json({ error: "Departamento inválido." }, { status: 400 });
  }

  const access = await getDepartmentAccess(user, departmentSlug);
  if (
    !access ||
    (!can(access, PERMISSIONS.documentCreate) && !can(access, PERMISSIONS.documentEdit))
  ) {
    return NextResponse.json(
      { error: "Sem permissão para enviar arquivos neste departamento." },
      { status: 403 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const isImage = file.type in IMAGE_EXT_BY_MIME;
  const isVideo = file.type in VIDEO_EXT_BY_MIME;

  if (!isImage && !isVideo) {
    return NextResponse.json(
      {
        error:
          "Formato não suportado. Use PNG, JPEG, GIF ou WEBP para imagem, MP4 ou WEBM para vídeo.",
      },
      { status: 400 },
    );
  }

  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Limite de ${Math.floor(maxBytes / (1024 * 1024))} MB.` },
      { status: 413 },
    );
  }

  const ext = isImage ? IMAGE_EXT_BY_MIME[file.type] : VIDEO_EXT_BY_MIME[file.type];
  const filename = `${randomUUID()}.${ext}`;
  const mediaDir = path.join(contentRoot(), departmentSlug, MEDIA_DIR_NAME);

  try {
    await fs.mkdir(mediaDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(mediaDir, filename), buffer);
  } catch (error) {
    console.error("[api/media/upload] falha ao gravar arquivo:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o arquivo. Verifique as permissões da pasta." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: `/api/media/${departmentSlug}/${filename}`,
    type: file.type,
  });
}
