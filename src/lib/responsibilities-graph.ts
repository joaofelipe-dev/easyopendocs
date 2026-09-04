import type { ResolvedResponsibilities } from "@/lib/department-responsibilities";

/**
 * Posiciona o mapa de responsabilidades como um diagrama de setas: uma coluna
 * por frente, um bloco por responsabilidade, uma seta por `deliversTo`.
 *
 * Função pura, sem `server-only` e sem import de nada além dos tipos — o
 * layout é a parte que dá para errar em silêncio (blocos sobrepostos, seta
 * apontando para o nada), então precisa ser testável sem banco, sem disco e
 * sem navegador. Quem desenha é `components/responsibilities-diagram.tsx`.
 *
 * O SVG é montado à mão de propósito: uma biblioteca de layout de grafo
 * resolveria um problema que este mapa não tem (grafos grandes e arbitrários)
 * e traria uma dependência de cliente para uma tela que também precisa
 * imprimir.
 */

export const NODE_WIDTH = 220;
/** Espaço entre colunas — é por onde as setas passam. */
export const COLUMN_GAP = 96;
const ROW_GAP = 20;
/** Distância do primeiro corredor de setas longas até o bloco mais baixo. */
const LANE_GAP = 28;
/** Distância entre corredores, para duas setas longas não se sobreporem. */
const LANE_SPACING = 16;
const AREA_HEADER_HEIGHT = 34;
const PADDING = 16;

const LINE_HEIGHT = 17;
/** Recuo do texto em relação à borda esquerda do bloco. */
const TEXT_INSET = 14;
const TITLE_MAX_LINES = 3;
/** Largura de quebra do título, em caracteres. Estimativa: não dá para medir
 *  texto no servidor, e errar para menos só deixa o bloco um pouco mais alto. */
const TITLE_WRAP = 26;

export type GraphNode = {
  id: string;
  areaId: string;
  /** Posição da frente na horizontal — decide como a seta é roteada. */
  columnIndex: number;
  titleLines: string[];
  owner: string | null;
  /** Documentações existentes ligadas a esta responsabilidade. */
  documentCount: number;
  /** Vínculos que apontam para documentação que sumiu do departamento. */
  missingDocCount: number;
  /** Nenhuma documentação existente aponta para cá. */
  uncovered: boolean;
  /** Primeiro documento existente, para o bloco virar link. */
  documentSlug: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Posições do texto dentro do bloco, relativas ao topo dele. Saem daqui, e
   * não do componente, porque são as mesmas contas que definem `height`: se
   * divergissem, o texto sairia para fora da caixa sem nada acusar.
   */
  text: {
    x: number;
    /** Linha de base do primeiro trecho do título. */
    titleY: number;
    lineHeight: number;
    ownerY: number | null;
    footerY: number;
  };
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  /** Atributo `d` de um <path> SVG. */
  path: string;
};

export type GraphColumn = {
  areaId: string;
  title: string;
  x: number;
  width: number;
};

export type ResponsibilitiesGraph = {
  columns: GraphColumn[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

/** Quebra o título em linhas curtas, sem cortar palavra no meio. */
function wrapTitle(title: string): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= TITLE_WRAP || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= TITLE_MAX_LINES) return lines.length > 0 ? lines : [""];

  // Estourou: junta o resto na última linha visível e corta com reticências.
  const visible = lines.slice(0, TITLE_MAX_LINES);
  visible[TITLE_MAX_LINES - 1] = `${visible[TITLE_MAX_LINES - 1].slice(0, TITLE_WRAP - 1)}…`;
  return visible;
}

/** O rodapé ("2 documentações", "Sem documentação") existe sempre. */
function nodeHeight(titleLines: number, hasOwner: boolean): number {
  return (
    PADDING * 2 + (titleLines + 1 + (hasOwner ? 1 : 0)) * LINE_HEIGHT
  );
}

