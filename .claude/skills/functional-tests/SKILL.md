---
name: functional-tests
description: Write or extend tests for easyopendocs (Vitest, tests/ directory) — real Postgres and real filesystem, mocking only the framework/identity boundary. Use whenever adding tests for src/lib, src/actions, or Prisma-backed logic in this repo.
---

# Testes funcionais no easyopendocs

O objetivo declarado ao montar essa suíte: testes que provam comportamento
real, não testes que só espelham o que o código já faz e sempre vão passar.
Um teste que mocka o banco para "simular" RBAC está testando a suposição de
quem escreveu o mock, não o `rbac.ts` de verdade — e passa mesmo se o RBAC
real estiver quebrado.

## Regra central: só mockar fronteira de framework, nunca lógica da aplicação

**Nunca mockar:** Postgres, `fs`, `sanitizeDocumentHtml`, `content-sync.ts`,
`rbac.ts`. Se um teste precisa desses módulos, ele bate no Postgres de teste
de verdade (`TEST_DATABASE_URL`, ver `tests/README.md`) e num `CONTENT_ROOT`
temporário de verdade. É o único jeito de um teste pegar uma regressão real:
mockar qualquer um desses seria reimplementar a função sob outro nome e
testar a cópia.

**Pode mockar, e só isso:**
- `@/lib/auth`'s `auth()` — já vem mockado globalmente em `tests/setup.ts`
  (default: `null`, ninguém logado). Controle por teste com
  `vi.mocked(auth).mockResolvedValue({ user: { id } } as never)`. A partir daí
  tudo é real: `getCurrentUser()` faz uma busca de verdade no banco pelo
  `id`, confere `isActive` de verdade, etc. Você está fingindo "qual cookie
  o navegador mandou", não decidindo se o usuário tem acesso.
- `next/cache`'s `revalidatePath` — exige uma árvore de render do App Router
  que não existe fora do Next. É invalidação de cache, não regra de negócio;
  mocke com `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))` no
  topo do arquivo que testa uma server action.
- `redirect()` de `next/navigation` — **não precisa mockar**. Ele lança um
  erro de controle de fluxo mesmo fora de uma request:
  ```ts
  const error = await someAction(state, formData).catch((e) => e);
  expect(error.digest.startsWith("NEXT_REDIRECT")).toBe(true);
  expect(error.digest).toContain("/sem-acesso"); // ou o path de sucesso
  ```
  Isso prova PARA ONDE a ação redirecionou de verdade — mais forte que só
  checar "não deu erro".

Qualquer módulo com `import "server-only"` no topo (`sanitize.ts`, `rbac.ts`,
`document-render.ts`, `department-responsibilities-file.ts`) já funciona sob
Vitest: `vitest.config.mts` faz o alias `"server-only"` apontar para
`tests/stubs/server-only.ts` (um no-op), reproduzindo a troca que o bundler
do Next já faz nas compilações de servidor. Não precisa fazer nada extra pra
importar esses módulos — só não escreva um novo módulo `server-only` que
dependa de uma API exclusiva de request do Next (isso aí não tem stub).

## O que já está pronto para reusar

- `tests/helpers/db.ts` — `resetDatabase()` (truncate geral, rodado
  automaticamente antes de cada teste por `tests/setup.ts`) e reexporta
  `seedPermissionsAndRoles`/`upsertUser`/`assignRole` de `src/lib/rbac-seed.ts`
  — as mesmas fixtures que `prisma/seed.ts` usa em produção. Não duplique essa
  lógica dentro de um teste; se falta algo, estenda `rbac-seed.ts`.
- `contentRoot()` (`@/lib/content`) já aponta para um tmpdir isolado dentro de
  qualquer arquivo de teste — escreva arquivos ali com `node:fs/promises`
  normalmente.
- `syncContent({ trigger: "MANUAL", force: true })` — use para indexar
  fixtures de disco reais em vez de inserir `Department`/`Document` direto no
  Prisma quando o teste também depende do indexador (ver
  `tests/actions/documents.test.ts` para um exemplo: escreve a pasta do
  departamento no disco e chama `syncContent` de verdade antes de exercitar a
  action).

## As duas pegadinhas que já morderam esta suíte

1. **`CONTENT_ROOT` e `DATABASE_URL` são constantes de módulo, lidas uma vez
   no import** (`src/lib/content.ts`, `src/lib/prisma.ts`) — não a cada
   chamada. `tests/setup.ts` funciona porque `setupFiles` roda antes dos
   imports do arquivo de teste; dentro do próprio `tests/setup.ts`, por isso,
   o import de `./helpers/db` é dinâmico (`await import(...)`), depois de
   setar as env vars — um `import` estático ali seria hospedado (hoisted)
   para antes das atribuições e leria os valores errados.

2. **Consequência: o tmpdir de `CONTENT_ROOT` é criado uma vez por ARQUIVO,
   não por teste.** Um arquivo com mais de um `it()` escrevendo fixtures em
   disco (ex.: `content-sync.test.ts`) precisa de um `beforeEach` LOCAL que
   limpe o diretório:
   ```ts
   beforeEach(async () => {
     await fs.rm(contentRoot(), { recursive: true, force: true });
     await fs.mkdir(contentRoot(), { recursive: true });
   });
   ```
   O Postgres já é limpo globalmente (`resetDatabase()` em
   `tests/setup.ts`); o disco, não — sem esse `beforeEach`, um arquivo escrito
   por um teste aparece no `syncContent()` do próximo teste como se fosse dele.
   Isso já derrubou 5 dos 9 testes de `content-sync.test.ts` antes de ser
   corrigido — é fácil de repetir num arquivo novo.

## Antes de escrever qualquer asserção: rode e leia o valor real

Não adivinhe o output de uma função e escreva `expect(x).toBe(<o que parece
certo>)`. Rode o trecho isolado (node -e, ou o teste mesmo com um
`console.log`) e confirme o valor de verdade antes de fixar a asserção — foi
assim que se descobriu, por exemplo, que `htmlToPlainText` remove `<p>` sem
inserir espaço entre os textos adjacentes (`"antesdepois"`, não
`"antes depois"`) quando não há whitespace na entrada. Uma asserção escrita
"de cabeça" que por acaso bate com o comportamento atual não é mais confiável
que uma tautologia — só descobre isso quem tentar mudar o código depois e vir
o teste passar de qualquer jeito.

## Fora de escopo aqui (fase 2 — Playwright, ainda não criada)

Qualquer coisa que dependa de sessão/cookie real: `getCurrentUser()`,
`requireUser()`, a tela de login, RSC + client component juntos no navegador.
Não tente mockar `next/headers`/cookies para forçar esse caminho em Vitest —
é sinal de que o teste pertence à fase 2. `tests/README.md` documenta a
divisão.

## Rodando

```bash
npm test          # uma vez — precisa de TEST_DATABASE_URL (tests/README.md)
npm run test:watch
```
