---

description: "Task list template for feature implementation"

---

# Tasks: Redesign neumórfico do portal

**Input**: Design documents from `specs/001-redesign-neumorfico/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: Não há tasks de teste automatizado — a spec não solicita (verificação é manual via `quickstart.md`, E2E é fase futura; os gates build/typecheck/lint/test são o requisito de regressão).

**Organization**: Tasks agrupadas por user story para implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: Mapeia a task para a user story
- Caminhos exatos de arquivo em cada descrição

## Path Conventions

- Single project: `src/`, `tests/` na raiz do repositório

---

## Phase 1: Setup — Tokens e superfície (Blocking Prerequisites)

**Purpose**: Fundação do design — sem os tokens nenhuma user story fecha visualmente.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [x] T001 Definir a superfície única em `src/app/globals.css` no bloco `:root`: `--background` → `oklch(0.965 0 0)`; `--card`, `--popover`, `--secondary`, `--accent`, `--sidebar` = `--background`; `--muted` → `oklch(0.945 0 0)`; `--foreground` e cores de texto **intocadas** (mantêm contraste atual)
- [x] T002 Recolorir o bloco `.dark` em `src/app/globals.css`: `--background` → `oklch(0.21 0 0)`; card/popover/secondary/accent/sidebar = background; `--muted` → `oklch(0.26 0 0)`; cores de texto intocadas
- [x] T003 Adicionar os tokens de sombra neumórfica e borda em `src/app/globals.css`: vars `--neu-shadow-raised` (4px/8px), `--neu-shadow-inset` (inset 3px/6px), `--neu-shadow-pop` (5px/10px) e `--neu-edge` — valores claro (luz `oklch(1 0 0)`, sombra `oklch(0.85 0 0)`, borda `oklch(0.9 0 0)`) e escuro (luz `oklch(0.27 0 0)`, sombra `oklch(0.16 0 0)`, borda `oklch(1 0 0 / 14%)`); expor como utilitários `shadow-neu-raised|inset|pop` via `@theme inline`
- [x] T004 Trocar o fundo do `body` para `bg-background` em `src/app/layout.tsx` (remove `bg-muted/30`) e estender `@media print` em `src/app/globals.css` com `box-shadow: none` para os novos estados/superfícies

**Checkpoint**: Fundação pronta — user stories podem começar.

---

## Phase 2: User Story 1 — Superfície e controles (Priority: P1) 🎯 MVP

**Goal**: Toda superfície interativa e campo do portal usa a mesma física — elevado em repouso, afundado ao pressionar; campos sempre rebaixados; foco e CTAs distinguíveis.

**Independent Test**: verificação manual dos itens US1 de `quickstart.md` nos dois temas.

### Implementation for User Story 1

- [x] T005 [P] [US1] Aplicar tokens no Button em `src/components/ui/button.tsx`: variantes `secondary`/`outline`/`ghost` com `shadow-neu-raised` em repouso → `active:shadow-neu-inset`; variante `default` (primary) mantém preenchimento escuro de alto contraste + `shadow-neu-raised` → `active:shadow-neu-inset` (espec FR-001, research D5); preservar `focus-visible:ring-3`
- [x] T006 [P] [US1] Card em `src/components/ui/card.tsx`: trocar `ring-1 ring-foreground/10` por `shadow-neu-raised` + borda `--neu-edge`; manter `rounded-xl` e espaçamento
- [x] T007 [P] [US1] Input em `src/components/ui/input.tsx`: `shadow-neu-inset` sempre + borda `--neu-edge`; manter raio atual e `focus-visible:ring` (espec FR-002/FR-003)
- [x] T008 [P] [US1] Textarea em `src/components/ui/textarea.tsx`: mesmo tratamento inset do Input (borda `--neu-edge` + `shadow-neu-inset` + foco)
- [x] T009 [P] [US1] Select em `src/components/ui/select.tsx` (gatilho): campo rebaixado `shadow-neu-inset` + borda `--neu-edge`; lista suspensa com `shadow-neu-pop` (elevação de camada)
- [x] T010 [P] [US1] Checkbox em `src/components/ui/checkbox.tsx`: repouso raised → marcado inset; cor de estado preservada
- [x] T011 [P] [US1] Switch em `src/components/ui/switch.tsx`: repouso raised → ligado inset; cores atuais preservadas
- [x] T012 [P] [US1] Tabs em `src/components/ui/tabs.tsx`: aba ativa inset, demais raised
- [x] T013 [P] [US1] Badge em `src/components/ui/badge.tsx`: relevo leve raised (`shadow-neu-raised`) mantendo as cores de variante
- [x] T014 [P] [US1] Avatar em `src/components/ui/avatar.tsx`: relevo raised sutil sem afetar as iniciais/imagem

**Checkpoint**: US1 completamente funcional e validável de forma independente (itens US1 no quickstart).

---

## Phase 3: User Story 2 — Navegação e contexto (Priority: P2)

**Goal**: Navegação (header, busca, sidebar, listagens) compartilha a física; item ativo e campo de busca identificáveis por profundidade mas com indicador extra (cor/texto).

**Independent Test**: itens US2 de `quickstart.md`.

### Implementation for User Story 2

- [x] T015 [US2] App header em `src/components/app-header.tsx`: superfície raised/sutil do painel, mantendo layout e o toggle de tema; campo de busca (usar Input existente, já inset)
- [x] T016 [US2] Sidebar de departamento em `src/components/department-sidebar.tsx`: painel raised; item ativo com `shadow-neu-inset` + indicador de cor preservado (espec FR-004)
- [x] T017 [P] [US2] Search component em `src/components/search-box.tsx`: campo `shadow-neu-inset` + borda `--neu-edge`, botão/atalho raised; resultados em painel raised/pop
- [x] T018 [P] [US2] Back link/breadcrumb em `src/components/back-link.tsx` e footer em `src/components/footer.tsx`: relevo coerente quando superficiais (ghost/link do botão já coberto pelo T005)
- [x] T019 [P] [US2] Tiles/listagens de documentos em `src/app/(app)/page.tsx` e `src/app/(app)/departamentos/[slug]/page.tsx`: aplicar `Card` atualizado (raised) aos tiles; listagens/linhas permanecem flat (research D6)
- [x] T020 [US2] Selo de revisão em `src/components/review-badge.tsx`: relevo leve raised preservando as cores de "em dia"/"vencendo"/"vencida" (espec FR-008) — profundidade é reforço, nunca o único sinal

**Checkpoint**: US1 + US2 funcionando de forma independente.

---

## Phase 4: User Story 3 — Áreas de trabalho (Priority: P2)

**Goal**: Editor, admin, histórico/diff e diagrama usam a mesma linguagem — com tabelas e texto flat e controles consistentes.

**Independent Test**: itens US3 de `quickstart.md`.

### Implementation for User Story 3

- [x] T021 [US3] Editor em `src/components/document-editor.tsx` e `src/components/rich-text-editor.tsx`: barra de ferramentas com controles raised→inset (botões já estilizados em T005); área de escrita legível (não sombreada)
- [x] T022 [P] [US3] Admin em `src/components/admin/`: formulários e inputs inset (via primitivos T007–T012); **tabelas flat** (users/departments/roles/sync) mantendo separação por `--border` (research D6); painéis/containers raised — arquivos: `users-manager.tsx`, `departments-manager.tsx`, `roles-manager.tsx`, `sync-panel.tsx`, `admin-nav.tsx`
- [x] T023 [P] [US3] Histórico e diff: página `/departamentos/[slug]/[docSlug]/historico` e `src/components/diff-view.tsx` permanecem flat, com cores de adição/remoção intactas; versões em superfícies raised leves (Card)
- [x] T024 [US3] Diagrama de responsabilidades em `src/components/responsibilities-diagram.tsx` e views em `src/components/department-responsibilities-view.tsx`: blocos raised (tokens), contorno "sem documentação" e vermelho de vínculo quebrado preservados; hover de vizinhos preservado
- [x] T025 [US3] Editor de responsabilidades em `src/components/department-responsibilities-editor.tsx`: campos inset e controles consistentes com o resto (via primitivos)

**Checkpoint**: Todas as user stories principais funcionais.

---

## Phase 5: User Story 4 — Confiança: camadas, acessibilidade, impressão (Priority: P3)

**Goal**: Camadas flutuantes elevadas, foco de teclado sempre visível, estados de erro/vazio/disabled comunicados por cor+texto (nunca só sombra), impressão sem relevo.

**Independent Test**: itens US4/US5/US6 de `quickstart.md`.

### Implementation for User Story 4

- [x] T026 [P] [US4] Diálogos e painéis flutuantes em `src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`: camada flutuante com `shadow-neu-pop` (aparecem acima das superfícies — espec FR-010)
- [x] T027 [P] [US4] Toast em `src/components/ui/sonner.tsx`: legível sobre qualquer superfície (checar em claro e escuro; sombra/contraste adequados)
- [x] T028 [US4] Verificar foco de teclado em todo controle tocado (Tab + Enter): anel `focus-visible` presente em todos os primitivos (spec FR-003, research D3); corrigir onde a sombra inset mascara o anel
- [x] T029 [US4] Estados de erro (`aria-invalid`), vazio e disabled nos primitivos: contraste preservado sobre fundos raised/inset (espec FR-009); confirmar que `disabled:opacity-50` e cores destrutivas seguem legíveis nos dois temas
- [x] T030 [US4] Revisar `@media print` em `src/app/globals.css`: documentações e mapa de responsabilidades sem sombra (FR-007); rodar a impressão nos dois temas e conferir folha limpa

**Checkpoint**: Confiança validada — feature pronta para polimento.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, verificação manual e sanity de diff — o DoD da constitution.

- [x] T031 Rodar gates de constituição na ordem: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`
- [ ] T032 Validar `quickstart.md` de ponta a ponta nos dois temas, marcando os itens `[X]` à medida que passam, e registrar falhas como pendências
- [x] T033 Verificar sanity do diff: nenhuma alteração fora de `src/app/globals.css`, `src/app/layout.tsx`, `src/components/` (spec FR-012) — `src/actions/`, `src/lib/` (salvo CSS), `prisma/`, `content/` intactos

