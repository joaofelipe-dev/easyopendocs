import "server-only";

import { parseFrontMatter, type DocumentFrontMatter } from "@/lib/content";
import { sanitizeDocumentHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";

export type DocumentHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type RenderedDocument = {
  frontMatter: DocumentFrontMatter;
  html: string;
  headings: DocumentHeading[];
};

const HEADING_PATTERN = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const EXISTING_ID = /\bid\s*=\s*"([^"]*)"/i;

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dá um `id` estável a cada h2/h3 e devolve a lista para montar o índice
 * lateral. Roda depois do sanitizador, então o HTML aqui já é confiável.
 */
function withHeadingAnchors(html: string): {
  html: string;
  headings: DocumentHeading[];
} {
  const headings: DocumentHeading[] = [];
  const usedIds = new Set<string>();

  const output = html.replace(
    HEADING_PATTERN,
    (match, rawLevel: string, attrs: string, inner: string) => {
      const text = textOf(inner);
      if (!text) return match;

      const base =
        EXISTING_ID.exec(attrs)?.[1] ||
        slugify(text) ||
        `secao-${headings.length + 1}`;

      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) id = `${base}-${suffix++}`;
      usedIds.add(id);

      headings.push({ id, text, level: Number(rawLevel) as 2 | 3 });

      const otherAttrs = attrs.replace(EXISTING_ID, "").trim();
      return `<h${rawLevel} id="${id}"${otherAttrs ? ` ${otherAttrs}` : ""}>${inner}</h${rawLevel}>`;
    },
  );

  return { html: output, headings };
}

/** Pipeline completo: front-matter -> sanitização -> âncoras -> índice. */
export function renderDocument(rawHtml: string): RenderedDocument {
  const { frontMatter, body } = parseFrontMatter(rawHtml);
  const sanitized = sanitizeDocumentHtml(body);
  const { html, headings } = withHeadingAnchors(sanitized);

  return { frontMatter, html, headings };
}
