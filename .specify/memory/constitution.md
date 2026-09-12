# easyopendocs Constitution

## Core Principles

### I. Filesystem é a fonte de verdade
O conteúdo vive em arquivos sob `content/departamentos/` — `.html` por
documentação, `_departamento.json`, `_responsabilidades.json` e `_media/`.
O banco (SQLite) é um **índice derivado** desses arquivos: permite listar,
permissionar e auditar sem varrer disco. O indexador (`content-sync.ts`) lê o
disco e grava no banco; nada é apagado silenciosamente — arquivo que some vira
órfão com registro preservado, nunca destruído. Nenhum recurso pode depender de
dado que não exista em arquivo ou que o sync não consiga reconstruir. O arquivo
SQLite é gerado no bootstrap (migrate + seed) e não é versionado.

### II. Testes funcionais reais (NON-NEGOTIABLE)
Testes rodam contra **SQLite real** (`TEST_DATABASE_URL`, arquivo de teste) e
**filesystem real** (`CONTENT_ROOT` temporário). A única coisa mockada é a
fronteira framework/identidade; banco, disco e sanitizador nunca são mockados.
Toda funcionalidade ativada por código entrega junto o teste que a prova (ou,
para funções puras de risco, um check autônomo que falhe se a lógica quebrar).
Fase futura prevista e explicitamente aceita: E2E de navegador, quando testes
isolados não bastarem.

### III. Segurança do conteúdo
HTML de documentação é conteúdo controlado por usuário: passa por DOMPurify com
allowlist de tags e atributos antes de toda renderização e antes de ser gravado
no disco. Decisões de acesso são **server-side** (`src/lib/rbac.ts`) e releem o
banco a cada request — o JWT carrega só um snapshot para a UI. Slugs de
departamento e documento são validados contra `^[a-z0-9]+(?:-[a-z0-9]+)*$`
antes de virar caminho de arquivo (impede path traversal). Segredos não entram
no Git; credenciais de produção vivem fora do repositório.

### IV. Escopo real, YAGNI
Feature nasce de necessidade de uso do portal, nunca de especulação. Sem
abstração para um caso que ainda não existe, sem config para valor que não muda.
Simplicidade e padrão do projeto vencem sobre engenharia perpétua: "lazy" aqui
significa o menor diff que resolve o problema real, não o menor diff possível a
qualquer custo.

### V. Autohospedado e operável
O portal não depende de nenhum serviço externo para operar: o banco é o arquivo
SQLite local (índice derivado dos arquivos de conteúdo), sem servidor de banco
nem serviços em nuvem. Deploy é rede local com comandos simples (`build` +
`db:deploy` + `start`), e o mesmo arquivo permite deploy serverless (Vercel)
com conteúdo e banco regenerados no bootstrap. Os dois ativos de estado —
banco (RBAC, metadados, histórico) e `content/departamentos/` — têm backup
coberto; a restauração deve ser testada periodicamente. Container/serviço
instalado local nunca é pré-requisito.

## Restrições de Stack

Stack decidida e estrita — novas dependências exigem justificativa contra estes
critérios: Next.js 16 (App Router, React 19, TypeScript estrito), TailwindCSS v4
+ shadcn/ui, SQLite (arquivo único; busca full-text por FTS5 embutido), Prisma 7
(driver adapter `@prisma/adapter-better-sqlite3`), NextAuth v5 (Auth.js)
Credentials + JWT, `isomorphic-dompurify`. **Node.js 22.19+** é requisito
declarado no `engines`, não preferência. O schema vive em `prisma/schema.prisma`
e a connection string em `prisma.config.ts`; o client é gerado em
`src/generated/prisma/` e não é versionado. O padrão de conteúdo é o descrito
em `content/TEMPLATE.md`; documentação que não participa do ciclo de revisão
não ganha selo.

Permissões: `document:read`, `document:create`, `document:edit`,
`department:manage`; `isSuperAdmin` é ortogonal aos papéis. Uma permissão só tem
efeito quando o código a verifica server-side.

## Workflow de Desenvolvimento e Quality Gates

Nenhuma mudança vai para `main` sem passar, **nesta ordem**:

1. `npm run build` — vem primeiro: gera `.next/types/**` que o typecheck requer;
2. `npm run typecheck` — `tsc --noEmit`;
3. `npm run lint` — ESLint;
4. `npm test` — suíte funcional contra SQLite real (sem serviços; o arquivo de
   teste é recriado pelo próprio runner).

Desenvolvimento é spec-driven via Spec Kit: cada feature passa por
`specify → clarify → plan → tasks → implement`, com os artefatos em `specs/NNN-<feature>/`
(review gates entre `specify`, `plan` e `implement`). Convenção de commit e
escopo de PR seguem `CONTRIBUTING.md`; bugs de código antigo não precisam abrir
spec nova — o teste da correção é o requisito mínimo.

## Governance

Esta constitution prevalece sobre práticas ad hoc e sobre este documento: emendas
exigem alteração documentada aqui, bump semântico de versão e revisão de impacto
(MAJOR: remoção/redefinição de princípio; MINOR: princípio/seção novo; PATCH:
esclarecimento). A ratificação é a adoção original; `Last Amended` marca a data
da última emenda. Todo spec, plano e implementação deve seguir estes princípios;
implementador e revisor devem poder verificar cada decisão contra eles. Guia
operacional de runtime: `AGENTS.md` na raiz do projeto.

**Version**: 1.1.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
(port Postgres→SQLite: princípios II e V reescritos, stack atualizada — MINOR)