# Feature Specification: Redesign neumórfico do portal

**Feature Branch**: `feat/001-redesign-neumorfico`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: O produto inteiro deve usar design baseado em neumorphism, feito de forma profissional, como grandes empresas. Decisões de escopo travadas: neumorfismo aplicado ao chrome do app (navegação, superfícies, controles); o corpo das documentações permanece flat; dark mode preservado; paleta neutra atual mantida.

## Clarifications

### Session 2026-09-11

- Q: Qual a intensidade de profundidade ("teatralidade") do neumorfismo no portal? → A: Opção B — suave a moderado: relevo presente mas contido, halo difuso, sombras curtas (≈4–8px), sobriedade corporativa (soft-UI), contraste AA preservável.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Superfície base e controles (Priority: P1)

Todo o portal passa a exibir uma única "física": controles e superfícies parecem esculpidos no fundo do app — elevados em repouso, afundados quando pressionados, campos de entrada sempre rebaixados. Isso é verdade em qualquer tela e nos dois temas (claro e escuro), com o mesmo estilo nas páginas de autenticação, na home, nas telas de departamento e no admin.

**Why this priority**: É a fundação visual — sem a superfície coerente, nenhuma outra melhoria de consistência é possível. Nada dependente de tela específica.

**Independent Test**: Uma pessoa abre uma tela de login, um card de documento, um botão e um campo de busca em **tema claro e escuro** e confirma, sem consultar o código, que todos parecem do mesmo material e que pressionar um botão "afunda" o elemento de forma perceptível — habilidade que pode ser testada em qualquer página.

**Acceptance Scenarios**:

1. **Given** o portal em tema claro, **When** olha qualquer botão, card, campo de formulário ou item de navegação com as áreas de destaque escuras em baixo-direita e claras em cima-esquerda, **Then** os elementos parecem emergir da mesma cor de fundo, sem borda dura aparente
2. **Given** um botão ou item de navegação em repouso, **When** a pessoa o pressiona, **Then** o elemento afunda (a luz e a sombra invertem de posição) de forma imediata e perceptível
3. **Given** um campo de texto (busca, login, formulário de edição), **When** a pessoa o vê vazio e em foco, **Then** o campo aparece rebaixado em relação à superfície e o foco continua visível
4. **Given** o portal em tema escuro, **When** a pessoa repete a inspeção acima, **Then** a mesma linguagem de profundidade aparece, com a iluminação adaptada sem perder legibilidade

---

### User Story 2 - Navegação e contexto (Priority: P2)

A navegação do portal — cabeçalho com busca, sidebar de departamento, breadcrumb, listagens — passa a usar a mesma física da superfície, funcionando como um painel esculpido que orienta quem está lendo sem roubar a atenção do conteúdo. A busca e o item ativo do menu ficam marcados como afundados, o que indica "onde estou" sem depender só de cor.

**Why this priority**: O usuário navega o tempo todo; é o segundo maior ganho percebido de consistência depois da superfície base.

**Independent Test**: Uma pessoa percorre home → departamento → documentação → busca e consegue dizer, em qualquer passo, qual é o item ativo e qual campo é o de busca só pela profundidade — sem ler o texto.

**Acceptance Scenarios**:

1. **Given** a listagem de um departamento, **When** a pessoa observa a sidebar e o item da documentação aberta, **Then** o item ativo aparece rebaixado em relação aos demais
2. **Given** a busca no cabeçalho ou na página de um departamento, **When** a pessoa digita e vê os resultados, **Then** o campo se mantém rebaixado e legível, e os resultados continuam legíveis nos dois temas
3. **Given** as listagens de documentos e resposabilidades, **When** a pessoa identifica os cards/tiles de cada item, **Then** eles compartilham o mesmo relevo e os selos de revisão (em dia/vencendo/vencida) continuam distinguíveis sem confiar só em sombra
4. **Given** breadcrumb, botão voltar e ações de impressão, **When** a pessoa os usa, **Then** funcionam como o restante dos controles (elevado/afundado) sem regressão de clique

---

### User Story 3 - Áreas de trabalho e conteúdo operacional (Priority: P2)

As áreas em que o usuário *trabalha* o conteúdo — editor, admin (usuários, departamentos, papéis, sincronização), histórico de versões, diff e o diagrama de responsabilidades — recebem a mesma linguagem com prioridade para o que é clicável: botões de ação afundam ao pressionar, controles de formulário ficam rebaixados, e as superfícies de dados (tabelas, painéis) ganham relevo suave sem prejudicar a leitura de linhas de tabela ou o desenho de setas do diagrama.

