# Testes

Testes de integração/funcionais: batem num Postgres de teste real e num
`CONTENT_ROOT` temporário. Nada de banco, disco ou sanitizador mockado — ver
"Por que não mockar" mais abaixo, e a skill `.claude/skills/functional-tests/`
para o raciocínio completo por trás disso.

## Rodar

```bash
docker compose up -d --wait   # se ainda não estiver de pé
npm test                      # roda uma vez
npm run test:watch            # modo watch
```

Só precisa de `TEST_DATABASE_URL` no `.env` (já vem preenchida no
`.env.example` — mesma instância do `docker-compose.yml`, banco
`easyopendocs_test`, separado do banco de desenvolvimento). Na primeira execução,
`tests/global-setup.ts` cria esse banco sozinho e aplica as migrations; não
precisa rodar nada manualmente antes.

Em CI, o job `test` do `.github/workflows/ci.yml` sobe seu próprio Postgres
de serviço — mesma lógica, sem precisar do Docker Compose local.

## O que cada arquivo cobre

| Arquivo | O quê |
| --- | --- |
| `tests/lib/sanitize.test.ts` | `sanitizeDocumentHtml`/`htmlToPlainText` — casos reais de fuga de sandbox (script, iframe, `on*`, `javascript:`), não uma paráfrase da allowlist |
| `tests/lib/rbac.test.ts` | `getDepartmentAccess`/`can`/`listAccessibleDepartments` contra banco real: união de papéis, super admin, departamento órfão, revogação sem cache |
| `tests/lib/content-sync.test.ts` | `syncContent` contra disco+banco reais: criação, skip por mtime/hash, órfão de documento e de departamento, retorno (un-orphan) |
| `tests/lib/department-responsibilities.test.ts` | `parseResponsibilities`/`resolveResponsibilities` — lógica pura, ids, poda de `deliversTo` órfão, cálculo de "sem documentação" |
| `tests/lib/search.test.ts` | `searchDocuments` contra o tsvector real: acerto no corpo, busca sem acento, recorte por `document:read`, órfão fora, ranking por peso e o backfill automático do índice |
| `tests/lib/document-version.test.ts` | Histórico contra disco+banco reais: v1 na indexação, `force` não versiona documento intocado, edição por fora, retenção, atribuição de autoria |
| `tests/lib/text-diff.test.ts` | `diffDocuments` — lógica pura: HTML indentado à mão casando com o de uma linha só que o editor gera, colapso de blocos iguais, teto de tamanho |
| `tests/lib/responsibilities-graph.test.ts` | `buildResponsibilitiesGraph` — layout do diagrama: blocos que não se sobrepõem, texto dentro da caixa, quebra de título, aresta para id inexistente descartada |
| `tests/lib/review-cycle.test.ts` | `reviewStatus`/`parseReviewInterval` — lógica pura: herança departamento→documento, fronteira exata do vencimento, janela de aviso proporcional, entrada estragada ignorada |
| `tests/actions/documents.test.ts` | `createDocumentAction` fim a fim: RBAC real → sanitização real → arquivo real no disco → indexação real → redirect |

Não é exaustivo — é a base de cada camada arriscada do app (RBAC, sanitização,
sincronização, uma server action completa). Estender seguindo os mesmos
helpers é o caminho natural; a skill tem o "como".

## Deliberadamente fora daqui (fase 2 — Playwright)

Qualquer coisa que dependa de sessão/cookie de verdade: `getCurrentUser()`,
`requireUser()`, login, e o caminho completo de uma página (RSC + client
component + navegador). Aqui `auth()` é mockado só na resposta de "quem está
logado" — o resto (busca do usuário no banco, `isActive`, permissões) roda de
verdade. Ver `tests/setup.ts` para onde esse mock vive.

## As duas pegadinhas que já morderam esta suíte

1. **`CONTENT_ROOT` e `DATABASE_URL` são lidos uma vez, no import do módulo**
   (`src/lib/content.ts`, `src/lib/prisma.ts`) — não a cada chamada. Por isso
   `tests/setup.ts` só funciona porque `setupFiles` roda antes dos imports do
   arquivo de teste, e por isso esses dois `process.env.X = ...` usam
   `await import(...)` dinâmico em vez de `import` estático logo depois.
   Um `import` estático teria sido hospedado (hoisted) para antes das
   atribuições.

2. **O tmpdir de `CONTENT_ROOT` é criado uma vez por ARQUIVO de teste, não uma
   vez por teste** (consequência direta do ponto acima — não dá para trocar
   de diretório no meio do arquivo). Um arquivo de teste que escreve fixtures
   em disco em mais de um `it()` — como `content-sync.test.ts` — precisa de um
   `beforeEach` LOCAL que limpe o conteúdo do diretório (não o backend, o
   Postgres já é limpo globalmente). Sem isso, arquivo escrito por um teste
   continua ali quando o próximo roda, e é redescoberto como se fosse dele —
   isso já aconteceu ao escrever `content-sync.test.ts` (5 dos 9 testes
   falharam por contagem errada até o `beforeEach` local entrar).

## `fileParallelism: false`

Todo arquivo de teste compartilha o mesmo Postgres de teste, e o `beforeEach`
global trunca as tabelas antes de cada teste. Rodar arquivos em paralelo faria
um arquivo apagar dados que outro acabou de inserir. Se a suíte crescer a
ponto de isso pesar no tempo de CI, a saída é um banco (ou schema) por
worker, não desligar essa flag.
