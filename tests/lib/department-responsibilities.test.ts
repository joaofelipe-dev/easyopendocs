import { describe, expect, it } from "vitest";

import {
  parseResponsibilities,
  resolveResponsibilities,
} from "@/lib/department-responsibilities";

/**
 * Lógica pura (sem banco, sem disco) — mas com consequência real: é o que
 * decide se um `_responsabilidades.json` editado à mão no disco é aceito ou
 * rejeitado, e é o que calcula "responsabilidade sem documentação" que a
 * tela mostra.
 */
describe("parseResponsibilities", () => {
  it("gera ids a partir do título quando o arquivo não trouxe um", () => {
    const parsed = parseResponsibilities({
      areas: [
        {
          title: "Infraestrutura",
          items: [{ title: "Backup e restore" }],
        },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.responsibilities.areas[0].id).toBe("infraestrutura");
    expect(parsed.responsibilities.areas[0].items[0].id).toBe("backup-e-restore");
  });

  it("preserva um id existente em vez de gerar um novo a partir do título", () => {
    const parsed = parseResponsibilities({
      areas: [
        {
          id: "infra-legado",
          title: "Infraestrutura (renomeada)",
          items: [],
        },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // Se regenerasse do título, qualquer `deliversTo` apontando para
    // "infra-legado" em outro arquivo ficaria quebrado ao simplesmente
    // renomear o título de uma frente.
    expect(parsed.responsibilities.areas[0].id).toBe("infra-legado");
  });

  it("desambigua ids colidentes com sufixo numérico", () => {
    const parsed = parseResponsibilities({
      areas: [
        { title: "Infraestrutura", items: [] },
        { title: "Infraestrutura", items: [] },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const ids = parsed.responsibilities.areas.map((area) => area.id);
    expect(ids).toEqual(["infraestrutura", "infraestrutura-2"]);
  });

  it("remove referências de deliversTo para ids que não existem", () => {
    const parsed = parseResponsibilities({
      areas: [
        {
          title: "Infraestrutura",
          items: [
            { id: "a", title: "A", deliversTo: ["b", "id-fantasma"] },
            { id: "b", title: "B", deliversTo: [] },
          ],
        },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.responsibilities.areas[0].items[0].deliversTo).toEqual(["b"]);
  });

  it("remove auto-referência em deliversTo (um item não entrega para si mesmo)", () => {
    const parsed = parseResponsibilities({
      areas: [{ title: "Infraestrutura", items: [{ id: "a", title: "A", deliversTo: ["a"] }] }],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.responsibilities.areas[0].items[0].deliversTo).toEqual([]);
  });

  it("rejeita frente sem título, com mensagem que localiza o campo", () => {
    const parsed = parseResponsibilities({ areas: [{ title: "", items: [] }] });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.toLowerCase()).toContain("título");
  });

  it("rejeita um valor que não é um objeto de diagrama válido", () => {
    expect(parseResponsibilities("não é json de diagrama").ok).toBe(false);
    expect(parseResponsibilities(null).ok).toBe(false);
  });
});

describe("resolveResponsibilities", () => {
  const documents = [{ slug: "rotina-de-backup", title: "Rotina de backup" }];

  it("marca como 'missing' um slug de documento que não existe no departamento", () => {
    const parsed = parseResponsibilities({
      areas: [
        {
          title: "Infraestrutura",
          items: [{ title: "Backup", docs: ["rotina-de-backup", "slug-apagado"] }],
        },
      ],
    });
    if (!parsed.ok) throw new Error("fixture inválida");

    const resolved = resolveResponsibilities(parsed.responsibilities, documents);
    const item = resolved.areas[0].items[0];

    expect(item.documents).toEqual([
      { slug: "rotina-de-backup", title: "Rotina de backup", missing: false },
      { slug: "slug-apagado", title: "slug-apagado", missing: true },
    ]);
    expect(resolved.missingDocCount).toBe(1);
  });

  it("só conta 'sem documentação' quando NENHUM doc do item resolve", () => {
    const parsed = parseResponsibilities({
      areas: [
        {
          title: "Infraestrutura",
          items: [
            { title: "Coberta", docs: ["rotina-de-backup"] },
            { title: "Parcialmente coberta", docs: ["rotina-de-backup", "sumiu"] },
            { title: "Descoberta", docs: ["tambem-sumiu"] },
            { title: "Sem vínculo nenhum", docs: [] },
          ],
        },
      ],
    });
    if (!parsed.ok) throw new Error("fixture inválida");

    const resolved = resolveResponsibilities(parsed.responsibilities, documents);

    expect(resolved.itemCount).toBe(4);
    // "Parcialmente coberta" tem 1 doc real entre os 2 — não conta como
    // descoberta, mesmo tendo uma referência quebrada também.
    expect(resolved.uncoveredCount).toBe(2); // "Descoberta" e "Sem vínculo nenhum"
  });
});