**Why this priority**: São as telas de maior densidade e maior exposição a erros do usuário; a leitura permanece prioridade acima do efeito visual.

**Independent Test**: Uma pessoa usa o fluxo completo de "editar uma documentação e salvar", "aprovar/criar um usuário" em `/admin` e abre o diff de uma versão — e nada perde legibilidade nem clicabilidade; cada ação continua com feedback claro de pressionamento.

**Acceptance Scenarios**:

1. **Given** o editor de documentação, **When** a pessoa usa a barra de ferramentas e o formulário, **Then** todos os controles seguem a linguagem (botões elevados, campos rebaixados) e o texto digitado mantém contraste pleno
2. **Given** as tabelas de admin (usuários, departamentos, papéis) e a lista de versões, **When** a pessoa lê uma linha qualquer, **Then** o texto e as linhas continuam legíveis e distinguíveis, sem depender de sombras para separar linhas
3. **Given** o diagrama de responsabilidades, **When** a pessoa vê blocos e setas, **Then** a leitura das setas e a marcação de "sem documentação" e "vínculo quebrado" continuam claras; blocos seguem linkáveis e com hover destacando vizinhos
4. **Given** o diff de duas versões, **When** a pessoa compara conteúdo, **Then** as cores de adição/remoção continuam distinguíveis nos dois temas

---

### User Story 4 - Confiança: impressão, estados e acessibilidade (Priority: P3)

O redesign não pode quebrar o que já é confiável: impressão de documentação e de responsabilidades contínua nítida e sem sombras no papel; estados de erro/vazio/carregando continuam visíveis; e foco de teclado, contraste e distinção de estados ativos não dependem da sombra sozinha (falha clássica do neumorfismo).

**Why this priority**: Acessibilidade e impressão são requisitos não-negociáveis do projeto (constituição); qualquer regressão aqui bloqueia o merge.

**Independent Test**: Uma pessoa imprime uma documentação e o mapa de responsabilidades e confere folha nítida, e usa teclado (Tab/Enter) para navegar o portal confirmando anel de foco claro em todo controle.

**Acceptance Scenarios**:

1. **Given** a impressão de uma documentação, **When** a pessoa imprime no tema escuro, **Then** a folha sai em preto sobre branco, sem sombra ou relevo
2. **Given** a impressão do mapa de responsabilidades, **When** a pessoa imprime, **Then** os blocos aparecem como superfícies planas com borda definida, legíveis
3. **Given** a navegação por teclado pelo portal, **When** a pessoa percorre todos os controles com Tab, **Then** cada um mostra um anel de foco claramente visível nos dois temas
4. **Given** estados de erro (ex.: formulário inválido), vazio (home sem documentos) e desabilitado, **When** a pessoa os encontra, **Then** continuam comunicados com cor/texto — nunca só com profundidade
5. **Given** o corpo da documentação renderizada, **When** a pessoa lê um artigo longo, **Then** o conteúdo permanece flat, com tipografia e contraste atuais intactos

---

### Edge Cases