---

## Phase 7: Animation Addendum — Micro-interações e tema suave (spec FR-013/014/015)

**Purpose**: Transições de profundidade animadas nos controles raised/inset/pop e troca de tema suave, tudo respeitando `prefers-reduced-motion`.

**Independent Test**: itens do addendum no `quickstart.md` (tema suave + reduced-motion) nos dois temas.

- [x] T034 `src/app/globals.css`: bloco `@media (prefers-reduced-motion: reduce)` zerando `animation-duration`, `animation-iteration-count`, `transition-duration` e `scroll-behavior` (FR-015); regra `html.theme-transition, html.theme-transition *, ...::before/::after { transition: background-color .3s, color .3s, border-color .3s, fill .3s, stroke .3s, box-shadow .3s !important }` (FR-014)
- [x] T035 `src/components/theme-toggle.tsx`: ao alternar tema, aplicar a classe `theme-transition` em `document.documentElement` por ~300ms (com `clearTimeout`), pulando quando `prefers-reduced-motion: reduce` (FR-014/FR-015) — ícone sun/moon já anima, não mexer
- [x] T036 Micro-interações de profundidade: em `src/components/department-sidebar.tsx` e `src/components/admin/admin-nav.tsx` trocar `transition-colors` por `transition-[background-color,box-shadow]` + `duration-200`; em `src/components/ui/checkbox.tsx` passar a transicionar `box-shadow` no `:active` (FR-013)
- [x] T037 Tiles em `src/app/(app)/page.tsx` e `src/app/(app)/departamentos/[slug]/page.tsx`: `hover:-translate-y-0.5` + incluir `transform` na transição já existente do hover (FR-013)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependência (tokens) — BLOQUEIA todas as user stories
- **US1 (Phase 2)**: depende da Phase 1 — começa primeiro (P1/MVP)
- **US2 (Phase 3)**: depende da Phase 1; usa primitivos da US1 (T005–T014) já estilizados (T015–T017 usam Input/Button/Card atualizados)
- **US3 (Phase 4)**: depende da Phase 1 e dos primitivos da US1
- **US4 (Phase 5)**: depende da Phase 1 e, para diálogos/menus, dos primitivos da US1
- **Polish (Phase 6)**: depende de todas as user stories