export function buildResponsibilitiesGraph(
  resolved: ResolvedResponsibilities,
): ResponsibilitiesGraph {
  const columns: GraphColumn[] = [];
  const nodes: GraphNode[] = [];

  // Uma coluna por frente, na ORDEM DO ARQUIVO. Reordenar por número de
  // conexões encurtaria as setas, mas quebraria a leitura cruzada com a tela
  // de lista, que é a mesma ordem — e conferir uma contra a outra é o uso
  // mais provável do diagrama.
  resolved.areas.forEach((area, columnIndex) => {
    const x = columnIndex * (NODE_WIDTH + COLUMN_GAP);
    columns.push({ areaId: area.id, title: area.title, x, width: NODE_WIDTH });

    let y = AREA_HEADER_HEIGHT;

    for (const item of area.items) {
      const titleLines = wrapTitle(item.title);
      const existing = item.documents.filter((document) => !document.missing);
      const missingDocCount = item.documents.length - existing.length;
      const uncovered = existing.length === 0;

      const height = nodeHeight(titleLines.length, Boolean(item.owner));

      // A primeira linha de base fica um pouco abaixo do topo do texto: em
      // SVG, `y` de um <text> é a linha de base, não o topo da letra.
      const titleY = PADDING + LINE_HEIGHT - 4;
      const afterTitle = titleY + titleLines.length * LINE_HEIGHT;

      nodes.push({
        id: item.id,
        areaId: area.id,
        columnIndex,
        titleLines,
        owner: item.owner,
        documentCount: existing.length,
        missingDocCount,
        uncovered,
        documentSlug: existing[0]?.slug ?? null,
        x,
        y,
        width: NODE_WIDTH,
        height,
        text: {
          x: TEXT_INSET,
          titleY,
          lineHeight: LINE_HEIGHT,
          ownerY: item.owner ? afterTitle : null,
          footerY: item.owner ? afterTitle + LINE_HEIGHT : afterTitle,
        },
      });

      y += height + ROW_GAP;
    }
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const pairs: Array<{ from: GraphNode; to: GraphNode }> = [];
  for (const area of resolved.areas) {
    for (const item of area.items) {
      const from = nodeById.get(item.id);
      if (!from) continue;

      for (const targetId of item.deliversTo) {
        const to = nodeById.get(targetId);
        // A normalização já poda referência órfã, mas o layout não pode
        // depender disso: um `_responsabilidades.json` escrito à mão chega
        // aqui pelo mesmo caminho, e uma seta para o nada quebraria o SVG.
        if (!to || to.id === from.id) continue;
        pairs.push({ from, to });
      }
    }
  }

  const nodesBottom = nodes.reduce(
    (max, node) => Math.max(max, node.y + node.height),
    AREA_HEADER_HEIGHT,
  );

  // Setas que pulam mais de uma coluna passariam POR TRÁS dos blocos do meio
  // (os retângulos são opacos e desenhados por cima), e aí não dá para saber
  // onde elas terminam. Cada uma ganha uma faixa própria abaixo do diagrama.
  const longPairs = pairs.filter(
    ({ from, to }) => Math.abs(to.columnIndex - from.columnIndex) > 1,
  );
  const laneOf = new Map(
    longPairs.map(({ from, to }, index) => [
      `${from.id}->${to.id}`,
      nodesBottom + LANE_GAP + index * LANE_SPACING,
    ]),
  );

  const edges: GraphEdge[] = pairs.map(({ from, to }) => {
    const id = `${from.id}->${to.id}`;
    const lane = laneOf.get(id);

    return {
      id,
      from: from.id,
      to: to.id,
      path: lane === undefined ? edgePath(from, to) : lanePath(from, to, lane),
    };
  });

  const width =
    columns.length === 0
      ? 0
      : columns[columns.length - 1].x + NODE_WIDTH;
  const height = [...laneOf.values()].reduce(
    (max, lane) => Math.max(max, lane + LANE_GAP),
    nodesBottom,
  );

  return { columns, nodes, edges, width, height };
}

/** Curva de Bézier entre dois blocos, com a saída dependendo da direção. */
function edgePath(from: GraphNode, to: GraphNode): string {
  const fromY = from.y + from.height / 2;
  const toY = to.y + to.height / 2;

  // Frente diferente e à direita: sai pela direita, entra pela esquerda.
  if (to.x > from.x) {
    const fromX = from.x + from.width;
    const bend = Math.max((to.x - fromX) / 2, 32);
    return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${to.x - bend} ${toY}, ${to.x} ${toY}`;
  }

  // Mesma frente ou frente à esquerda: contorna pela direita das duas, senão
  // a seta atravessaria os blocos que estão no caminho.
  const fromX = from.x + from.width;
  const toX = to.x + to.width;
  const detour = Math.max(fromX, toX) + COLUMN_GAP / 2;

  return `M ${fromX} ${fromY} C ${detour} ${fromY}, ${detour} ${toY}, ${toX} ${toY}`;
}

/**
 * Seta longa: sai pela lateral do bloco, desce pelo VÃO entre colunas até um
 * corredor livre abaixo do diagrama, corre na horizontal e sobe pelo vão ao
 * lado do destino. Nunca cruza uma coluna — descer pelo meio da própria
 * coluna passaria por trás dos blocos de baixo, que é o problema que este
 * roteamento existe para evitar.
 */
function lanePath(from: GraphNode, to: GraphNode, lane: number): string {
  const fromY = from.y + from.height / 2;
  const toY = to.y + to.height / 2;

  const fromEdge = from.x + from.width;
  const exitX = fromEdge + COLUMN_GAP / 2;

  const forward = to.columnIndex > from.columnIndex;
  const entryX = forward
    ? to.x - COLUMN_GAP / 2
    : to.x + to.width + COLUMN_GAP / 2;
  const toEdge = forward ? to.x : to.x + to.width;

  return roundedPolyline([
    [fromEdge, fromY],
    [exitX, fromY],
    [exitX, lane],
    [entryX, lane],
    [entryX, toY],
    [toEdge, toY],
  ]);
}

/** Raio dos cantos de um trajeto ortogonal. */
const CORNER = 10;

/**
 * Transforma uma sequência de pontos num `d` de <path> com cantos
 * arredondados: reta até perto do canto, curva quadrática, reta de novo.
 */
function roundedPolyline(points: Array<[number, number]>): string {
  const commands = [`M ${points[0][0]} ${points[0][1]}`];

  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];

    const inRadius = Math.min(CORNER, distance(px, py, cx, cy) / 2);
    const outRadius = Math.min(CORNER, distance(cx, cy, nx, ny) / 2);

    const [ax, ay] = towards(cx, cy, px, py, inRadius);
    const [bx, by] = towards(cx, cy, nx, ny, outRadius);

    commands.push(`L ${ax} ${ay}`, `Q ${cx} ${cy}, ${bx} ${by}`);
  }

  const [lx, ly] = points[points.length - 1];
  commands.push(`L ${lx} ${ly}`);

  return commands.join(" ");
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Ponto a `length` de (x1,y1) na direção de (x2,y2). */
function towards(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  length: number,
): [number, number] {
  const total = distance(x1, y1, x2, y2);
  if (total === 0) return [x1, y1];

  const ratio = length / total;
  return [x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio];
}

/** Vizinhos de um bloco, nos dois sentidos — o realce da tela usa isto. */
export function neighboursOf(
  edges: ReadonlyArray<GraphEdge>,
  nodeId: string,
): Set<string> {
  const neighbours = new Set<string>([nodeId]);

  for (const edge of edges) {
    if (edge.from === nodeId) neighbours.add(edge.to);
    if (edge.to === nodeId) neighbours.add(edge.from);
  }

  return neighbours;
}
