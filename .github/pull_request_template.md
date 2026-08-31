<!--
Obrigado pelo PR. Se ele fecha uma issue, escreva "Closes #123" abaixo.
-->

## O que muda

<!-- O comportamento, do ponto de vista de quem usa o portal. -->

## Por quê

<!-- O problema que motivou. Se há issue, referencie-a. -->

## Como testar

<!-- Os passos para ver a mudança funcionando, e com qual papel/permissão. -->

## Checklist

- [ ] `npm run build && npm run typecheck && npm run lint && npm test` passam
      localmente (o `build` precisa vir primeiro — ver
      [CONTRIBUTING.md](https://github.com/joaofelipe-dev/easyopendocs/blob/main/CONTRIBUTING.md))
- [ ] Mudança de comportamento em `src/lib`, `src/actions` ou em algo apoiado
      no Prisma vem com teste
- [ ] Migration do Prisma incluída, se o schema mudou
- [ ] README ou documentação atualizados, se o comportamento documentado mudou
- [ ] Nenhum dado real (credencial, IP interno, nome de pessoa, conteúdo de
      documentação de uma instalação) foi incluído
