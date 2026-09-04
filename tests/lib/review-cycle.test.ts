import { describe, expect, it } from "vitest";

import {
  formatReviewedAt,
  parseReviewInterval,
  parseReviewedAt,
  reviewLabel,
  reviewStatus,
} from "@/lib/review-cycle";

/**
 * Lógica pura do ciclo de revisão. Os valores vêm de arquivo editável à mão,
 * então metade dos casos aqui é entrada estragada: um `reviewEvery: muitos`
 * não pode virar um selo errado — e "vencida há 3 dias" é o tipo de afirmação
 * que o portal não pode errar sem perder a confiança de quem lê.
 */

const DIA = 24 * 60 * 60 * 1000;

function diasAtras(dias: number): Date {
  return new Date(Date.now() - dias * DIA);
}

describe("parseReviewInterval", () => {
  it("aceita inteiro positivo, como número ou string", () => {
    expect(parseReviewInterval(180)).toBe(180);
    expect(parseReviewInterval("180")).toBe(180);
    expect(parseReviewInterval(" 90 ")).toBe(90);
    expect(parseReviewInterval(1)).toBe(1);
  });

  it("recusa qualquer coisa que não seja um intervalo plausível", () => {
    for (const valor of [
      0,
      -30,
      1.5,
      "90 dias",
      "muitos",
      "",
      "   ",
      null,
      undefined,
      {},
      Number.NaN,
      Number.POSITIVE_INFINITY,
      // Dez anos e um dia: erro de digitação, não política de revisão.
      3651,
    ]) {
      expect(parseReviewInterval(valor)).toBeNull();
    }
  });
});

describe("parseReviewedAt", () => {
  it("aceita data simples e ISO completo", () => {
    expect(parseReviewedAt("2026-09-04")?.toISOString()).toBe(
      "2026-09-04T00:00:00.000Z",
    );
    expect(parseReviewedAt("2026-09-04T12:30:00.000Z")).toBeInstanceOf(Date);
  });

  it("recusa data inválida", () => {
    for (const valor of ["ontem", "2026-13-45", "", null, 20260904]) {
      expect(parseReviewedAt(valor)).toBeNull();
    }
  });
});

describe("formatReviewedAt", () => {
  it("grava só a data, sem hora", () => {
    expect(formatReviewedAt(new Date("2026-09-04T18:45:00.000Z"))).toBe("2026-09-04");
  });
});

describe("reviewStatus", () => {
  it("fica fora do ciclo quando nem o documento nem o departamento declaram", () => {
    const status = reviewStatus({
      documentIntervalDays: null,
      departmentIntervalDays: null,
      lastReviewedAt: diasAtras(3650),
      fallbackDate: diasAtras(3650),
    });

    expect(status.kind).toBe("off");
    expect(reviewLabel(status)).toBeNull();
  });

  it("herda o intervalo do departamento quando o documento não declara", () => {
    const status = reviewStatus({
      documentIntervalDays: null,
      departmentIntervalDays: 30,
      lastReviewedAt: diasAtras(5),
      fallbackDate: diasAtras(5),
    });

    expect(status).toMatchObject({ kind: "ok", intervalDays: 30 });
  });

  it("o front-matter do documento vence o padrão do departamento", () => {
    // Departamento pede revisão anual; este documento pede semanal e já
    // venceu. O mais específico manda.
    const status = reviewStatus({
      documentIntervalDays: 7,
      departmentIntervalDays: 365,
      lastReviewedAt: diasAtras(30),
      fallbackDate: diasAtras(30),
    });

    expect(status).toMatchObject({ kind: "overdue", intervalDays: 7 });
  });

  it("usa a data do arquivo como última revisão quando não há reviewedAt", () => {
    // Sem esse fallback, ligar o ciclo num departamento marcaria toda a
    // documentação existente como vencida no mesmo dia.
    const status = reviewStatus({
      documentIntervalDays: 180,
      departmentIntervalDays: null,
      lastReviewedAt: null,
      fallbackDate: diasAtras(1),
    });

    expect(status.kind).toBe("ok");
  });

  it("reviewedAt manda sobre a data do arquivo", () => {
    const status = reviewStatus({
      documentIntervalDays: 30,
      departmentIntervalDays: null,
      lastReviewedAt: diasAtras(90),
      // Arquivo tocado ontem, mas a revisão de verdade foi há 90 dias.
      fallbackDate: diasAtras(1),
    });

    expect(status).toMatchObject({ kind: "overdue" });
  });

  it("conta os dias de atraso a partir do vencimento", () => {
    const status = reviewStatus({
      documentIntervalDays: 30,
      departmentIntervalDays: null,
      lastReviewedAt: diasAtras(40),
      fallbackDate: diasAtras(40),
    });

    expect(status).toMatchObject({ kind: "overdue", daysLate: 10 });
    expect(reviewLabel(status)).toBe("Revisão vencida há 10 dias");
  });

  it("no dia exato do vencimento ainda não está vencida", () => {
    const agora = new Date("2026-09-04T12:00:00.000Z");
    const status = reviewStatus({
      documentIntervalDays: 30,
      departmentIntervalDays: null,
      lastReviewedAt: new Date("2026-08-05T12:00:00.000Z"),
      fallbackDate: new Date("2026-08-05T12:00:00.000Z"),
      now: agora,
    });

    expect(status.kind).toBe("soon");
    expect(reviewLabel(status)).toBe("Revisão vence hoje");
  });

  it("um dia depois do vencimento está vencida", () => {
    const agora = new Date("2026-09-05T12:00:01.000Z");
    const status = reviewStatus({
      documentIntervalDays: 30,
      departmentIntervalDays: null,
      lastReviewedAt: new Date("2026-08-05T12:00:00.000Z"),
      fallbackDate: new Date("2026-08-05T12:00:00.000Z"),
      now: agora,
    });

    expect(status).toMatchObject({ kind: "overdue", daysLate: 1 });
  });

  it("a janela de aviso é proporcional ao ciclo, com teto de 14 dias", () => {
    // Ciclo de 30 dias: avisa nos últimos ~8. Faltando 10, ainda é "ok".
    expect(
      reviewStatus({
        documentIntervalDays: 30,
        departmentIntervalDays: null,
        lastReviewedAt: diasAtras(20),
        fallbackDate: diasAtras(20),
      }).kind,
    ).toBe("ok");

    expect(
      reviewStatus({
        documentIntervalDays: 30,
        departmentIntervalDays: null,
        lastReviewedAt: diasAtras(25),
        fallbackDate: diasAtras(25),
      }).kind,
    ).toBe("soon");

    // Ciclo anual: sem teto, avisaria com três meses de antecedência.
    expect(
      reviewStatus({
        documentIntervalDays: 365,
        departmentIntervalDays: null,
        lastReviewedAt: diasAtras(300),
        fallbackDate: diasAtras(300),
      }).kind,
    ).toBe("ok");

    expect(
      reviewStatus({
        documentIntervalDays: 365,
        departmentIntervalDays: null,
        lastReviewedAt: diasAtras(360),
        fallbackDate: diasAtras(360),
      }).kind,
    ).toBe("soon");
  });
});

describe("reviewLabel", () => {
  it("concorda em número", () => {
    const umDia = reviewStatus({
      documentIntervalDays: 30,
      departmentIntervalDays: null,
      lastReviewedAt: diasAtras(31),
      fallbackDate: diasAtras(31),
    });

    expect(reviewLabel(umDia)).toBe("Revisão vencida há 1 dia");
  });
});
