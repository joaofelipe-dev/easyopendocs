# Quickstart — Verificação manual do redesign neumórfico

**Purpose**: Roteiro de validação fim-a-fim da feature (substitui E2E de navegador,
que é fase futura). Onde estiver marcado `[ ]`, a rodada de verificação acontece
na implementação e o item vira `[X]`.
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Pré-requisitos

- Banco de teste: `npm run db:up` + `npm run db:migrate` + `npm run db:seed`
- App: `npm run dev` em `http://localhost:3000`
- Credenciais do seed (README): `admin@exemplo.com` / `admin123`

## Roteiro — tema claro e tema escuro (repetir todos os passos nos dois)

> Alternar tema pelo toggle no cabeçalho. Anotar falhas como `✗ [tela] detalhe`.

### 1. Superfície e controles (US1)

- [ ] **Auth**: a tela de login usa a superfície única; campos rebaixados (inset) e botão de entrar com relevo
- [ ] **Botão**: em repouso parece emergir do fundo (luz cima-esq, sombra baixo-dir); ao pressionar afunda (inset) de forma perceptível
- [ ] **Campo de texto**: sempre rebaixado (inset), legível; foco com anel visível
- [ ] **Card**: relevo raised + borda sutil, fundo igual ao da página
- [ ] **Primários**: botão `default` (escuro) continua distinguível de um card — CTA é achável pelo preenchimento, não só por sombra

### 2. Navegação (US2)

- [ ] **Home → departamento → documentação**: item ativo da sidebar aparece rebaixado; demais raised
- [ ] **Busca**: campo inset no cabeçalho e na página; resultados legíveis
- [ ] **Listagem de documentos**: tiles/cards compartilham o mesmo relevo; selos de revisão (em dia/vencendo/vencida) distinguíveis por cor
- [ ] **Breadcrumb / voltar / imprimir**: funcionando, com feedback de pressionar

### 3. Áreas de trabalho (US3)

- [ ] **Editor**: barra de ferramentas com controles elevados→inset; área de texto legível
- [ ] **Admin usuarios/departamentos/papeis/sync**: formulários inset; **tabelas flat** e legíveis linha a linha; botões de ação com o mesmo comportamento
- [ ] **Histórico/diff**: comparação legível, cores de adição/remoção distinguíveis
- [ ] **Diagrama de responsabilidades**: blocos com relevo suave; sem documentação (contorno) e vínculo quebrado (vermelho) claros; hover destacando vizinhos

### 4. Camadas flutuantes (US4)

- [ ] **Dialog/sheet/menus/popover** (ex.: excluir doc, menu do usuário): aparecem *acima* das superfícies (elevação de camada `pop`)
- [ ] **Toasts** (sonner): legíveis sobre qualquer superfície

### 5. Estados e acessibilidade (US4)

- [ ] **Teclado**: Tab percorre todos os controles com anel de foco visível
- [ ] **Erro**: formulário inválido mantém cor de erro legível (não só profundidade)
- [ ] **Disabled**: controle desabilitado comunicado por opacidade/cor
- [ ] **Conteúdo flat**: um artigo longo mantém tipografia e contraste atuais (`.doc-content` sem sombra)

### 6. Impressão

- [ ] **Documentação** (tema escuro ativo antes de imprimir): folha preto sobre branco, sem sombra
- [ ] **Mapa de responsabilidades**: blocos planos com borda, sem relevo

### 7. Animation Addendum (FR-013/014/015)

- [ ] **Transições de profundidade**: hover e pressionar de botões/checkbox/itens de navegação alternam sombra de forma suave (~150–200ms), sem mudança instantânea
- [ ] **Tiles**: hover levanta levemente (lift ~2px) com a sombra `pop`
- [ ] **Tema suave**: alternar claro/escuro transiciona cores suavemente (~300ms), num único momento — sem "flash" de troca instantânea
- [ ] **Reduced motion**: com `prefers-reduced-motion: reduce` ativo no SO/navegador, nenhuma animação roda (inclusive a troca de tema é instantânea)

## Critérios de aceite finais

- [ ] Gates verdes: `npm run build` → `npm run typecheck` → `npm run lint` → `npm test`
- [ ] `git diff` sem alterações em `src/actions/`, `src/lib/` (exceto `globals.css`-adjacente proxy não), rotas, `prisma/` ou `content/`
- [ ] SC-001a: profundidade perceptível mas contida (halo difuso) em todos os itens acima