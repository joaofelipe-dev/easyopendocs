import type { DocumentFrontMatter } from "@/lib/content";
import type { ReviewStatus } from "@/lib/review-cycle";

/** Chaves públicas do contrato de conteúdo. Permanecem no HTML, não no banco. */
export const DOCUMENT_OWNER_KEY = "owner";
export const DOCUMENT_CRITICALITY_KEY = "criticality";
export const DOCUMENT_STATUS_KEY = "status";

export const DOCUMENT_CRITICALITIES = ["low", "normal", "high"] as const;
export const DOCUMENT_STATUSES = ["active", "deprecated"] as const;

export type DocumentCriticality = (typeof DOCUMENT_CRITICALITIES)[number];
export type DocumentContentStatus = (typeof DOCUMENT_STATUSES)[number];

export type DocumentMetadata = {
  owner: string | null;
  criticality: DocumentCriticality;
  status: DocumentContentStatus;
};

export type MetadataValidationIssue = {
  key: "owner" | "criticality" | "status";
  message: string;
};

function optionalValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseDocumentMetadata(frontMatter: DocumentFrontMatter): DocumentMetadata {
  const owner = optionalValue(frontMatter[DOCUMENT_OWNER_KEY]);
  const criticality = optionalValue(frontMatter[DOCUMENT_CRITICALITY_KEY]);
  const status = optionalValue(frontMatter[DOCUMENT_STATUS_KEY]);

  return {
    owner,
    criticality: DOCUMENT_CRITICALITIES.includes(criticality as DocumentCriticality)
      ? (criticality as DocumentCriticality)
      : "normal",
    status: DOCUMENT_STATUSES.includes(status as DocumentContentStatus)
      ? (status as DocumentContentStatus)
      : "active",
  };
}

/**
 * Invalidez interrompe o CI; ausência é um aviso de adoção gradual. Assim o
 * projeto não obriga quem já possui centenas de arquivos a migrar tudo num PR.
 */
export function validateDocumentMetadata(
  frontMatter: DocumentFrontMatter,
): MetadataValidationIssue[] {
  const issues: MetadataValidationIssue[] = [];
  const owner = optionalValue(frontMatter[DOCUMENT_OWNER_KEY]);
  const criticality = optionalValue(frontMatter[DOCUMENT_CRITICALITY_KEY]);
  const status = optionalValue(frontMatter[DOCUMENT_STATUS_KEY]);

  if (owner && owner.length > 120) {
    issues.push({ key: "owner", message: "owner aceita no máximo 120 caracteres." });
  }
  if (criticality && !DOCUMENT_CRITICALITIES.includes(criticality as DocumentCriticality)) {
    issues.push({
      key: "criticality",
      message: `criticality deve ser ${DOCUMENT_CRITICALITIES.join(", ")}.`,
    });
  }
  if (status && !DOCUMENT_STATUSES.includes(status as DocumentContentStatus)) {
    issues.push({
      key: "status",
      message: `status deve ser ${DOCUMENT_STATUSES.join(" ou ")}.`,
    });
  }
  return issues;
}

export type HealthIssue = "missing-owner" | "missing-description" | "high-without-review";

export function documentHealthIssues(input: {
  owner: string | null;
  description: string | null;
  criticality: DocumentCriticality;
  status: DocumentContentStatus;
  review: ReviewStatus;
}): HealthIssue[] {
  // Conteúdo arquivado é visível por transparência, mas não deve poluir a fila
  // de trabalho operacional.
  if (input.status === "deprecated") return [];

  const issues: HealthIssue[] = [];
  if (!input.owner) issues.push("missing-owner");
  if (!input.description) issues.push("missing-description");
  if (input.criticality === "high" && input.review.kind === "off") {
    issues.push("high-without-review");
  }
  return issues;
}

export function healthIssueLabel(issue: HealthIssue): string {
  switch (issue) {
    case "missing-owner":
      return "Sem responsável";
    case "missing-description":
      return "Sem resumo";
    case "high-without-review":
      return "Crítica sem ciclo de revisão";
  }
}

