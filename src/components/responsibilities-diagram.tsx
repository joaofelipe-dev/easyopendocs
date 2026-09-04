"use client";

import { useState } from "react";
import Link from "next/link";

import {
  neighboursOf,
  type ResponsibilitiesGraph,
} from "@/lib/responsibilities-graph";

/**
 * Desenha o diagrama a partir do layout já calculado em
 * responsibilities-graph.ts. SVG à mão, sem dependência: nada aqui além do
 * realce precisa de JavaScript, então sem interação a tela continua correta —
 * e é assim que ela sai na impressão.
 */

const PADDING = 24;

export function ResponsibilitiesDiagram({
  graph,
  departmentSlug,
}: {
  graph: ResponsibilitiesGraph;
  departmentSlug: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const highlighted = hovered ? neighboursOf(graph.edges, hovered) : null;

  const viewWidth = graph.width + PADDING * 2;
  const viewHeight = graph.height + PADDING * 2;

  return (
    // Diagrama largo é a regra; a rolagem horizontal fica presa aqui em vez de
    // vazar para a página. Na impressão o SVG encolhe para caber.
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        width={viewWidth}
        height={viewHeight}
        role="img"
        aria-label="Diagrama das responsabilidades do departamento e de quem entrega para quem"
        className="h-auto max-w-none print:max-w-full"
        style={{ minWidth: viewWidth }}
      >
        <defs>
          <marker
            id="seta"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
          </marker>
        </defs>

        <g transform={`translate(${PADDING} ${PADDING})`}>
          {graph.columns.map((column) => (
            <text
              key={column.areaId}
              x={column.x}
              y={14}
              className="fill-muted-foreground text-[11px] font-semibold tracking-widest uppercase"
            >
              {column.title}
            </text>
          ))}

          {/* Setas primeiro, para passarem por baixo dos blocos. */}
          {graph.edges.map((edge) => {
            const dimmed =
              highlighted !== null &&
              !(highlighted.has(edge.from) && highlighted.has(edge.to));

            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                markerEnd="url(#seta)"
                className={
                  dimmed
                    ? "stroke-muted-foreground/20 transition-opacity"
                    : "stroke-muted-foreground/70 transition-opacity"
                }
                strokeWidth={1.5}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const dimmed = highlighted !== null && !highlighted.has(node.id);

            return (
              <DiagramNode
                key={node.id}
                node={node}
                dimmed={dimmed}
                departmentSlug={departmentSlug}
                onHover={setHovered}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function DiagramNode({
  node,
  dimmed,
  departmentSlug,
  onHover,
}: {
  node: ResponsibilitiesGraph["nodes"][number];
  dimmed: boolean;
  departmentSlug: string;
  onHover: (id: string | null) => void;
}) {
  const { text } = node;

  const body = (
    <g
      className={dimmed ? "opacity-25 transition-opacity" : "transition-opacity"}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={10}
        strokeWidth={1}
        className={
          node.uncovered
            ? "fill-card stroke-muted-foreground/50 [stroke-dasharray:4_3]"
            : "fill-card stroke-border"
        }
      />

      {node.titleLines.map((line, index) => (
        <text
          key={index}
          x={node.x + text.x}
          y={node.y + text.titleY + index * text.lineHeight}
          className="fill-foreground text-[13px] font-medium"
        >
          {line}
        </text>
      ))}

      {node.owner && text.ownerY !== null ? (
        <text
          x={node.x + text.x}
          y={node.y + text.ownerY}
          className="fill-muted-foreground text-[11px]"
        >
          {node.owner}
        </text>
      ) : null}

      <text
        x={node.x + text.x}
        y={node.y + text.footerY}
        className={
          node.uncovered || node.missingDocCount > 0
            ? "fill-destructive text-[11px]"
            : "fill-muted-foreground text-[11px]"
        }
      >
        {footerLabel(node)}
      </text>
    </g>
  );

  // Bloco com documentação vira link; sem documentação não há para onde ir.
  if (!node.documentSlug) return body;

  return (
    <Link
      href={`/departamentos/${departmentSlug}/${node.documentSlug}`}
      className="focus-visible:outline-ring focus-visible:outline-2"
    >
      {body}
    </Link>
  );
}

function footerLabel(node: ResponsibilitiesGraph["nodes"][number]): string {
  if (node.missingDocCount > 0) {
    const quebrados =
      node.missingDocCount === 1
        ? "1 vínculo quebrado"
        : `${node.missingDocCount} vínculos quebrados`;
    return node.documentCount > 0
      ? `${node.documentCount} doc · ${quebrados}`
      : quebrados;
  }
  if (node.uncovered) return "Sem documentação";
  return node.documentCount === 1 ? "1 documentação" : `${node.documentCount} documentações`;
}