### User Story Dependencies

- **US1**: começa após Phase 1; sem dependência de outras stories
- **US2** e **US3**: podem rodar em paralelo após US1 (staff permitir)
- **US4**: paralela a US2/US3 após US1 (exceto verificação de diálogos que depende de suas chamadas)

### Within Each User Story

- Implementação antes da integração; story completa antes de avançar a prioridade

### Parallel Opportunities

- Todas as tasks `[P]` podem rodar em paralelo (arquivos distintos)
- US1 (T005–T014), US3 (T021–T025) e US4 (T026–T029) têm alto grau de paralelismo por arquivo
- T015–T020 (US2) rodam em paralelo entre si após a Phase 1

---

## Parallel Example: User Story 1

```bash
# Todos os primitivos são arquivos independentes — podem ser editados em paralelo:
Task: "Aplicar tokens no Button em src/components/ui/button.tsx"   # T005
Task: "Card em src/components/ui/card.tsx"                         # T006
Task: "Input em src/components/ui/input.tsx"                       # T007
Task: "Textarea em src/components/ui/textarea.tsx"                 # T008
Task: "Select em src/components/ui/select.tsx"                     # T009
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (Setup/tokens)
2. Complete Phase 2 (US1 — primitivos)
3. **STOP and VALIDATE**: itens US1 do `quickstart.md` nos dois temas
4. Seguir para US2/3/4 → Polish

### Incremental Delivery

1. Phase 1 + US1 → MVP visual (toda superfície/controle do portal com a nova física)
2. US2 → navegação coerente
3. US3 → áreas de trabalho coerentes
4. US4 → camadas, acessibilidade, impressão
5. Phase 6 → gates + verificação manual + sanity diff

### Parallel Team Strategy

Com mais de um editor: cada um pega primitivos distintos de `src/components/ui/` (T005–T014), depois chrome (US2), depois áreas (US3) e confiança (US4).

---

## Notes

- [P] tasks = arquivos diferentes, sem dependência
- [Story] mapeia a task à user story da spec
- Fase 1 (tokens) é o único bloqueio transversal — um único `globals.css`, tasks sequenciais
- Verificação final é manual (`quickstart.md`), pois E2E de navegador é fase futura
- Commitar após cada task ou grupo lógico: separar `specs/` dos changes de código