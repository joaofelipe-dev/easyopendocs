import { describe, expect, it } from "vitest";

import {
  documentHealthIssues,
  parseDocumentMetadata,
  validateDocumentMetadata,
} from "@/lib/document-health";

describe("metadados de saúde", () => {
  it("usa valores seguros quando as chaves não existem", () => {
    expect(parseDocumentMetadata({})).toEqual({
      owner: null,
      criticality: "normal",
      status: "active",
    });
  });

  it("recusa enum inválido sem transformar a ausência em erro", () => {
    expect(validateDocumentMetadata({ criticality: "urgente", status: "archived" })).toEqual([
      { key: "criticality", message: "criticality deve ser low, normal, high." },
      { key: "status", message: "status deve ser active ou deprecated." },
    ]);
    expect(validateDocumentMetadata({})).toEqual([]);
  });

  it("expõe apenas as lacunas relevantes para conteúdo ativo", () => {
    expect(
      documentHealthIssues({
        owner: null,
        description: null,
        criticality: "high",
        status: "active",
        review: { kind: "off" },
      }),
    ).toEqual(["missing-owner", "missing-description", "high-without-review"]);

    expect(
      documentHealthIssues({
        owner: null,
        description: null,
        criticality: "high",
        status: "deprecated",
        review: { kind: "off" },
      }),
    ).toEqual([]);
  });
});

