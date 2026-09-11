# Research — Redesign Neumórfico do chrome

**Date**: 2026-09-11
**Feature**: [spec.md](spec.md)

## Contexto

A spec pede neumorfismo profissional em todo o chrome do portal, intensidade
"suave a moderado" (clarificação 2026-09-11), mantendo dark mode, paleta neutra
e conteúdo flat. Pesquisa de 2026 sobre soft-UI: a técnica é de nicho — o
mercado (video de referência: análises 2026 da WCAG 2.2 SC 1.4.11) é claro que
o neumorfismo puro falha contraste e que produtos corporativos maduros o usam
como reforço, nunca como único canal de estado. As decisões abaixo dobram a
técnica para manter a acessibilidade e a sobriedade corporativa (o que o usuário
chamou de "como grandes empresas"), sem abandonar a estética pedida.

## Decisões

### D1 — Superfície única e recoloração do fundo
**Decision**: O fundo do app deixa de ser branco puro e passa a um neutro de
tom médio; `--card`, `--popover`, `--secondary`, `--accent` e `--sidebar`
colam na mesma superfície (`--background`). `--muted` fica um tom abaixo para
preservar a definição de `code`/`pre`/hover do conteúdo flat.
**Rationale**: A receita neumórfica exige que a superfície do elemento seja
igual à do fundo — com uma sombra clara possível. Branco puro não tem "mais
claro" para o highlight; o gray no exemplo canônico (#e0e5ec) existe por isso.
Com superfície única, raised/inset funcionam com pares luz+sombra. `--muted`
não pode colar: blocos flat de código perderiam a fronteira.
**Alternatives considered**: (a) manter branco puro e usar só sombra escura —
não é neumorfismo, perde a luz; (b) manter o `bg-muted/30` atual — superfícies
diferentes do fundo quebram a ilusão.

### D2 — Tokens de sombra (intensidade B: suave a moderado)
**Decision**: Dupla sombra por estado, em tokens `@theme`:
- raised: `offset 4px 4px` (escuras) + `-4px -4px` (claras), `blur 8px` (≈2x o
  offset, receita canônica), raio mantido em `--radius`;
- inset/pressed: mesmos offset reduzidos para `3px`, `blur 6px`;
- valores por tema: **claro** — luz `oklch(1 0 0)`, sombra `~oklch(0.85 0 0)`;
  **escuro** — luz `oklch(0.27 0 0)` (cinza claro, nunca branco), sombra
  `oklch(0.16 0 0)` (cinza escuro, nunca preto).
**Rationale**: Intervalo ≈4–8px escolhido pelo usuário (opção B); blur 2x o
offset é o padrão que mantém o "molde macio"; no escuro, highlight branco puro
vira artefato — a literatura recomenda retunar (nunca inverter) os dois tons.
**Alternatives considered**: offsets 9–18px (intensidade C — descartada na
clarificação); 2–4px (intensidade A — sombreamento quase imperceptível).

### D3 — Borda "forensic" 1px + anel de foco real (não-negociável)
**Decision**: Todo controle/superfície neumórfica ganha uma **borda sutil**
(1px, tom intermediário; mais perceptível no escuro); foco por teclado mantém o
anel forte atual (`focus-visible:ring-3 ring-ring/50` — já presente nos
primitivos shadcn), nunca só a sombra.
**Rationale**: WCAG 2.2 SC 1.4.11 (3:1) — a borda de sombra neumórfica fica em
~1.2–1.8:1. A borda + anel de foco são o que torna o componente reconhecível;
texto permanece ≥4.5:1 (as cores atuais já garantem). A spec (FR-003, FR-009)
tornou isso requisito.
**Alternatives considered**: outline accent colorido (a paleta decidida é
neutra, sem cor de marca nova — mantém-se o anel atual neutro cheio); só sombra
no foco (rejeitado: falha SC 2.4.7).

### D4 — Dark mode: retune, nunca "inverter"
**Decision**: Conjunto próprio de tokens no `.dark` (D2); sombra clara é cinza
claro e sombra escura é cinza escuro, ajustadas ao fundo escuro.
**Rationale**: A inversão ingênua apaga a sombra escura no fundo escuro. A
literatura mostra o retune funcionando até melhor que no claro.
**Alternatives considered**: zebrar sombras em modo escuro ou remover dark mode
(rejeitado: spec/travamento do usuário mantém os dois temas).

### D5 — CTAs primários seguem preenchidos de alto contraste
**Decision**: Botão `primary` mantém o preenchimento escuro/flat atual (texto
claro) com sombra neumórfica leve; `secondary`/`outline`/`ghost` adotam o relevo
elevado/inset da superfície.
**Rationale**: Neumorfismo integral faz botão e card ficarem idênticos — o erro
número 1 da técnica. Padrão profissional 2026: CTA de alto contraste + sombras
de reforço. Honors the aesthetic while keeping "Encontrar o botão" óbvio.
**Alternatives considered**: botão primário neumórfico puro (rejeitado: FR-001
pede profundidade percebida, não invisibilidade; pesquisa de CTAs é explícita).

### D6 — Performance: sombra em superfícies, não em linhas
**Decision**: Aplicar box-shadow em containers/cards/controles; listagens
(tabelas do admin, listas de documentos, versões) permanecem flat com a borda
de separação por cores atuais.
**Rationale**: "Limit neumorphic elements per viewport" (perf scroll em telas
fracas); tabelas densas são citadas como caso para NÃO usar neumorfismo.
**Alternatives considered**: sombrear cada linha (rejeitado: perf e leitura).

### D7 — Impressão e movimento
**Decision**: `@media print` já zera `box-shadow` — manter; marcar também a
novo foco/estados. Transições atuais (`transition-all`, rápidas) preservadas.
**Rationale**: Spec FR-007/US4; animações atuais são sutis (100-200ms), sem
introduzir regra extra de `prefers-reduced-motion` além do que já existe.
**Alternatives considered**: adicionar heurística custom de reduced-motion
(rejeitado: YAGNI — transições atuais são discretas e não contínuas).

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Contraste de componente (SC 1.4.11) | Borda 1px + anel de foco real (D3); D5 mantém CTA distinguível |
| Leitura com sombra em tabela/grid | D6 — listagens flat |
| Dark mode parecer sujo | D4 — retune dos dois tons, never pure white/black |
| Ilusão quebrada por superfície diferente | D1 — superfície única |
| Print com sombra no papel | D7 + regra já existente em `globals.css` |
| Perf scroll | D6 + box-shadow sem animação contínua |

## Pontos simulados para o usuário (não perguntados)

- Transferir `--bg-muted/30` do `body` para a superfície única é uma mudança de
  cor de fundo global — esperada de um redesign e reversível por token.
- Badge de revisão (FR-008): mantém cores; adquire relevo leve como superfície
  distinta (não sombra como único sinal).