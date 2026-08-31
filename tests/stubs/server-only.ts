// Stub para rodar módulos com `import "server-only"` fora do Next.js.
//
// O pacote real (node_modules/server-only) lança incondicionalmente — ele
// conta com o bundler do Next trocá-lo por um módulo vazio nas compilações de
// servidor (é assim que a checagem funciona: o client bundle usa o real e
// quebra o build; o server bundle usa este vazio). O Vitest não faz essa
// troca sozinho, então replicamos aqui via alias (vitest.config.mts) — os
// módulos testados são genuinamente server-only; isto só reproduz o contexto
// em que eles já deveriam estar rodando.
export {};
