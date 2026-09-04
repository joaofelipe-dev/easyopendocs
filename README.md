# easyopendocs

Portal de documentações técnicas para uso interno de uma organização,
organizado por departamento, com controle de acesso por papéis.
Autohospedado, sem dependência de serviço externo.

[![CI](https://github.com/joaofelipe-dev/easyopendocs/actions/workflows/ci.yml/badge.svg)](https://github.com/joaofelipe-dev/easyopendocs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A ideia central: **o filesystem é a fonte de verdade do conteúdo**. Cada
departamento é uma pasta, cada documentação é um arquivo `.html`. O Postgres é
um índice desses arquivos — é o que permite listar, permissionar e auditar sem
varrer disco a cada request.

```
content/departamentos/
├── engenharia/                  ← departamento
│   ├── _departamento.json       ← nome e descrição (opcional)
│   ├── _responsabilidades.json  ← mapa de responsabilidades (opcional)
│   ├── setup-ambiente.html      ← documentação
│   └── padroes-de-codigo.html
└── recursos-humanos/
    ├── onboarding.html
    └── politica-de-ferias.html
```

Coloque um `.html` numa dessas pastas — por git, FTP, `cp`, o que for — e ele
aparece no portal na próxima vez que alguém abrir a home ou o departamento.
Sem rebuild, sem cadastro manual.

---

## Stack

| Camada        | Escolha                                              |
| ------------- | ---------------------------------------------------- |
| Framework     | Next.js 16 (App Router, React 19, TypeScript estrito) |
| UI            | TailwindCSS v4 + shadcn/ui                            |
| Banco         | PostgreSQL 17 (via Docker Compose em dev, ou instância nativa em produção) |
| ORM           | Prisma 7 (driver adapter `@prisma/adapter-pg`)        |
| Autenticação  | NextAuth v5 (Auth.js), Credentials Provider + JWT     |
| Sanitização   | isomorphic-dompurify                                  |

---

## Como subir

Pré-requisitos: **Node.js 22.19+** e um **PostgreSQL 17** acessível (via Docker em
dev, ou uma instância nativa — em produção, por exemplo).

```bash
cp .env.example .env
# gere um segredo e cole em NEXTAUTH_SECRET:
openssl rand -base64 32

docker compose up -d --wait   # Postgres na porta 5433 do host
npm install                   # roda `prisma generate` no postinstall
npm run db:migrate            # aplica as migrations
npm run db:seed               # popula departamentos, papéis e usuários
npm run dev                   # http://localhost:3000
```

> **Sobre a porta:** o container expõe o Postgres na **5433** do host, não na
> 5432, para não conflitar com um Postgres instalado direto na máquina. Se
> mudar isso no `docker-compose.yml`, ajuste também a `DATABASE_URL`.

> **Docker sem sudo:** se `docker ps` der `permission denied`, rode
> `sudo usermod -aG docker $USER` e faça logout/login.

### Sem Docker (Postgres nativo)

O `docker-compose.yml` é só uma conveniência de desenvolvimento — a aplicação
não depende do Docker em nada. Para usar um Postgres já instalado na máquina
(local ou em outro servidor da rede), pule o `docker compose up` e aponte
`DATABASE_URL` direto para ele:

```bash
DATABASE_URL="postgresql://usuario:senha@host:5432/easyopendocs?schema=public"
```

Crie o banco (`CREATE DATABASE easyopendocs;`) antes de rodar as migrations.

### Deploy em produção (rede local)

```bash
npm install
npm run build
npm run db:deploy   # `prisma migrate deploy` — não interativo, seguro em produção
npm run db:seed     # só na primeira vez, para criar o super admin
npm run start        # next start -H 0.0.0.0 -p 5050 — escuta na rede, não só em localhost
```

- `NEXTAUTH_URL` precisa apontar para o IP/hostname real do servidor na rede,
  incluindo a porta (ex.: `http://portal.suaempresa.local:5050`), não
  `localhost`.
- Libere a porta **5050** no firewall da máquina para a rede local.
- `npm run start` roda em foreground; para manter o processo de pé após fechar
  o terminal ou reiniciar o servidor, use um gerenciador de processo (ex.:
  [PM2](https://pm2.keymetrics.io/): `pm2 start npm --name easyopendocs -- start`).
- Use `npm run db:deploy` em vez de `npm run db:migrate` em produção — o
  primeiro só aplica migrations já commitadas, sem prompts interativos.

### Usuários criados pelo seed

O seed cria os dois departamentos de exemplo (`engenharia`,
`recursos-humanos`) e um usuário por combinação de acesso que vale a pena
conseguir testar logo depois de instalar:

| Login               | Senha      | Acesso                                                    |
| ------------------- | ---------- | --------------------------------------------------------- |
| `admin@exemplo.com` | `admin123` | Super admin: todos os departamentos + `/admin`             |
| `ana@exemplo.com`   | `teste123` | **Editor** em Engenharia, **Viewer** em Recursos Humanos   |
| `bruno@exemplo.com` | `teste123` | **Department Admin** em Recursos Humanos                   |
| `carla@exemplo.com` | `teste123` | Nenhum papel — serve para testar a home vazia              |

O login não precisa ser um e-mail: qualquer identificador serve, e
`nome.sobrenome` é comum em portal interno. Os três usuários de exemplo entram
com troca de senha obrigatória no primeiro acesso; o super admin, não.

As credenciais do admin saem de `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env`, e a
dos demais de `SEED_USER_PASSWORD`. **Troque essas senhas antes de qualquer uso
real** — elas estão publicadas aqui, neste README.

Ao adotar o portal de verdade, o caminho normal é editar `EXAMPLE_DEPARTMENTS`
e `SEED_USERS` em [`prisma/seed.ts`](prisma/seed.ts) com os seus, ou esvaziar as
duas listas e criar tudo pela interface em `/admin`.

### Scripts

| Comando              | O que faz                                          |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento                        |
| `npm run build`      | Build de produção                                  |
| `npm run typecheck`  | `tsc --noEmit`                                     |
| `npm run lint`       | ESLint                                             |
| `npm test`           | Testes de integração (Vitest) — ver [`tests/README.md`](tests/README.md) |
| `npm run db:up`      | Sobe o Postgres e espera ficar saudável            |
| `npm run db:migrate` | `prisma migrate dev`                               |
| `npm run db:seed`    | Roda o seed (idempotente)                          |
| `npm run db:reset`   | **Apaga o banco** e reaplica migrations + seed     |
| `npm run db:studio`  | Prisma Studio                                      |

---

## Como adicionar uma documentação

### Pelo filesystem

1. Crie o arquivo em `content/departamentos/{departamento}/{slug}.html`.
   O nome do arquivo vira a URL: `setup-ambiente.html` →
   `/departamentos/engenharia/setup-ambiente`.
   Use apenas `a-z`, `0-9` e `-` — arquivos fora desse padrão são ignorados.
2. Comece com o front-matter e envolva o conteúdo em um `<article>`:

   ```html
   <!-- title: Como configurar o ambiente local -->
   <!-- description: Passo a passo para subir o projeto localmente -->
   <article>
     <h1>Como configurar o ambiente local</h1>
     <p>...</p>
   </article>
   ```

   O arquivo contém **só o conteúdo** — nada de `<html>`, `<head>`, `<style>`
   ou `<script>`. O layout, a tipografia e o índice lateral são do app.

3. Abra o portal. Pronto.

O padrão completo, com a lista de tags permitidas, está em
[`content/TEMPLATE.md`](content/TEMPLATE.md).

### Pela interface

Quem tem a permissão `document:create` no departamento vê o botão **Nova
documentação**. O editor é rico, com aba de prévia final (a prévia passa pelo
mesmo sanitizador da publicação). Ao salvar, o app grava o `.html` na pasta do
departamento no mesmo formato acima e indexa na hora — o resultado é
indistinguível de um arquivo colocado à mão.

### Mídia (imagens e vídeo)

Os botões de imagem e vídeo da barra de ferramentas fazem **upload de
arquivo**, não pedem URL. O arquivo é validado (PNG/JPEG/GIF/WEBP até 15 MB,
ou MP4/WEBM até 100 MB), gravado em
`content/departamentos/{departamento}/_media/` com um nome gerado
(`src/app/api/media/upload/route.ts`) e servido de volta por
`src/app/api/media/[deptSlug]/[filename]/route.ts` — essa rota reaplica a
mesma checagem de acesso por departamento das documentações, então mídia de um
departamento não vaza para quem não tem `document:read` nele.

Como `_media/` vive dentro de `content/departamentos/`, o script
`backup-content.ps1` já cobre as mídias sem configuração extra. O indexador do
filesystem (`content-sync.ts`) ignora essa pasta — ela não vira documento.

### Imprimir

Todo documento tem um botão **Imprimir** que abre o diálogo de impressão do
navegador com uma folha de estilo dedicada: cabeçalho, barra lateral,
breadcrumb e botões de ação somem, sobrando só o conteúdo. Vídeos embutidos
não têm como imprimir e são ocultados nessa visão.

## Busca

Há um campo de busca no cabeçalho (atalho `/`) e em cada departamento. A busca
cobre **título, descrição e conteúdo** das documentações — só as que o usuário
tem permissão de ler.

```
/busca?q=rotina+de+backup
/busca?q=backup&departamento=engenharia
```

- **Acento é opcional.** "manutencao" encontra "manutenção": a configuração de
  busca `pt_unaccent` (criada pela migration `add_document_search`) é a
  `portuguese` do Postgres com o dicionário `unaccent` na frente do
  radicalizador. A extensão `unaccent` é *trusted* desde o PG13, então a
  migration a cria sem precisar de superuser.
- **Aceita a sintaxe do `websearch_to_tsquery`:** `"frase exata"`, `-palavra`
  para excluir, `or` entre termos.
- **Ranking por peso:** acerto no título vale mais que na descrição, que vale
  mais que no corpo. Um documento chamado "Rotina de backup" fica acima de um
  que só cita backup de passagem.
- **O recorte de acesso vai no SQL**, não depois: o usuário nunca gasta o
  limite de resultados com documentos que não pode abrir, e um departamento em
  que ele não tem `document:read` não aparece nem no filtro.

### Como o índice é mantido

O índice é uma coluna `tsvector` em `Document`, preenchida **pelo sync** — o
mesmo que já lê o arquivo do disco. Só documento que mudou é reprocessado; o
texto indexado é o que sobra depois do sanitizador, então conteúdo que não é
exibido também não é encontrável.

Não há passo manual de indexação, nem depois de atualizar um portal que já
estava rodando: cada documento carrega a versão do indexador que o gerou
(`searchVersion`), e o sync reprocessa sozinho o que ficou para trás. Trocar
como o vetor é montado é uma questão de incrementar `SEARCH_INDEX_VERSION` em
[`src/lib/search-index.ts`](src/lib/search-index.ts) — a reindexação acontece no
próximo sync, sem `?force=1`.

---

## Como criar um departamento

**Pelo filesystem:** crie a pasta `content/departamentos/{slug}/`. O nome exibido
sai do slug humanizado (`recursos-humanos` → "Recursos Humanos"); para controlá-lo,
adicione um `_departamento.json`:

```json
{
  "name": "Recursos Humanos",
  "description": "Políticas, benefícios e processos de pessoas"
}
```

**Pela interface:** `/admin/departamentos` → **Novo departamento**. Cria a pasta
e o `_departamento.json` no disco.

Em ambos os casos, o departamento nasce **sem nenhum membro** — atribua papéis
em `/admin/usuarios` para que alguém o enxergue.

---

## Responsabilidades do departamento

Além das documentações, cada departamento pode mapear suas
**responsabilidades**: o que ele faz, agrupado em frentes, e quais
documentações cobrem cada uma. Não é organograma — não descreve hierarquia de
pessoas, e sim o que o departamento entrega.

Fica em `content/departamentos/{departamento}/_responsabilidades.json`, ao lado
do `_departamento.json`. Como todo arquivo prefixado com `_`, fica fora do
indexador: nunca vira um documento.

```json
{
  "areas": [
    {
      "id": "infraestrutura",
      "title": "Infraestrutura",
      "items": [
        {
          "id": "backup-e-restore",
          "title": "Backup e restore",
          "description": "Rotina diária, teste de restore e retenção.",
          "owner": "Ana",
          "docs": ["rotina-de-backup"],
          "deliversTo": []
        }
      ]
    }
  ]
}
```

`docs` são slugs de documentações **do próprio departamento** — é o que liga o
mapa ao conteúdo. Disso o portal tira duas informações que antes não existiam
em lugar nenhum:

- **responsabilidade sem documentação** — o total aparece no topo da tela e o
  bloco correspondente fica marcado;
- **vínculo quebrado** — um slug que não existe mais aparece em vermelho e
  **não** é apagado, na mesma lógica dos órfãos do sync: se o arquivo voltar
  para a pasta, o vínculo volta com ele.

**Pela interface:** `/departamentos/{departamento}/responsabilidades`. Quem tem
`department:manage` monta o mapa por formulário (vincular documentação é uma
lista de seleção, não digitar slug); quem tem `document:read` só visualiza. Há
botão de impressão, com folha de estilo própria.

**Pelo filesystem:** escreva o `_responsabilidades.json` à mão — é equivalente.
O `id` pode ser omitido (é gerado a partir do título na primeira gravação pela
tela). Se o JSON estiver inválido, a tela avisa e **o editor fica bloqueado**:
abri-lo mostraria uma lista vazia, e salvar por cima apagaria o que está no
arquivo.

### O diagrama, depois

A tela de hoje é uma lista de blocos agrupados por frente. O passo seguinte
previsto é o **diagrama**: as mesmas responsabilidades desenhadas com setas
entre si, mostrando quem entrega para quem.

O campo `deliversTo` (ids de outras responsabilidades) já é validado, gravado e
preservado em todas as edições — só não é usado em lugar nenhum ainda.
Referências que apontam para um bloco excluído são descartadas ao salvar. Quem
quiser adiantar pode preenchê-lo à mão desde já: quando o diagrama existir,
nenhum mapa vai precisar ser remontado.

O slug `diagrama` já está reservado em `src/actions/documents.ts` para essa
rota futura, então nenhuma documentação pode ocupá-lo no meio do caminho.

---

## Permissionamento

Um usuário pode ter **vários papéis, em vários departamentos, ao mesmo tempo**.
Dentro de um departamento, as permissões dos papéis se somam.

**Permissões:** `document:read`, `document:create`, `document:edit`,
`department:manage`.

**Papéis padrão:**

| Papel              | Permissões                                                 |
| ------------------ | ---------------------------------------------------------- |
| `Viewer`           | `document:read`                                            |
| `Editor`           | `document:read`, `document:create`, `document:edit`         |
| `Department Admin` | as três acima + `department:manage`                        |

Papéis e permissões são editáveis em `/admin/papeis`. Uma permissão nova só tem
efeito quando o código passar a verificá-la.

`isSuperAdmin` é ortogonal aos papéis: quem tem essa flag enxerga todos os
departamentos e a área `/admin`, independentemente de atribuições.

### Onde a autorização acontece

Toda decisão de acesso é **server-side**, em `src/lib/rbac.ts`, e **relê o banco
a cada request**. O JWT de sessão carrega apenas um snapshot para a UI —
desativar um usuário ou remover um papel vale no request seguinte, sem esperar o
token expirar.

O `src/proxy.ts` (o antigo `middleware.ts`, renomeado no Next 16) faz só a
checagem otimista de "existe cookie de sessão?", para mandar visitante anônimo
ao login sem tocar no banco. Ele **não** é a fonte de verdade.

---

## Sincronização

O indexador (`src/lib/content-sync.ts`) roda automaticamente ao carregar a home
e a página de um departamento, e pode ser disparado por:

- `POST /api/sync` — sync incremental (qualquer usuário autenticado)
- `POST /api/sync?force=1` — relê todos os arquivos (só super admin)
- `/admin/sync` — os dois botões acima, mais o histórico e a lista de órfãos

**Incremental:** compara `mtime` + tamanho; só se mudarem, lê o arquivo e
compara o hash SHA-256. Um `touch` sem alteração de conteúdo não reprocessa
nada. Chamadas concorrentes são colapsadas em uma única varredura, e há um
throttle de 3 s (`SYNC_THROTTLE_MS`) entre syncs automáticos.

**Nada é apagado.** Arquivo ou pasta que some do disco vira **órfão**: sai da
listagem mas mantém o registro e as permissões. Se voltar com o mesmo nome,
volta com tudo. Órfãos ficam visíveis em `/admin/sync`, e o registro de um
departamento órfão pode ser descartado manualmente em `/admin/departamentos`.

Departamentos ativos não podem ser excluídos pela UI — isso apagaria
documentação real. Remova a pasta pelo filesystem e descarte o registro depois.

---

## Segurança do conteúdo

O HTML das documentações é conteúdo controlado por usuário, então:

- passa por DOMPurify com allowlist de tags e atributos antes de qualquer
  renderização (`src/lib/sanitize.ts`);
- `<script>`, `<style>`, `<iframe>`, `<form>`, atributos `on*`, `style=` inline e
  URLs `javascript:` são removidos;
- docs criadas pela UI são gravadas **já sanitizadas**, então o arquivo no disco
  é igual ao que é renderizado;
- slugs de departamento e documento são validados contra
  `^[a-z0-9]+(?:-[a-z0-9]+)*$` antes de virar caminho de arquivo — é isso que
  impede path traversal (`src/lib/content.ts`).

---

## Testes

```bash
npm test          # roda uma vez
npm run test:watch
```

Testes de integração/funcionais (Vitest): batem num Postgres de teste real
(`TEST_DATABASE_URL`, mesma instância do docker-compose, banco
`easyopendocs_test`) e num `CONTENT_ROOT` temporário — nada de banco, disco ou
sanitizador mockado. Cobrem RBAC, sanitização, o indexador filesystem→Postgres
e uma server action completa fim a fim. Detalhes, o que fica de fora (E2E de
navegador é uma fase futura) e como estender: [`tests/README.md`](tests/README.md).

---

## Backup

Há dois ativos com estado que precisam de backup — nenhum dos dois é
reconstruível a partir do outro:

1. **Banco Postgres** — usuários, senhas, papéis/permissões (RBAC), atribuições
   usuário↔departamento e metadados de documento (autor, hash, histórico).
2. **`content/departamentos/`** — o HTML de cada documentação e o
   `_responsabilidades.json` de cada departamento, a fonte de verdade do
   conteúdo.

(Imagens e vídeos enviados pelo editor ficam em
`content/departamentos/{departamento}/_media/` — dentro da mesma árvore do
item 2, então já saem cobertos por `backup-content.ps1` sem um terceiro
script.)

Scripts prontos em [`scripts/`](scripts/), para rodar no servidor (Windows)
via **Task Scheduler**, diariamente:

| Script                     | O que faz                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `backup-db.ps1`            | `pg_dump -Fc` do banco + rotação (14 dias + 1 por mês por 12 meses) |
| `backup-content.ps1`       | Zip de `content/departamentos/` + a mesma rotação                  |
| `backup-offsite.ps1`       | Espelha os backups locais para um destino fora do servidor (robocopy) |

Rode os três em sequência, no mesmo agendamento (ex.: 2h da manhã). Os
parâmetros (caminho do `pg_dump.exe`, credenciais, diretórios de destino)
são passados via flags do PowerShell — veja o cabeçalho de cada script.

**Credenciais do Postgres:** não passe a senha na linha de comando. Configure
`%APPDATA%\postgresql\pgpass.conf` no usuário que roda a task, no formato
`host:porta:database:usuario:senha`.

**`.env` de produção:** guarde uma cópia separada (fora do Git, num cofre de
senhas ou pasta protegida) para conseguir reconstruir o servidor do zero. Não
precisa de rotina automática — só de não estar em lugar nenhum além do
servidor.

**Teste de restore:** um backup nunca testado é só uma esperança. Pelo menos
uma vez após configurar (e depois periodicamente):

```powershell
pg_restore -d easyopendocs_test easyopendocs_2026-01-01_0200.dump
```

e suba o app apontando `DATABASE_URL` pro banco de teste e `CONTENT_ROOT` pra
uma cópia extraída do zip de conteúdo, confirmando que o portal carrega
normalmente.

---

## CI

[`ci.yml`](.github/workflows/ci.yml) roda em runner hospedado pelo GitHub, em
todo push/PR para `main`, em dois jobs paralelos:

- **build** — `typecheck`, `lint` e `build`, para pegar erro de tipo ou import
  antes de qualquer deploy;
- **test** — a suíte do Vitest contra um Postgres real subido como service
  container do próprio runner (ver [`tests/README.md`](tests/README.md) para o
  porquê de não mockar banco nem disco).

### Sobre deploy

Não há workflow de deploy neste repositório, de propósito: como o portal é
autohospedado, o destino muda demais entre instalações para um workflow
genérico servir. Os comandos estão na seção
[Deploy em produção](#deploy-em-produção-rede-local) acima e cabem em qualquer
mecanismo — `ssh` num script, Ansible, ou um workflow seu.

Um detalhe que vale para o caso comum de servidor **sem IP público** (o portal
só existe na rede interna): o GitHub não consegue se conectar nele, mas um
**runner self-hosted do GitHub Actions instalado no próprio servidor** resolve
— ele puxa trabalho do GitHub em vez de esperar conexão de entrada, então
funciona sem abrir porta nenhuma no firewall. Um workflow com
`runs-on: [self-hosted]` e `on: workflow_dispatch` disparado à mão dá um
deploy por botão sem expor o servidor.

---

## Variáveis de ambiente

| Variável             | Obrigatória | Descrição                                                    |
| -------------------- | ----------- | ------------------------------------------------------------ |
| `DATABASE_URL`       | sim         | Conexão do Postgres                                          |
| `TEST_DATABASE_URL`  | só p/ testes | Conexão do banco de teste (`npm test`) — [`tests/README.md`](tests/README.md) |
| `NEXTAUTH_SECRET`    | sim         | Segredo de assinatura dos JWTs                               |
| `NEXTAUTH_URL`       | sim         | URL base da aplicação                                        |
| `CONTENT_ROOT`       | não         | Raiz das documentações (padrão `content/departamentos`)       |
| `SYNC_THROTTLE_MS`   | não         | Janela entre syncs automáticos (padrão `3000`)               |
| `ADMIN_NAME`         | não         | Nome do super admin do seed                                  |
| `ADMIN_EMAIL`        | não         | E-mail do super admin do seed                                |
| `ADMIN_PASSWORD`     | não         | Senha do super admin do seed (padrão `admin123`)             |
| `SEED_USER_PASSWORD` | não         | Senha dos usuários de exemplo do seed (padrão `teste123`)    |
| `DEV_ALLOWED_ORIGINS`| não         | Origens extras do `next dev`, separadas por vírgula — só se você acessa o dev server por outro host da rede |

---

## Estrutura

```
easyopendocs/
├── docker-compose.yml
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── prisma.config.ts              # Prisma 7: URL e comando de seed ficam aqui
├── content/
│   ├── TEMPLATE.md               # o padrão dos arquivos .html
│   └── departamentos/
└── src/
    ├── app/
    │   ├── (auth)/login/
    │   ├── (app)/page.tsx                                  # home
    │   ├── (app)/busca/                                     # busca full-text
    │   ├── (app)/sem-acesso/
    │   ├── (app)/departamentos/[slug]/                     # layout + sidebar
    │   ├── (app)/departamentos/[slug]/responsabilidades/   # mapa + edição
    │   ├── (app)/departamentos/[slug]/[docSlug]/           # doc + edição
    │   ├── (app)/departamentos/[slug]/nova-documentacao/
    │   ├── (app)/admin/                                    # usuários, deps, papéis, sync
    │   └── api/{auth,sync,media}/                          # media = upload + serving de imagem/vídeo
    ├── actions/                  # server actions
    ├── components/ui/            # shadcn
    ├── lib/
    │   ├── auth.ts               # NextAuth
    │   ├── prisma.ts
    │   ├── rbac.ts               # autorização server-side
    │   ├── permissions.ts        # catálogo compartilhado com o seed
    │   ├── content.ts            # slugs, caminhos, front-matter, template
    │   ├── content-sync.ts       # indexador filesystem -> Postgres
    │   ├── search.ts             # consulta da busca (respeita o RBAC)
    │   ├── search-index.ts       # escrita do índice — quem chama é o sync
    │   ├── department-responsibilities.ts       # schema e regras do mapa
    │   ├── department-responsibilities-file.ts  # leitura/escrita do JSON
    │   ├── document-render.ts    # sanitização + âncoras + índice
    │   ├── rbac-seed.ts          # fixtures de RBAC — seed.ts E os testes usam
    │   ├── sanitize.ts
    │   └── tiptap-video-extension.ts  # nó de vídeo do editor
    └── proxy.ts                  # ex-middleware.ts
tests/
├── README.md                  # o que cobre, como rodar, as pegadinhas já vividas
├── global-setup.ts            # cria o banco de teste + migrations, uma vez
├── setup.ts                   # tmpdir de CONTENT_ROOT + truncate por teste
├── helpers/db.ts               # resetDatabase() + fixtures de rbac-seed.ts
├── stubs/server-only.ts       # alias p/ importar módulos "server-only" fora do Next
├── lib/                       # sanitize, rbac, content-sync, search, department-responsibilities
└── actions/                   # server actions fim a fim
```

---

## Notas de implementação

- **Prisma 7** exige driver adapter (`@prisma/adapter-pg`) e a connection string
  vive em `prisma.config.ts`, não no `schema.prisma`. O client é gerado em
  `src/generated/prisma/` e não é versionado — `npm install` regenera.
- **Next 16** renomeou `middleware.ts` para `proxy.ts`, e `params`/`searchParams`
  são `Promise`.
- **Node 22.19+** não é preferência, é requisito: o `isomorphic-dompurify`
  puxa `jsdom` → `undici@8`, que usa `webidl.util.markAsUncloneable`, uma API
  que só existe a partir do Node 22.19. Em Node 20 o `npm ci` só emite um aviso
  `EBADENGINE`, e a quebra aparece bem depois, no `next build`, como
  `TypeError: webidl.util.markAsUncloneable is not a function` ao coletar dados
  de página. O `engines` do `package.json` declara isso para o npm avisar cedo.
- **O seed roda com `--conditions=react-server`** (`prisma.config.ts`). O
  pacote `server-only` só é neutralizado por essa condição de resolução, que o
  bundler do Next aplica sozinho nas compilações de servidor mas o `tsx` não —
  e desde a busca o sync alcança o sanitizador, que é `server-only`. Os testes
  resolvem o mesmo problema por um alias (`tests/stubs/server-only.ts`).
- `forbidden()` do Next exige a flag experimental `authInterrupts`; para não
  depender dela num caminho de autorização, o app redireciona para `/sem-acesso`.

---

## Contribuindo

Issues e pull requests são bem-vindos. Antes de abrir um PR, rode os mesmos
comandos que o CI roda, **nesta ordem**:

```bash
npm run build      # precisa vir antes do typecheck
npm run typecheck
npm run lint
npm test
```

O `build` vem primeiro porque o `tsconfig.json` inclui `.next/types/**`, onde o
Next gera os tipos `PageProps`/`LayoutProps` que as páginas usam: em checkout
limpo esses arquivos ainda não existem e o `tsc --noEmit` falha com `TS2304`.
Os testes precisam de um Postgres acessível em `TEST_DATABASE_URL` —
`npm run db:up` sobe um.

O resto — estilo, escopo de PR, convenção de commit — está em
[CONTRIBUTING.md](CONTRIBUTING.md).

Para falha de segurança, não abra issue pública: veja [SECURITY.md](SECURITY.md).

## Licença

[MIT](LICENSE).