- Sinais de erro (`aria-invalid`) e estados `disabled` precisam continuar legíveis sobre a nova profundidade — cor não pode perder contraste sobre superfícies rebaixadas/inset.
- Tema escuro: a luz que "vem de cima" não pode gerar brilho branco que apague texto de baixo contraste.
- Superfícies sobrepostas (dialog/sheet/popover abertos sobre cards): a camada flutuante precisa parecer mais alta que a de baixo — hierarquia de elevação em camadas.
- Chevrons/ícones de tamanho pequeno em botões `icon` não podem sumir contra fundos inset.
- Impressão ignorando sombras — incluindo o selo de revisão e o diff.
- `prefers-reduced-motion` (diferido para a fase de plano/implementação se inviável nas animações atuais de `transition-all`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda superfície interativa (botões, itens de menu, tiles, cards) deve exibir profundidade percebida — elevada em repouso e afundada ao pressionar/ativar — consistente em **todas** as telas do portal.
- **FR-002**: Todo campo de entrada (busca, login, formulários de criação/edição) deve ser apresentado como rebaixado em relação à superfície à sua volta, em qualquer estado.
- **FR-003**: Um campo ou item em estado focado deve permanecer identificável por foco visível, sem depender da profundidade.
- **FR-004**: Itens ativos de navegação (documentação aberta, aba selecionada) devem ser distinguíveis por profundidade e por qualquer outro indicador necessário.
- **FR-005**: O corpo das documentações (`.doc-content`) deve permanecer visualmente plano, sem profundidade, preservando a tipografia e o contraste atuais.
- **FR-006**: O tema escuro deve oferecer a mesma linguagem de profundidade, com legibilidade equivalente ou superior.
- **FR-007**: A impressão de documentações, responsabilidades e telas de dados deve sair sem sombras nem relevos, em preto sobre branco.
- **FR-008**: Selos do ciclo de revisão (em dia / vence em N dias / vencida) devem continuar distinguíveis nos dois temas, sem depender apenas de profundidade.
- **FR-009**: Estados de erro, vazio e desabilitado devem continuar comunicados por cor, ícone e/ou texto — a profundidade é sempre reforço, nunca o único canal.
- **FR-010**: A hierarquia de camadas (diálogos, painéis laterais, menus suspensos acima das superfícies) deve manter elevação crescente, sem parecer que elementos sobrepostos estão "no mesmo chão".
- **FR-011**: Elementos em que uma linha de texto é crítica (tabelas do admin, diff, diagrama de responsabilidades) devem preservar legibilidade de linha, com separação não dependente só de sombra.
- **FR-012**: A mudança de visual não pode alterar nenhum comportamento, rota, permissão ou dado existente.

#### Animation Addendum (2026-09-11)

- **FR-013**: Controles com profundidade (botões, itens de navegação, checkbox, tiles/cards-link) devem alternar entre os estados raised/inset/pop com transição suave de sombra (~150–200ms), sem animações de caracteres, bounce ou deslocamento além de um leve lift no hover dos tiles.
- **FR-014**: Ao alternar o tema claro/escuro, as cores de superfície, texto e borda transitam suavemente (~300ms) num único momento da troca — sem transições permanentes globais.
- **FR-015**: Todas as animações e transições introduzidas são desativadas quando o usuário tem `prefers-reduced-motion: reduce` (navegador), incluindo a transição de tema.

### Key Entities *(include if feature involves data)*

*(sem entidades de dados — feature puramente visual; nenhuma mudança de modelo, rota ou permissão)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das telas do produto (autenticação, home, departamentos, documentação, busca, admin) usam a mesma linguagem de profundidade nos dois temas — verificado por inspeção manual guiada pelo roteiro de `quickstart.md`.
- **SC-001a**: A profundidade é perceptível de imediato porém contida (relevo suave, halo difuso, em vez de 3D ostensivo) — alinhada ao tom "suave a moderado" definido na clarificação; a inspeção manual não encontra sombras longas ou bordas duras.
- **SC-002**: Contraste de texto: nenhum par texto/superfície degrada em relação ao estado atual (verificado contra a lista de tokens existente; alvo WCAG AA para texto normal).
- **SC-003**: 100% dos controles focáveis mantêm anel de foco visível via teclado, nos dois temas.
- **SC-004**: Impressão de documentação e de responsabilidades sai sem sombras/relevos em 100% dos navegadores-alvo testados.
- **SC-005**: Zero regressão de comportamento: `npm test`, `typecheck`, `lint` e `build` verdes ao final, e nenhuma rota/permissão alterada (dif de rotas vazio).
- **SC-006**: A suíte visual de verificação manual cobre ao menos 1 tela de cada área (login, home, listagem de departamento, documentação, editor, admin, historico/diff, diagrama) em claro e escuro.
- **SC-007**: A troca de tema transita de forma suave e a inspeção manual com `prefers-reduced-motion: reduce` não apresenta nenhuma animação (zero duration).

## Assumptions

- O neumorfismo é aplicado ao **chrome** (navegação, superfícies, controles); o corpo das documentações permanece flat.
- O **dark mode** atual é preservado, com `system` como padrão.
- A **paleta atual** (neutro) é mantida; nenhuma cor de marca nova.
- A **intensidade** da profundidade segue a clarificação de 2026-09-11: suave a moderado (halo difuso, sombras no intervalo ≈4–8px, relevo presente mas contido) — tom definido com o usuário; SC-001a torna isso verificável.
- Não há mudança de comportamento, rota, permissão ou schema — feature puramente de apresentação.
- A verificação visual é manual (E2E de navegador é fase futura do projeto); os gates automáticos existentes (build/typecheck/lint/test) permanecem obrigatórios.
- Animações: as transições atuais são mantidas e respeitam `prefers-reduced-motion` conforme viabilidade avaliada na fase de plano.
- A feature é aplicada sem depender de novas dependências de biblioteca; se a fase de plano concluir que um utilitário é indispensável, a decisão é explicitamente registrada em `research.md` antes de adotar.