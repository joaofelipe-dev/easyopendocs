# Política de segurança

## Versões suportadas

O projeto ainda não tem releases versionadas. Correções de segurança são
aplicadas na `main`, e é dela que sai qualquer instalação recomendada.

## Reportando uma falha

**Não abra uma issue pública** para relatar falha de segurança.

Use o canal privado do GitHub: aba **Security** deste repositório →
**Report a vulnerability**. Isso abre um advisory privado, visível só para os
mantenedores, onde dá para discutir e corrigir antes de qualquer divulgação.

O que ajuda no relato:

- o que a falha permite fazer (ler dado de outro departamento, escalar
  privilégio, executar código, etc.);
- passos para reproduzir, e o papel/permissão necessários para chegar lá;
- versão ou commit em que você observou;
- impacto que você enxerga, se houver.

Retorno em até **7 dias**. É um projeto mantido por uma pessoa em tempo
parcial, então não há SLA além disso — mas relatos são levados a sério e você
recebe crédito no advisory, salvo se preferir o contrário.

## Escopo

Interessa especialmente qualquer coisa que quebre estes limites:

- **Isolamento entre departamentos** — acessar documentação, mídia ou o mapa de
  responsabilidades de um departamento sem ter `document:read` nele. Inclui a
  rota de mídia (`/api/media/...`), que reaplica a checagem por conta própria.
- **Autorização** — obter permissão que os papéis atribuídos não dão, ou manter
  acesso depois de ter o papel removido ou o usuário desativado. A decisão é
  server-side em `src/lib/rbac.ts` e relê o banco a cada request; o JWT carrega
  só um snapshot para a UI.
- **Path traversal** — fazer um slug de departamento ou documento escapar do
  `CONTENT_ROOT` e ler ou escrever fora dele (`src/lib/content.ts`).
- **XSS pelo conteúdo** — HTML de documentação que sobreviva ao DOMPurify
  (`src/lib/sanitize.ts`) e execute script no navegador de quem lê.
- **Upload de mídia** — burlar a validação de tipo/tamanho, ou gravar arquivo
  fora da pasta `_media/` do departamento.

## Fora de escopo

- Falta de rate limiting no login.
- As credenciais padrão do seed (`admin123` / `teste123`). São documentadas
  como exemplo e o README avisa, em negrito, para trocá-las — quem sobe em
  produção sem trocar é uma falha de operação, não do código.
- Ausência de HTTPS. O portal é pensado para rede interna; terminar TLS é
  responsabilidade de quem hospeda.
- Achados de scanner automático sem impacto demonstrado.
