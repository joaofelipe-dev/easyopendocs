import { describe, expect, it } from "vitest";

import { diffDocuments, type DiffBlock } from "@/lib/text-diff";

/**
 * `diffDocuments` é função pura — não precisa de banco nem de disco, ao
 * contrário do resto da suíte. Está aqui porque é a lógica que decide o que a
 * tela de histórico mostra como "mudou", e errar isso é mostrar um diff que
 * mente.
 *
 * As entradas são HTML de documentação, não texto solto, porque é exatamente
 * isso que a função recebe: o arquivo bruto de uma versão.
 */

function texts(blocks: DiffBlock[], type: "add" | "remove" | "equal"): string[] {
  return blocks.flatMap((block) => (block.type === type ? [block.text] : []));
}

function doc(...blocks: string[]): string {
  return `<!-- title: Backup -->\n<article>\n${blocks.map((b) => `  ${b}`).join("\n")}\n</article>\n`;
}

describe("diffDocuments", () => {
  it("não acusa diferença entre documentos idênticos", () => {
    const html = doc("<p>alfa</p>", "<p>beta</p>");
    const diff = diffDocuments(html, html);

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.truncated).toBe(false);
  });

  it("identifica parágrafo acrescentado", () => {
    const diff = diffDocuments(
      doc("<p>alfa</p>", "<p>gama</p>"),
      doc("<p>alfa</p>", "<p>beta</p>", "<p>gama</p>"),
    );

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(0);
    expect(texts(diff.blocks, "add")).toEqual(["<p>beta</p>"]);
  });

  it("identifica parágrafo removido", () => {
    const diff = diffDocuments(
      doc("<p>alfa</p>", "<p>beta</p>"),
      doc("<p>alfa</p>"),
    );

    expect(texts(diff.blocks, "remove")).toEqual(["<p>beta</p>"]);
    expect(diff.added).toBe(0);
  });

  it("um parágrafo alterado é uma remoção mais uma adição", () => {
    const diff = diffDocuments(doc("<p>alfa</p>"), doc("<p>ALFA</p>"));

    expect(texts(diff.blocks, "remove")).toEqual(["<p>alfa</p>"]);
    expect(texts(diff.blocks, "add")).toEqual(["<p>ALFA</p>"]);
  });

  it("mostra o front-matter como blocos separados", () => {
    // Trocar o título não pode aparecer como "o cabeçalho inteiro mudou".
    const diff = diffDocuments(
      "<!-- title: Backup -->\n<!-- description: Rotina -->\n<article><p>x</p></article>",
      "<!-- title: Backup diário -->\n<!-- description: Rotina -->\n<article><p>x</p></article>",
    );

    expect(texts(diff.blocks, "remove")).toEqual(["<!-- title: Backup -->"]);
    expect(texts(diff.blocks, "add")).toEqual(["<!-- title: Backup diário -->"]);
  });

  it("ignora diferença de fim de linha entre Windows e Unix", () => {
    // Um arquivo aberto e salvo no Bloco de Notas volta com \r\n. Sem isso,
    // o histórico acusaria "tudo mudou" a cada salvamento.
    const html = doc("<p>alfa</p>");
    const diff = diffDocuments(html, html.replace(/\n/g, "\r\n"));

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
  });

  it("ignora a indentação: o mesmo HTML formatado de outro jeito não mudou", () => {
    const indentado = "<article>\n  <p>alfa</p>\n  <p>beta</p>\n</article>";
    const umaLinha = "<article><p>alfa</p><p>beta</p></article>";

    const diff = diffDocuments(indentado, umaLinha);

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
  });

  it("casa um parágrafo quebrado em várias linhas com o mesmo numa linha só", () => {
    // É o caso mais comum do portal: o arquivo veio escrito à mão, alguém
    // editou pela tela e o editor regravou o corpo inteiro numa linha. Um
    // diff por linha diria "tudo removido, tudo adicionado".
    const aMao = [
      "<article>",
      "  <p>",
      "    Este parágrafo veio quebrado",
      "    em três linhas.",
      "  </p>",
      "</article>",
    ].join("\n");
    const peloEditor =
      "<article><p>Este parágrafo veio quebrado em três linhas.</p><p>Novo aviso.</p></article>";

    const diff = diffDocuments(aMao, peloEditor);

    expect(texts(diff.blocks, "add")).toEqual(["<p>Novo aviso.</p>"]);
    expect(diff.removed).toBe(0);
  });

  it("acha o item alterado dentro de uma lista", () => {
    const diff = diffDocuments(
      doc("<ul><li>um</li><li>dois</li></ul>"),
      doc("<ul><li>um</li><li>DOIS</li></ul>"),
    );

    expect(texts(diff.blocks, "remove")).toEqual(["<li>dois</li>"]);
    expect(texts(diff.blocks, "add")).toEqual(["<li>DOIS</li>"]);
  });

  it("colapsa sequências longas de blocos iguais em um marcador", () => {
    const antes = doc(...[...Array(40).keys()].map((n) => `<p>bloco ${n}</p>`));
    const depois = antes.replace("<p>bloco 20</p>", "<p>bloco vinte</p>");

    const diff = diffDocuments(antes, depois, { context: 2 });

    expect(diff.blocks.some((block) => block.type === "gap")).toBe(true);
    expect(diff.blocks.length).toBeLessThan(12);
  });

  it("mostra tudo quando não há mudança nenhuma para contextualizar", () => {
    const html = doc("<p>alfa</p>", "<p>beta</p>");
    const diff = diffDocuments(html, html, { context: 1 });

    expect(diff.blocks.every((block) => block.type === "equal")).toBe(true);
  });

  it("avisa em vez de comparar quando os documentos são grandes demais", () => {
    const enorme = doc(...[...Array(5000).keys()].map((n) => `<p>${n}</p>`));
    const diff = diffDocuments(enorme, `${enorme}<p>mais um</p>`);

    expect(diff.truncated).toBe(true);
    expect(diff.blocks).toEqual([]);
  });

  it("lida com um dos lados vazio", () => {
    expect(diffDocuments("", "<p>um</p><p>dois</p>").added).toBe(2);
    expect(diffDocuments("<p>um</p><p>dois</p>", "").removed).toBe(2);
  });
});
