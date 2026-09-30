import { describe, expect, it } from "vitest";

import { extractInternalDocumentLinks } from "@/lib/document-links";

describe("índice de links internos", () => {
  it("extrai e deduplica apenas URLs canônicas de documentação", () => {
    expect(
      extractInternalDocumentLinks(`
        <!-- title: Documento -->
        <article>
          <a href="/departamentos/engenharia/setup-ambiente">Abrir</a>
          <a href="/departamentos/engenharia/setup-ambiente#docker">Mesmo destino</a>
          <a href="https://example.com">Externo</a>
          <a href="/admin">Admin</a>
        </article>
      `),
    ).toEqual([
      {
        href: "/departamentos/engenharia/setup-ambiente#docker",
        targetDepartmentSlug: "engenharia",
        targetDocumentSlug: "setup-ambiente",
      },
    ]);
  });

  it("ignora atributos removidos pelo sanitizador", () => {
    expect(
      extractInternalDocumentLinks(
        '<article><a href="javascript:alert(1)">não indexar</a></article>',
      ),
    ).toEqual([]);
  });
});

