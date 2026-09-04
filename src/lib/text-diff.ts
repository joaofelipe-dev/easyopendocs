/**
 * Diff entre duas versões de um documento, para a tela de histórico.
 *
 * Implementado aqui em vez de trazer uma biblioteca: o projeto não tem
 * nenhuma dependência de diff, e o que a tela precisa é o caso mais simples
 * possível — duas strings, sem heurística de palavra nem de detecção de bloco
 * movido.
 *
 * **Compara BLOCOS, não linhas.** O editor do portal grava o corpo inteiro
 * numa linha só, enquanto um arquivo escrito à mão vem indentado em dezenas
 * de linhas. Um diff por linha diria "tudo removido, tudo adicionado" em toda
 * edição feita pela tela — que é justamente o caso mais comum. Quebrar nas
 * bordas das tags de bloco antes de comparar faz os dois formatos caírem na
 * mesma granularidade: o parágrafo que mudou.
 *
 * Sem `server-only` e sem import de nada: é função pura, e é o que permite
 * testá-la sem banco e usá-la de qualquer lado.
 */

export type DiffBlock =
  | { type: "equal" | "add" | "remove"; text: string }
  | {
      /** Sequência de blocos iguais omitida por estar longe de uma mudança. */
      type: "gap";
      count: number;
    };

export type TextDiff = {
  blocks: DiffBlock[];
  added: number;
  removed: number;
  /**
   * Os documentos eram grandes demais para comparar e o diff saiu como "tudo
   * removido, tudo adicionado". A tela avisa em vez de mentir.
   */
  truncated: boolean;
};

/**
 * Teto do LCS. A tabela de programação dinâmica é O(n×m), então sem limite um
 * par de documentos grandes trava o servidor — e documentação com mais de
 * ~4000 blocos é rara o bastante para avisar em vez de otimizar.
 */
const MAX_BLOCKS = 4000;

/** Blocos iguais mantidos em volta de cada mudança. */
const DEFAULT_CONTEXT = 3;

/** Tags que delimitam um bloco de conteúdo — as mesmas do sanitizador. */
const BLOCK_TAGS =
  "article|section|div|p|h[1-6]|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col|blockquote|pre|figure|figcaption|details|summary|hr|video|source";

/** Abre um bloco: a fronteira vem ANTES, para a tag ficar junto do seu texto. */
const OPENING_TAG = new RegExp(`(<(?:${BLOCK_TAGS})\\b[^>]*>)`, "gi");
/** Fecha um bloco: a fronteira vem DEPOIS, pelo mesmo motivo. */
const CLOSING_TAG = new RegExp(`(</(?:${BLOCK_TAGS})\\s*>)`, "gi");

// Caractere que não aparece em HTML de documentação: marca as fronteiras que
// ESTE código inseriu, para distingui-las das quebras de linha que já estavam
// no arquivo (que são formatação, não estrutura).
const BOUNDARY = "\u0000";

/**
 * Quebra o arquivo em blocos comparáveis: um por elemento de bloco.
 *
 * As quebras de linha originais são tratadas como espaço em branco dentro do
 * bloco, não como separador. É isso que faz um `<p>` quebrado em quatro linhas
 * à mão casar com o mesmo `<p>` que o editor gravou numa linha só.
 *
 * Consequência assumida: uma mudança que existe SÓ na indentação de dentro de
 * um `<pre>` não aparece no diff. É o preço de o diff funcionar para toda
 * edição feita pela tela — e restaurar continua sendo byte a byte de qualquer
 * jeito.
 */
function splitBlocks(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    // Cada comentário é um bloco: é assim que o front-matter do arquivo
    // (`<!-- title: ... -->`) aparece linha a linha em vez de num bloco só.
    .replace(/(<!--[\s\S]*?-->)/g, `${BOUNDARY}$1${BOUNDARY}`)
    .replace(OPENING_TAG, `${BOUNDARY}$1`)
    .replace(CLOSING_TAG, `$1${BOUNDARY}`)
    .split(BOUNDARY)
    .map((block) =>
      block
        .replace(/\s+/g, " ")
        .trim()
        // Espaço logo depois da tag de abertura e logo antes da de fechamento
        // é indentação, não conteúdo: `<p>\n  texto\n</p>` tem que casar com
        // `<p>texto</p>`. Só nas bordas do bloco — o espaço ENTRE elementos
        // inline no meio do texto é significativo e fica.
        .replace(/^(<[^>]+>)\s+/, "$1")
        .replace(/\s+(<\/[^>]+>)$/, "$1"),
    )
    .filter((block) => block.length > 0);
}

