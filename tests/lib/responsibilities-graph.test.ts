import { describe, expect, it } from "vitest";

import {
  resolveResponsibilities,
  type DepartmentResponsibilities,
} from "@/lib/department-responsibilities";
import {
  buildResponsibilitiesGraph,
  neighboursOf,
  NODE_WIDTH,
} from "@/lib/responsibilities-graph";

/**
 * Layout do diagrama. Lógica pura, como o resto de
 * department-responsibilities.ts — e é a parte que erra em silêncio: bloco
 * sobreposto, texto para fora da caixa e seta apontando para o nada não
 * quebram nada, só desenham errado.
 */

function mapa(
  areas: Array<{
    id: string;
    title: string;
    items: Array<{
      id: string;
      title: string;
      owner?: string | null;
      docs?: string[];
      deliversTo?: string[];
    }>;
  }>,
): DepartmentResponsibilities {
  return {
    areas: areas.map((area) => ({
      id: area.id,
      title: area.title,
      items: area.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: null,
        owner: item.owner ?? null,
        docs: item.docs ?? [],
        deliversTo: item.deliversTo ?? [],
      })),
    })),
  };
}

function build(
  responsibilities: DepartmentResponsibilities,
  documents: Array<{ slug: string; title: string }> = [],
) {
  return buildResponsibilitiesGraph(
    resolveResponsibilities(responsibilities, documents),
  );
}

