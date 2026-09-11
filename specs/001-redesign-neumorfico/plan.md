# Implementation Plan: Redesign neumórfico do portal

**Branch**: `feat/001-redesign-neumorfico` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-redesign-neumorfico/spec.md`

## Summary

Revestir o chrome do portal (navegação, superfícies, controles, admin) de
neumorfismo "suave a moderado": superfície única, dupla sombra (clara/sombra),
estado pressed=inset, conteúdo e tabelas flat, dark mode retunado e anel de
foco + borda 1px preservados para acessibilidade. Nenhuma dependência, nenhuma
mudança de rota/permissão/dado; só CSS (tokens) + classes de componentes.

## Technical Context

**Language/Version**: TypeScript estrito; TailwindCSS v4 (tokens em `@theme` no `globals.css`); React 19 / Next.js 16 App Router (sem mudança de componente de lógica)

**Primary Dependencies**: Nenhuma nova. shadcn/ui (primitivos existentes em `src/components/ui/`), `cn()` de `@/lib/utils`. Emprego apenas de CSS nativo (`box-shadow`, `border-radius`, `outline`)

**Storage**: N/A (feature de apresentação; nenhum schema, arquivo de conteúdo ou permissão muda)

**Testing**: `npm test` (Vitest, suíte funcional existente) como seleção de regressão — não há lógica nova; gates de constituição (build → typecheck → lint → test)

**Target Platform**: Navegador web (qualquer navegador moderno com `box-shadow` de múltiplos valores + `inset` — suporte universal há uma década)

**Project Type**: Web app (Next.js) — mudança de design system, 0 novas rotas

**Performance Goals**: Scroll de listagens sem sobrecarga de pintura: poucos `box-shadow` grandes por viewport (sombra em containers/cards, não em linhas)

**Constraints**: WCAG — texto ≥4.5:1 (cores atuais intocadas); foco `:focus-visible` sempre visível; estado nunca comunicado só por sombra; impressão sem sombra; dark mode mantido

**Scale/Scope**: ~24 primitivos em `src/components/ui/`, ~18 componentes de chrome, 1 CSS global (tokens), 2 temas

## Constitution Check

*GATE: Deve passar antes da Phase 0. Re-check após o design.*

- **I. Filesystem fonte da verdade**: nenhum arquivo de conteúdo, dado ou sync é tocado. ✅
- **II. Testes funcionais reais**: sem lógica nova; a suíte existente deve seguir verde e é gate obrigatório. ✅
- **III. Segurança do conteúdo**: DOMPurify/sanitização, RBAC server-side e slugs intocados — mudança exclusivamente de apresentação. ✅
- **IV. Escopo real, YAGNI**: zero dependência nova, zero abstração — tokens CSS + variantes shadcn. ✅
- **V. Autohospedado**: CSS local, sem serviço externo. ✅

Sem violações → `Complexity Tracking` não preenchido.

## Design

### Camada de tokens (`src/app/globals.css`)

1. **Superfície única** (`:root`): `--background` deixa de ser branco puro →
   `oklch(0.965 0 0)` (tom médio suave; permite o highlight claro). `--card`,
   `--popover`, `--secondary`, `--accent`, `--sidebar` = `--background`.
   `--foreground` e demais cores de texto **intocadas** (mantêm ≥4.5:1).
   `--muted` fica um tom abaixo (`oklch(0.945 0 0)`) para preservar a definição
   de `code`/`pre`/hover do `.doc-content` (flat).
   `.dark`: `--background` → `oklch(0.21 0 0)`; `--card`/`--popover`/
   `--secondary`/`--accent`/`--sidebar` = mesmo; `--muted` → `oklch(0.26 0 0)`.
   `body` em `layout.xml`/base: `bg-background` (substitui `bg-muted/30`).

2. **Tokens de sombra** (`@theme inline` + vars em `:root`/`.dark`), expostos
   como utilitários `shadow-neu-*` do Tailwind v4:

   | Tokens | Claro | Escuro |
   |--------|-------|--------|
   | `shadow-neu-raised` | `4px 4px 8px` escuro + `-4px -4px 8px` claro | luz `oklch(0.27 0 0)`, sombra `oklch(0.16 0 0)` |
   | `shadow-neu-inset` | `inset 3px 3px 6px` escuro + `inset -3px -3px 6px` claro | mesmos dois tons, inset |
   | `shadow-neu-pop` | `5px 5px 10px` + `-5px -5px 10px` (camadas flutuantes) | retune escuro |

   Claro: luz `oklch(1 0 0)`, escura `oklch(0.85 0 0)`. Escuro: luz
   `oklch(0.27 0 0)` (cinza, nunca branco), escura `oklch(0.16 0 0)` (cinza,
   nunca preto). Blur ≈ 2x offset (receita canônica).

3. **Borda de borda "forensic"**: `--neu-edge` — 1px sutil que torna o
   componente reconhecível sem borda dura: claro `oklch(0.9 0 0)`, escuro
   `oklch(1 0 0 / 14%)`.

### Contrato de componentes

| Área | Comportamento |
|------|---------------|
| `button` default/primary | Mantém preenchimento escuro claro (D5) + `shadow-neu-raised` em repouso → `active:shadow-neu-inset` |
| `button` secondary/outline/ghost | Superfície do fundo em repouso + `shadow-neu-raised` → `active:shadow-neu-inset`; outline mantém `border-neu-edge` |
| `card` | `shadow-neu-raised` + `border-neu-edge` substituem `ring-1 ring-foreground/10`; `bg-card` (= fundo) |
| `input`/`textarea`/`select` | `shadow-neu-inset` sempre + `border-neu-edge`; foco mantém anel atual |
| `search-box` | Campo inset (igual input); container raised |
| `switch`/`checkbox`/`tabs` | Repouso raised → checado/ativo inset; cor de estado preservada |
| `sidebar`/nav + item ativo | Painel raised; item ativo inset (`aria-current`/ativo) + cor preservada |
| `dialog`/`sheet`/`dropdown`/`popover` | `shadow-neu-pop` (elevação de camada), fundo = surface |
| `table`/listas/versões/diff | **Flat** — separação por `--border` e cores atuais (D6) |
| `review-badge` | Relevo leve raised, cores do selo preservadas (FR-008) |
| `responsibilities-diagram` | Blocos raised (sombra token), tracejado de "sem documentação" preservado, vizinhos no hover preservado |
| `.doc-content` | **Flat** — sem mudança de tipografia/contraste (FR-005); `code`/`pre` mantêm `bg-muted` |
| impressão | `box-shadow: none` (regra já presente em `globals.css` estendida para cobrir os novos estados) |

## Project Structure

### Documentation (this feature)

```text
specs/001-redesign-neumorfico/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisões D1..D7 e riscos
├── quickstart.md        # Phase 1 output — roteiro de verificação manual
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

