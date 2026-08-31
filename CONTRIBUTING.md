# Contribuindo

Issues e pull requests são bem-vindos.

A interface e a documentação estão em **português (pt-BR)**, que é o idioma do
projeto. Issues e PRs podem ser escritos em português ou inglês — o código e os
comentários seguem o padrão do que já está lá.

## Ambiente

Pré-requisitos: **Node.js 22.19+** e um **PostgreSQL 17** acessível.

```bash
cp .env.example .env
openssl rand -base64 32     # cole o resultado em NEXTAUTH_SECRET

npm run db:up               # sobe o Postgres do docker-compose na porta 5433
npm install
npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000
```

O [README](README.md#como-subir) tem o passo a passo completo, incluindo como
usar um Postgres nativo em vez do Docker.

## Antes de abrir um PR

Rode os mesmos comandos que o CI roda, **nesta ordem**:

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

> **Por que o `build` vem primeiro:** o `tsconfig.json` inclui
> `.next/types/**`, onde o Next gera os tipos `PageProps`/`LayoutProps` que as
> páginas usam. Em checkout limpo esses arquivos ainda não existem, então
> `tsc --noEmit` antes do build falha com `TS2304`.

Os testes precisam de um Postgres acessível em `TEST_DATABASE_URL` — o
`npm run db:up` sobe um, e `tests/global-setup.ts` cria o banco de teste
sozinho na primeira execução.

## Testes

A suíte é de **integração de verdade**: bate num Postgres real e num
`CONTENT_ROOT` temporário no disco. Banco, filesystem e sanitizador não são
mockados — só o limite de framework/identidade é.

Isso é deliberado, e o [`tests/README.md`](tests/README.md) explica o porquê,
o que fica de fora e como estender. Leia antes de adicionar teste novo.

Mudança de comportamento em `src/lib`, `src/actions` ou em qualquer coisa
apoiada no Prisma deve vir com teste.

## Estilo e escopo

- **Um assunto por PR.** É mais fácil revisar e reverter.
- Siga o que o código ao redor já faz — nomes, densidade de comentário, idioma.
  O projeto comenta o *porquê* de decisões não óbvias, não o *o quê* do código.
- Mensagens de commit em [Conventional
  Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`, `chore:`), como no histórico.
- Migrations do Prisma entram versionadas, junto do PR que precisa delas.

## Segurança

Não abra issue pública para falha de segurança — veja
[SECURITY.md](SECURITY.md).

## Licença

Ao contribuir, você concorda que sua contribuição será licenciada sob a
[MIT](LICENSE), a mesma licença do projeto.
