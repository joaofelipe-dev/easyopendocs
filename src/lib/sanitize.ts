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

// A saída do DOMPurify continua sendo HTML: com as tags fora, sobram as
// entidades reescapadas. Decodificá-las aqui é seguro porque neste ponto a
// string já é texto puro — e sem isso o índice de busca ficaria cheio de "amp".
const ENTITIES: ReadonlyArray<[RegExp, string]> = [
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&nbsp;/g, " "],
  // Por último: decodificar &amp; antes das outras recriaria entidades.
  [/&amp;/g, "&"],
];

/**
 * Versão em texto puro, para prévias, resumos em listagem e para o índice de
 * busca. `maxLength: null` desliga o corte — é o que a indexação usa, já que
 * truncar o corpo tornaria o documento inencontrável pelo próprio conteúdo.
 */
export function htmlToPlainText(
  html: string,
  maxLength: number | null = 240,
): string {
  // Sem separar as tags, `<p>alfa</p><p>beta</p>` vira "alfabeta": uma palavra
  // que não existe no documento e que o índice passaria a conter. O padrão só
  // casa o que parece tag de verdade, para não picotar um `a < b` solto.
  const spaced = html.replace(/<[a-z!/][^>]*>/gi, " $& ");

  let text = DOMPurify.sanitize(spaced, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  for (const [pattern, replacement] of ENTITIES) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s+/g, " ").trim();

  if (maxLength === null || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}
