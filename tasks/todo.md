# Tarefas de redesign

- [x] Formar subagentes de design visual, usabilidade e qualidade técnica.
- [x] Auditar o código e identificar prioridades.
- [x] Registrar a preferência por redesign profundo de visual, navegação e organização.
- [ ] Implementar e validar as entregas abaixo.

## T1 — Base visual e contraste

Responsável: `design_visual`. Dependências: nenhuma. Porte: pequeno.
Arquivos: `src/app/globals.css`, `src/app/brand-tokens.css`.

- [ ] Separar tokens de marca dos tokens semânticos sem definições concorrentes.
- [ ] Definir superfícies e texto secundário com contraste mínimo de 4,5:1 para texto normal em ambos os temas.
- [ ] Preservar impressão e movimento reduzido.

Verificação: build e inspeção do CSS compilado; medir contraste e comparar telas reais nos dois temas.

## T2 — Entrada e busca global

Responsáveis: integrador e `usabilidade`, com edição coordenada. Depende de T1. Porte: médio.
Arquivos: `src/components/app-header.tsx`, `src/components/search-box.tsx`, `src/app/(app)/page.tsx`.

- [ ] Tornar busca e acesso a departamentos as ações centrais da entrada, com hierarquia visual clara.
- [ ] Manter controles de conta/admin identificáveis e sem transbordamento em 320 px.
- [ ] Definir um destino inequívoco para o atalho `/` quando houver múltiplas buscas, preservando digitação em formulários.

Verificação: home com zero e vários departamentos, busca por GET, teclado e perfis com/sem administração; build/typecheck/lint.

## T3 — Navegação contextual responsiva

Responsável: `usabilidade`; integrador cuida do layout. Depende de T1. Porte: médio.
Arquivos: `src/components/department-sidebar.tsx`, `src/app/(app)/departamentos/[slug]/layout.tsx`; um componente de navegação mobile se necessário.

- [ ] Oferecer painel recolhível no mobile e navegação persistente no desktop.
- [ ] Permitir chegar ao título do conteúdo sem atravessar uma lista longa.
- [ ] Preservar indicação de localização, permissões, fechamento por teclado e retorno de foco.

Verificação: 320/768/1024/1440 px, lista longa, teclado, leitor/editor/admin e abertura direta de documento.

## Checkpoint A

- [ ] Percurso início → departamento → leitura utilizável nos dois temas e sem overflow da página.
- [ ] Revisão visual e técnica de T1–T3 registrada antes de expandir o redesign.

## T4 — Leitura, ações e sumário

Responsável: integrador; revisão de `design_visual`. Depende de T3. Porte: médio.
Arquivos: `src/app/(app)/departamentos/[slug]/[docSlug]/page.tsx`; até dois componentes extraídos para ações/sumário se necessário.

- [ ] Organizar título/metadados e dar prioridade à leitura; manter editar acessível conforme permissão.
- [ ] Agrupar ações secundárias, preservando confirmação e autorização de exclusão.
- [ ] Disponibilizar o sumário em telas menores sem ocupar todo o início do artigo.

Verificação: artigo longo, todas as ações habilitadas, âncoras abaixo do cabeçalho fixo, impressão e teclado.

## T5 — Catálogo de documentos

Responsável: integrador; orientação de `design_visual`. Depende de T1 e T3. Porte: pequeno.
Arquivos: `src/app/(app)/departamentos/[slug]/page.tsx`.

- [ ] Organizar documentos em linhas escaneáveis com título, resumo e estado de revisão.
- [ ] Aproximar busca e ações do catálogo, respeitando permissões.
- [ ] Acomodar títulos extensos, 30 documentos e estado vazio em mobile/desktop.

Verificação: inspeção visual com conteúdo realista e navegação por teclado; build/typecheck/lint.

## T6 — Autoria com proteção e acessibilidade

Responsável: `usabilidade`; revisão de `qualidade_tecnica`. Depende de T1. Porte: médio.
Arquivos: `src/components/document-editor.tsx`, `src/components/rich-text-editor.tsx`; até dois auxiliares/testes se necessários.

- [ ] Confirmar substituição por modelo e descarte de conteúdo alterado, com cancelamento preservando o texto.
- [ ] Associar nome, foco visível e mensagens de erro aos controles corretos; focar o primeiro erro.
- [ ] Preservar publicação pela prévia, metadados e upload de mídia.

Verificação: editar → trocar modelo → cancelar; sair/cancelar/fechar com e sem alterações; salvar diretamente da prévia; falha de validação e rede. Documentar limites da proteção de navegação adotada.

## T7 — Busca com escopo e limite claros

Responsável: integrador; revisão de `usabilidade`. Depende de T2. Porte: pequeno.
Arquivos: `src/app/(app)/busca/page.tsx`, `src/lib/search.ts` somente se necessário para compartilhar o limite.

- [ ] Comunicar escopo ativo e quantidade exibida sem sugerir total completo quando a consulta está limitada.
- [ ] Oferecer saída clara do filtro e orientação quando não houver resultados.
- [ ] Preservar URLs compartilháveis e recorte por permissão.

Verificação: buscas vazia/sem resultados/com filtro e conjunto superior a 50 correspondências; suíte existente de busca se houver alteração de lógica. Paginação completa é uma tarefa futura separada.

## T8 — Organização da administração

Responsável: integrador; revisão de `design_visual` e `usabilidade`. Depende de T1. Porte: pequeno.
Arquivos: `src/components/admin/admin-nav.tsx`, `src/app/(app)/admin/layout.tsx`, `src/app/(app)/admin/page.tsx`.

- [ ] Distinguir visão geral, saúde de conteúdo e gestão de acesso por hierarquia de navegação.
- [ ] Manter seção atual evidente e todas as seções acessíveis no mobile.
- [ ] Preservar as restrições de acesso administrativas.

Verificação: percorrer todas as seções por teclado, dois temas, mobile/desktop e tentativa de acesso por usuário não administrador.

## T9 — Verificação integrada

Responsável: `qualidade_tecnica`; integrador executa/completa correções. Depende de T2–T8.

- [ ] Executar build → typecheck → lint → testes com banco exclusivo e validado, serialmente.
- [ ] Verificar os fluxos no navegador em 320/768/1024/1440 px, claro/escuro, teclado, impressão e movimento reduzido.
- [ ] Registrar evidências, limitações e regressões corrigidas; não marcar inspeção de código como teste visual.

Nenhum dos gates de implementação foi executado nesta etapa de organização e auditoria.
