import "server-only";

import { parseFrontMatter } from "@/lib/content";
import { sanitizeDocumentHtml } from "@/lib/sanitize";

/**
 * Contrato dos links que o portal consegue acompanhar. Aceitamos somente a
 * rota canônica porque ela continua estável entre editor, Git e servidor.
 * Links externos permanecem livres no HTML, apenas não viram dependência.
 */
const DOCUMENT_LINK = /^\/departamentos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/)?(?:[?#].*)?$/;
const HREF = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

export type InternalDocumentLink = {
  href: string;
  targetDepartmentSlug: string;
  targetDocumentSlug: string;
};

export function extractInternalDocumentLinks(rawHtml: string): InternalDocumentLink[] {
  const { body } = parseFrontMatter(rawHtml);
  const safeHtml = sanitizeDocumentHtml(body);
  const links = new Map<string, InternalDocumentLink>();

  for (const match of safeHtml.matchAll(HREF)) {
    const href = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    const destination = DOCUMENT_LINK.exec(href);
    if (!destination) continue;

    const [, targetDepartmentSlug, targetDocumentSlug] = destination;
    const key = `${targetDepartmentSlug}/${targetDocumentSlug}`;
    links.set(key, { href, targetDepartmentSlug, targetDocumentSlug });
  }

  return [...links.values()];
}