export function diffDocuments(
  before: string,
  after: string,
  options: { context?: number } = {},
): TextDiff {
  const context = options.context ?? DEFAULT_CONTEXT;
  const beforeBlocks = splitBlocks(before);
  const afterBlocks = splitBlocks(after);

  if (beforeBlocks.length > MAX_BLOCKS || afterBlocks.length > MAX_BLOCKS) {
    return {
      blocks: [],
      added: afterBlocks.length,
      removed: beforeBlocks.length,
      truncated: true,
    };
  }

  const raw = buildDiff(beforeBlocks, afterBlocks);

  return {
    blocks: collapseEqualRuns(raw, context),
    added: raw.filter((block) => block.type === "add").length,
    removed: raw.filter((block) => block.type === "remove").length,
    truncated: false,
  };
}

type ChangedBlock = Extract<DiffBlock, { type: "equal" | "add" | "remove" }>;

function buildDiff(before: string[], after: string[]): ChangedBlock[] {
  // Prefixo e sufixo idênticos saem do LCS: numa edição típica de documento,
  // isso reduz a tabela a algumas dezenas de blocos em vez de milhares.
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1;
  }

  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore -= 1;
    endAfter -= 1;
  }

  return [
    ...before.slice(0, start).map(equal),
    ...lcsDiff(before.slice(start, endBefore), after.slice(start, endAfter)),
    ...before.slice(endBefore).map(equal),
  ];
}

function equal(text: string): ChangedBlock {
  return { type: "equal", text };
}

/** LCS clássico, com a tabela numa Int32Array para não alocar milhares de arrays. */
function lcsDiff(before: string[], after: string[]): ChangedBlock[] {
  const n = before.length;
  const m = after.length;

  const table = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[at(i, j)] =
        before[i] === after[j]
          ? table[at(i + 1, j + 1)] + 1
          : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }

  const blocks: ChangedBlock[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (before[i] === after[j]) {
      blocks.push({ type: "equal", text: before[i] });
      i += 1;
      j += 1;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
      // Remoção antes de adição quando empata: mantém o par "bloco velho
      // seguido do novo" junto na tela, que é como se lê um diff.
      blocks.push({ type: "remove", text: before[i] });
      i += 1;
    } else {
      blocks.push({ type: "add", text: after[j] });
      j += 1;
    }
  }

  while (i < n) blocks.push({ type: "remove", text: before[i++] });
  while (j < m) blocks.push({ type: "add", text: after[j++] });

  return blocks;
}

/**
 * Troca sequências longas de blocos iguais por um marcador. Sem isso, uma
 * correção de uma palavra num documento longo vira uma tela de rolagem
 * infinita onde nada mudou.
 */
function collapseEqualRuns(blocks: ChangedBlock[], context: number): DiffBlock[] {
  const keep = new Array<boolean>(blocks.length).fill(false);

  blocks.forEach((block, index) => {
    if (block.type === "equal") return;
    for (
      let i = Math.max(0, index - context);
      i <= Math.min(blocks.length - 1, index + context);
      i += 1
    ) {
      keep[i] = true;
    }
  });

  // Sem mudança nenhuma não há o que contextualizar: devolve tudo, que é o
  // que a tela de "versões idênticas" precisa exibir.
  if (!keep.some(Boolean)) return [...blocks];

  const output: DiffBlock[] = [];
  let skipped = 0;

  for (const [index, block] of blocks.entries()) {
    if (keep[index]) {
      if (skipped > 0) {
        output.push({ type: "gap", count: skipped });
        skipped = 0;
      }
      output.push(block);
    } else {
      skipped += 1;
    }
  }

  if (skipped > 0) output.push({ type: "gap", count: skipped });

  return output;
}