describe("buildResponsibilitiesGraph", () => {
  it("devolve um grafo vazio para um mapa vazio", () => {
    const graph = build({ areas: [] });

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.columns).toEqual([]);
    expect(graph.width).toBe(0);
  });

  it("põe uma coluna por frente, na ordem do arquivo", () => {
    const graph = build(
      mapa([
        { id: "infra", title: "Infraestrutura", items: [] },
        { id: "produto", title: "Produto", items: [] },
      ]),
    );

    expect(graph.columns.map((c) => c.title)).toEqual(["Infraestrutura", "Produto"]);
    expect(graph.columns[0].x).toBe(0);
    expect(graph.columns[1].x).toBeGreaterThanOrEqual(NODE_WIDTH);
  });

  it("empilha os blocos de uma frente sem sobrepor", () => {
    const graph = build(
      mapa([
        {
          id: "infra",
          title: "Infra",
          items: [
            { id: "a", title: "Backup" },
            { id: "b", title: "Monitoramento" },
            { id: "c", title: "Rede" },
          ],
        },
      ]),
    );

    expect(graph.nodes).toHaveLength(3);
    for (let i = 1; i < graph.nodes.length; i += 1) {
      const anterior = graph.nodes[i - 1];
      expect(graph.nodes[i].y).toBeGreaterThanOrEqual(anterior.y + anterior.height);
    }
  });

  it("blocos de frentes diferentes não se sobrepõem na horizontal", () => {
    const graph = build(
      mapa([
        { id: "a", title: "A", items: [{ id: "a1", title: "A1" }] },
        { id: "b", title: "B", items: [{ id: "b1", title: "B1" }] },
      ]),
    );

    const [primeiro, segundo] = graph.nodes;
    expect(segundo.x).toBeGreaterThanOrEqual(primeiro.x + primeiro.width);
  });

  it("o texto cabe dentro do bloco", () => {
    // Se `height` e as posições do texto divergirem, o rodapé sai para fora da
    // caixa e nada acusa — daí a checagem.
    const graph = build(
      mapa([
        {
          id: "infra",
          title: "Infra",
          items: [
            {
              id: "a",
              title: "Um título bem comprido que precisa quebrar em várias linhas",
              owner: "Ana",
            },
          ],
        },
      ]),
    );

    const [node] = graph.nodes;
    expect(node.text.footerY).toBeLessThan(node.height);
    expect(node.text.ownerY).not.toBeNull();
    expect(node.text.ownerY!).toBeLessThan(node.text.footerY);
    expect(node.text.titleY).toBeGreaterThan(0);
  });

  it("quebra o título sem cortar palavra e limita a três linhas", () => {
    const graph = build(
      mapa([
        {
          id: "infra",
          title: "Infra",
          items: [
            { id: "curto", title: "Backup" },
            { id: "longo", title: "palavra ".repeat(30).trim() },
          ],
        },
      ]),
    );

    const [curto, longo] = graph.nodes;
    expect(curto.titleLines).toEqual(["Backup"]);
    expect(longo.titleLines.length).toBeLessThanOrEqual(3);
    expect(longo.titleLines[2].endsWith("…")).toBe(true);
  });

  it("cria uma aresta por deliversTo", () => {
    const graph = build(
      mapa([
        { id: "a", title: "A", items: [{ id: "a1", title: "A1", deliversTo: ["b1"] }] },
        { id: "b", title: "B", items: [{ id: "b1", title: "B1" }] },
      ]),
    );

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: "a1", to: "b1" });
    expect(graph.edges[0].path.startsWith("M ")).toBe(true);
  });

  it("liga blocos da mesma frente", () => {
    const graph = build(
      mapa([
        {
          id: "a",
          title: "A",
          items: [
            { id: "a1", title: "A1", deliversTo: ["a2"] },
            { id: "a2", title: "A2" },
          ],
        },
      ]),
    );

    expect(graph.edges.map((e) => e.id)).toEqual(["a1->a2"]);
  });

  it("ignora referência que não aponta para bloco nenhum", () => {
    // A normalização já poda isso, mas um `_responsabilidades.json` escrito à
    // mão chega aqui pelo mesmo caminho — e uma seta para o nada quebraria o
    // SVG em vez de simplesmente não aparecer.
    const graph = buildResponsibilitiesGraph({
      areas: [
        {
          id: "a",
          title: "A",
          items: [
            {
              id: "a1",
              title: "A1",
              description: null,
              owner: null,
              deliversTo: ["nao-existe", "a1"],
              documents: [],
            },
          ],
        },
      ],
      itemCount: 1,
      uncoveredCount: 1,
      missingDocCount: 0,
    });

    expect(graph.edges).toEqual([]);
  });

  it("marca como sem documentação quem não tem vínculo existente", () => {
    const graph = build(
      mapa([
        {
          id: "a",
          title: "A",
          items: [
            { id: "com", title: "Com doc", docs: ["backup"] },
            { id: "sem", title: "Sem doc" },
            { id: "quebrado", title: "Quebrado", docs: ["sumiu"] },
          ],
        },
      ]),
      [{ slug: "backup", title: "Rotina de backup" }],
    );

    const [com, sem, quebrado] = graph.nodes;

    expect(com).toMatchObject({ uncovered: false, documentCount: 1, documentSlug: "backup" });
    expect(sem).toMatchObject({ uncovered: true, documentCount: 0, documentSlug: null });
    expect(quebrado).toMatchObject({
      uncovered: true,
      missingDocCount: 1,
      documentSlug: null,
    });
  });

  it("a altura do grafo cobre o bloco mais baixo de qualquer coluna", () => {
    const graph = build(
      mapa([
        { id: "a", title: "A", items: [{ id: "a1", title: "A1" }] },
        {
          id: "b",
          title: "B",
          items: [
            { id: "b1", title: "B1" },
            { id: "b2", title: "B2" },
            { id: "b3", title: "B3" },
          ],
        },
      ]),
    );

    const maisBaixo = Math.max(...graph.nodes.map((n) => n.y + n.height));
    expect(graph.height).toBe(maisBaixo);
  });
});

describe("neighboursOf", () => {
  it("inclui o próprio bloco e os vizinhos nos dois sentidos", () => {
    const graph = build(
      mapa([
        { id: "a", title: "A", items: [{ id: "a1", title: "A1", deliversTo: ["b1"] }] },
        { id: "b", title: "B", items: [{ id: "b1", title: "B1", deliversTo: ["c1"] }] },
        { id: "c", title: "C", items: [{ id: "c1", title: "C1" }] },
      ]),
    );

    // b1 recebe de a1 e entrega para c1: o realce mostra os dois lados.
    expect([...neighboursOf(graph.edges, "b1")].sort()).toEqual(["a1", "b1", "c1"]);
    expect([...neighboursOf(graph.edges, "a1")].sort()).toEqual(["a1", "b1"]);
  });

  it("um bloco sem ligação destaca só a si mesmo", () => {
    const graph = build(
      mapa([{ id: "a", title: "A", items: [{ id: "a1", title: "A1" }] }]),
    );

    expect([...neighboursOf(graph.edges, "a1")]).toEqual(["a1"]);
  });
});
