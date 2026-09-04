import { createHash } from "node:crypto";
import path from "node:path";

import { humanizeSlug, isValidSlug } from "@/lib/slug";

/**
 * Regras de nomenclatura e leitura dos arquivos de documentação.
 * Tudo que toca caminho de arquivo passa por aqui, para que a validação de
 * slug (que é o que impede path traversal) exista em um lugar só.
 */

export const CONTENT_ROOT_RELATIVE =
  process.env.CONTENT_ROOT?.trim() || "content/departamentos";

/**
 * Raiz absoluta das documentações.
 *
 * `turbopackIgnore` porque o conteúdo é lido em runtime, do disco do servidor —
 * sem ele o Turbopack tenta rastrear o projeto inteiro para dentro do bundle.
 */
export function contentRoot(): string {
  return path.isAbsolute(CONTENT_ROOT_RELATIVE)
    ? CONTENT_ROOT_RELATIVE
    : path.join(/* turbopackIgnore: true */ process.cwd(), CONTENT_ROOT_RELATIVE);
}

/** Metadados do departamento, opcionais, em `_departamento.json` dentro da pasta. */
export const DEPARTMENT_META_FILE = "_departamento.json";

/**
 * Mapa de responsabilidades do departamento, opcional, em
 * `_responsabilidades.json` dentro da pasta. Como todo arquivo prefixado com
 * `_`, fica fora do indexador (content-sync.ts), então nunca vira um documento.
 */
export const DEPARTMENT_RESPONSIBILITIES_FILE = "_responsabilidades.json";

// Reexportado para que quem já importa de content.ts continue funcionando —
// a implementação vive em slug.ts porque o client também precisa dela.
export { SLUG_PATTERN, humanizeSlug, isValidSlug, slugify } from "@/lib/slug";

// ---------------------------------------------------------------------------
// Caminhos
// ---------------------------------------------------------------------------

export function departmentDir(departmentSlug: string): string {
  if (!isValidSlug(departmentSlug)) {
    throw new Error(`Slug de departamento inválido: "${departmentSlug}"`);
  }
  return path.join(contentRoot(), departmentSlug);
}

export function documentFile(departmentSlug: string, documentSlug: string): string {
  if (!isValidSlug(documentSlug)) {
    throw new Error(`Slug de documento inválido: "${documentSlug}"`);
  }
  return path.join(departmentDir(departmentSlug), `${documentSlug}.html`);
}

export function departmentResponsibilitiesFile(departmentSlug: string): string {
  return path.join(departmentDir(departmentSlug), DEPARTMENT_RESPONSIBILITIES_FILE);
}

/** Caminho relativo à raiz do projeto — é o formato guardado no banco. */
export function toRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// Front-matter e extração de título
// ---------------------------------------------------------------------------

export type DocumentFrontMatter = {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
};

const FRONT_MATTER_LINE = /^\s*<!--\s*([a-zA-Z][\w-]*)\s*:\s*([\s\S]*?)\s*-->/;

/**
 * Lê os comentários `<!-- chave: valor -->` no topo do arquivo e devolve o
 * restante do HTML. Para de ler no primeiro conteúdo que não é comentário.
 */
export function parseFrontMatter(html: string): {
  frontMatter: DocumentFrontMatter;
  body: string;
} {
  const frontMatter: DocumentFrontMatter = {};
  let rest = html;

  for (;;) {
    const match = FRONT_MATTER_LINE.exec(rest);
    if (!match) break;
    frontMatter[match[1].toLowerCase()] = match[2].trim();
    rest = rest.slice(match[0].length);
  }

  return { frontMatter, body: rest.trim() };
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Título do documento, na ordem: front-matter → <title> → primeiro <h1> →
 * nome do arquivo humanizado.
 */
export function extractTitle(
  html: string,
  frontMatter: DocumentFrontMatter,
  fallbackSlug: string,
): string {
  if (frontMatter.title) return frontMatter.title;

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleTag?.[1]) {
    const text = stripTags(titleTag[1]);
    if (text) return text;
  }

  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1?.[1]) {
    const text = stripTags(h1[1]);
    if (text) return text;
  }

  return humanizeSlug(fallbackSlug);
}

