import "server-only";

import DOMPurify from "isomorphic-dompurify";

/**
 * O HTML das documentações vem de arquivos no disco e do editor da UI — ou
 * seja, é conteúdo controlado por usuário. Ele é injetado com
 * dangerouslySetInnerHTML, então tem que passar por aqui antes, sempre.
 */

const ALLOWED_TAGS = [
  "article", "section", "div", "span", "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  "a", "img", "figure", "figcaption", "video", "source",
  "blockquote", "q", "cite",
  "code", "pre", "kbd", "samp", "var",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "details", "summary", "abbr", "time",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "id", "class", "colspan", "rowspan",
  "start", "reversed", "datetime", "open", "width", "height", "loading",
  "controls", "preload", "poster", "type",
];

export function sanitizeDocumentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // javascript:, data: e afins ficam de fora; data:image é liberado para
    // imagens embutidas em docs coladas de outros editores.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$)|data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,)/i,
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "link", "meta", "base"],
    FORBID_ATTR: ["style", "srcset", "formaction", "ping"],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

/** Versão em texto puro, para prévias e resumos em listagem. */
export function htmlToPlainText(html: string, maxLength = 240): string {
  const text = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