> `data-model.md` e `contracts/` **não** são criados: não há dados novos e o
> contrato de superfície (tokens) está documentado na seção **Design** deste
> plano — feature puramente interna, fora do escopo de `contracts/` do template.

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css              # tokens: superfície, shadow-neu-*, --neu-edge
│   └── layout.tsx               # body passa a bg-background (remove bg-muted/30)
├── components/
│   ├── ui/                      # 24 primitivos shadcn — novas classes shadow-neu-*
│   ├── app-header.tsx           # raised + search-box inset
│   ├── department-sidebar.tsx   # painel raised, item ativo inset
│   ├── search-box.tsx           # campo inset
│   ├── review-badge.tsx         # relevo leve
│   ├── diff-view.tsx            # flat (adicões/remoções inalteradas)
│   ├── responsibilities-diagram.tsx / department-responsibilities-view.tsx
│   ├── admin/*.tsx              # tabelas flat, formulários inset, painéis raised
│   └── ub/ui justas             # dialog/sheet/dropdown/popover -> shadow-neu-pop
```

**Structure Decision**: Redeploy completo do design nas camadas existentes —
tokens em `globals.css`, primitivos em `components/ui/`, chrome nos componentes
de layout. Nenhum arquivo novo de lógica; zero novas pastas.

## Fases de execução (referência para `/speckit.tasks`)

1. **Consolidação (blocking)** — `globals.css`: superfície única, tokens
   `shadow-neu-*`, `--neu-edge`, atualização de print/`.dark`; `layout.tsx`
   body bg. Sem isso nada fecha.
2. **US1 — Superfície e controles** — primitivos base: button, card, input,
   textarea, select, checkbox, switch, tabs, badge, separator, avatar.
3. **US2 — Navegação e contexto** — app-header, search-box, department-sidebar,
   listagens, review-badge, breadcrumb/voltar, footer.
4. **US3 — Áreas de trabalho** — admin (formulários inset, tabelas flat),
   document-editor (toolbar e campos), historico/diff (flat), diagrama de
   responsabilidades (blocos raised).
5. **US4 — Confiança** — dialog/sheet/menu/popover (elevação de camada),
   impressão, estados (erro/vazio/disabled), ajustes de foco, revisão visual
   dos dois temas.

## Doors to Done (DoD)

- Gate de constituição: `npm run build` → `npx tsc --noEmit` → `npm run lint` → `npm test` verdes.
- Sem mudança em `src/actions/`, `src/lib/` (fora css), rotas ou prisma — diff vazio nessas áreas.
- Roteiro de `quickstart.md` aprovado manualmente nos dois temas (status `[X]`).