export function extractDescription(
  frontMatter: DocumentFrontMatter,
): string | null {
  if (frontMatter.description) return frontMatter.description;

  return null;
}

/**
 * As linhas de front-matter VERBATIM, na ordem em que aparecem.
 *
 * Existe separado de `parseFrontMatter` porque aquele normaliza a chave para
 * minúsculas — o que serve para ler, mas não para regravar: reescrever
 * `reviewEvery` como `revieweevery` seria uma mudança silenciosa no arquivo do
 * usuário. Aqui a linha volta exatamente como estava.
 */
export function frontMatterLines(
  html: string,
): Array<{ key: string; line: string }> {
  const lines: Array<{ key: string; line: string }> = [];
  let rest = html;

  for (;;) {
    const match = FRONT_MATTER_LINE.exec(rest);
    if (!match) break;
    lines.push({ key: match[1].toLowerCase(), line: match[0].trim() });
    rest = rest.slice(match[0].length);
  }

  return lines;
}

/**
 * Devolve o arquivo com uma chave de front-matter definida: substitui a linha
 * no lugar se ela já existir, senão acrescenta ao fim do cabeçalho. Preserva
 * todo o resto do arquivo byte a byte — é o que uma ação pontual como "marcar
 * como revisada" precisa, em vez de remontar o documento inteiro.
 */
export function withFrontMatter(
  html: string,
  key: string,
  value: string,
): string {
  const line = `<!-- ${key}: ${escapeComment(value)} -->`;
  const existing = frontMatterLines(html);
  const match = existing.find((entry) => entry.key === key.toLowerCase());

  if (match) return html.replace(match.line, line);

  if (existing.length === 0) return `${line}\n${html}`;

  const last = existing[existing.length - 1].line;
  return html.replace(last, `${last}\n${line}`);
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Geração de arquivo (tela "Nova documentação")
// ---------------------------------------------------------------------------

function escapeComment(value: string): string {
  // `--` fecharia o comentário HTML antes da hora.
  return value.replace(/-->/g, "--&gt;").replace(/--/g, "—").trim();
}

/**
 * Monta o arquivo `.html` no mesmo padrão descrito em content/TEMPLATE.md,
 * para que docs criadas pela UI sejam indistinguíveis das criadas à mão.
 */
/** Chaves que `renderDocumentFile` monta sozinho, a partir do formulário. */
const MANAGED_FRONT_MATTER_KEYS = new Set([
  "title",
  "description",
  "author",
  "createdat",
]);

export function renderDocumentFile(input: {
  title: string;
  description?: string | null;
  bodyHtml: string;
  author?: string | null;
  createdAt?: Date;
  /**
   * Front-matter do arquivo atual (de `frontMatterLines`), para que uma edição
   * pela UI não apague chaves que a tela não conhece — `reviewEvery`,
   * `reviewedAt` e qualquer outra que alguém tenha posto à mão. Sem isto, uma
   * única edição pela tela desliga o ciclo de revisão do documento.
   */
  preserve?: ReadonlyArray<{ key: string; line: string }>;
}): string {
  const createdAt = input.createdAt ?? new Date();
  const lines = [
    `<!-- title: ${escapeComment(input.title)} -->`,
  ];

  if (input.description?.trim()) {
    lines.push(`<!-- description: ${escapeComment(input.description)} -->`);
  }
  if (input.author?.trim()) {
    lines.push(`<!-- author: ${escapeComment(input.author)} -->`);
  }
  lines.push(`<!-- createdAt: ${createdAt.toISOString()} -->`);

  for (const entry of input.preserve ?? []) {
    if (MANAGED_FRONT_MATTER_KEYS.has(entry.key)) continue;
    lines.push(entry.line);
  }

  const body = input.bodyHtml.trim();
  const hasArticle = /^<article[\s>]/i.test(body);
  const inner = hasArticle
    ? body
    : `<article>\n${indent(body, 2)}\n</article>`;

  return `${lines.join("\n")}\n${inner}\n`;
}

function indent(value: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}
