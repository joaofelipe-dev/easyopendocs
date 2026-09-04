/**
 * Ciclo de revisão das documentações.
 *
 * Documentação interna apodrece em silêncio: nada no portal dizia "isto não é
 * revisado há catorze meses", que é exatamente como um portal perde a
 * confiança de quem o lê.
 *
 * A fonte continua sendo o arquivo, como todo o resto:
 *
 *     <!-- reviewEvery: 180 -->        dias entre revisões
 *     <!-- reviewedAt: 2026-09-04 -->  data da última revisão
 *
 * O departamento pode declarar um padrão em `_departamento.json`
 * (`reviewEveryDays`), e o front-matter do documento sobrepõe. Sem nenhum dos
 * dois, o documento simplesmente não participa — nada de selo falso em
 * documentação que ninguém pediu para acompanhar.
 *
 * Função pura, sem `server-only`: o mesmo cálculo alimenta a listagem, a tela
 * do documento e o painel do admin, e precisa ser testável sem banco.
 */

/** Chaves do front-matter. Minúsculas: `parseFrontMatter` normaliza assim. */
export const REVIEW_EVERY_KEY = "reviewevery";
export const REVIEWED_AT_KEY = "reviewedat";

/** Chave equivalente no `_departamento.json`. */
export const DEPARTMENT_REVIEW_KEY = "reviewEveryDays";

/** Dez anos. Acima disso é erro de digitação, não política de revisão. */
const MAX_INTERVAL_DAYS = 3650;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lê um intervalo de revisão vindo do arquivo (front-matter ou JSON do
 * departamento). Devolve null para qualquer coisa que não seja um número
 * inteiro de dias plausível — o arquivo é editável à mão, e um valor
 * estragado não pode virar um selo errado.
 */
export function parseReviewInterval(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_INTERVAL_DAYS) return null;

  return parsed;
}

/** Lê `reviewedAt`. Aceita `2026-09-04` e ISO 8601 completo. */
export function parseReviewedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formato gravado por `markDocumentReviewedAction`: só a data, sem hora. */
export function formatReviewedAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Cálculo do estado
// ---------------------------------------------------------------------------

export type ReviewStatus =
  /** Nem o documento nem o departamento declararam intervalo. */
  | { kind: "off" }
  | { kind: "ok"; intervalDays: number; dueAt: Date; daysLeft: number }
  /** Ainda em dia, mas perto do vencimento. */
  | { kind: "soon"; intervalDays: number; dueAt: Date; daysLeft: number }
  | { kind: "overdue"; intervalDays: number; dueAt: Date; daysLate: number };

/**
 * Janela de aviso antes do vencimento: um quarto do ciclo, no máximo 14 dias.
 * Proporcional para que um ciclo de 30 dias não passe metade da vida "quase
 * vencendo", e com teto para que um ciclo anual não avise com meses de
 * antecedência.
 */
function warningWindow(intervalDays: number): number {
  return Math.max(1, Math.min(14, Math.round(intervalDays / 4)));
}

export function reviewStatus(input: {
  /** Do front-matter do documento. */
  documentIntervalDays: number | null;
  /** Do `_departamento.json`. Usado só quando o documento não declara. */
  departmentIntervalDays: number | null;
  lastReviewedAt: Date | null;
  /**
   * Usada como "última revisão" quando o arquivo não declara `reviewedAt`:
   * na prática, editar um documento É revisá-lo, e sem esse fallback todo
   * documento de um departamento com padrão nasceria vencido no primeiro dia.
   */
  fallbackDate: Date;
  now?: Date;
}): ReviewStatus {
  const intervalDays = input.documentIntervalDays ?? input.departmentIntervalDays;
  if (intervalDays === null) return { kind: "off" };

  const from = input.lastReviewedAt ?? input.fallbackDate;
  const now = input.now ?? new Date();
  const dueAt = new Date(from.getTime() + intervalDays * DAY_MS);

  // Dias inteiros: um vencimento daqui a 3h e um daqui a 20h são ambos "hoje",
  // e a tela não deve alternar entre 0 e 1 conforme a hora do dia.
  const diffDays = Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS);

  if (diffDays < 0) {
    return { kind: "overdue", intervalDays, dueAt, daysLate: -diffDays };
  }
  if (diffDays <= warningWindow(intervalDays)) {
    return { kind: "soon", intervalDays, dueAt, daysLeft: diffDays };
  }

  return { kind: "ok", intervalDays, dueAt, daysLeft: diffDays };
}

/** Rótulo curto para o selo da listagem e da tela do documento. */
export function reviewLabel(status: ReviewStatus): string | null {
  switch (status.kind) {
    case "off":
      return null;
    case "ok":
      return "Revisão em dia";
    case "soon":
      return status.daysLeft === 0
        ? "Revisão vence hoje"
        : `Revisão vence em ${status.daysLeft} ${status.daysLeft === 1 ? "dia" : "dias"}`;
    case "overdue":
      return status.daysLate === 0
        ? "Revisão vencida hoje"
        : `Revisão vencida há ${status.daysLate} ${status.daysLate === 1 ? "dia" : "dias"}`;
  }
}
