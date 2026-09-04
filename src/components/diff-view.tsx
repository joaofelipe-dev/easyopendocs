import type { TextDiff } from "@/lib/text-diff";

/**
 * Renderiza a comparação de duas versões. Server component: o diff já vem
 * pronto do `diffDocuments`, não há estado nenhum a manter no cliente.
 *
 * Mostra o HTML como texto, não renderizado: numa comparação, o que importa é
 * o que mudou no fonte — inclusive uma tag trocada, que renderizada pareceria
 * igual.
 */
export function DiffView({ diff }: { diff: TextDiff }) {
  if (diff.truncated) {
    return (
      <Placeholder>
        As duas versões somam blocos demais para comparar aqui. Restaure ou
        baixe o arquivo e compare com o <code>diff</code> do seu sistema.
      </Placeholder>
    );
  }

  if (diff.added === 0 && diff.removed === 0) {
    return <Placeholder>Nenhuma diferença entre as duas versões.</Placeholder>;
  }

  return (
    // O conteúdo é HTML de documentação: bloco longo é a regra, então a
    // rolagem horizontal fica presa aqui em vez de vazar para a página.
    <ul className="divide-y overflow-x-auto rounded-lg border font-mono text-xs">
      {diff.blocks.map((block, index) => {
        if (block.type === "gap") {
          return (
            <li
              key={index}
              className="bg-muted/40 text-muted-foreground px-3 py-1 text-center"
            >
              ⋯ {block.count}{" "}
              {block.count === 1 ? "bloco sem mudança" : "blocos sem mudança"}
            </li>
          );
        }

        return (
          <li
            key={index}
            className={
              block.type === "add"
                ? "bg-emerald-500/10"
                : block.type === "remove"
                  ? "bg-destructive/10"
                  : undefined
            }
          >
            <div className="flex gap-2 px-3 py-1">
              <span
                aria-hidden
                className="text-muted-foreground w-3 shrink-0 select-none"
              >
                {block.type === "add" ? "+" : block.type === "remove" ? "−" : " "}
              </span>
              <span className="sr-only">
                {block.type === "add"
                  ? "Adicionado:"
                  : block.type === "remove"
                    ? "Removido:"
                    : "Sem mudança:"}
              </span>
              <span className="whitespace-pre-wrap">{block.text}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
