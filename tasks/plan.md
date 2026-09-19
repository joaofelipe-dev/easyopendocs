# Redesign do easyopendocs

Data: 2026-09-18.
Status: equipe formada; auditoria inicial de código concluída; implementação pendente.

## Objetivo e direção

Prioridade informada pelo usuário: redesign visual mais profundo, incluindo navegação e organização. A primeira rodada se concentra em encontrar, ler e manter a documentação existente. Novas funcionalidades de produto serão especificadas separadamente.

Direção proposta: portal editorial de conhecimento, com busca em destaque, navegação contextual compacta, superfícies discretas, hierarquia tipográfica clara e ações ordenadas pela frequência de uso. Manter português, temas claro/escuro e leitura confortável. A especificação `specs/001-redesign-neumorfico/` é histórico; a nova direção não exige reproduzir seu efeito de profundidade.

## Equipe e responsabilidades

| Agente | Responsabilidade | Propriedade na implementação |
| --- | --- | --- |
| `design_visual` | Tokens, contraste, hierarquia, densidade e estados visuais | `globals.css`, `brand-tokens.css` e primitivos de UI, em lotes pequenos |
| `usabilidade` | Navegação, busca, acessibilidade e prevenção de perda de trabalho | Cabeçalho, navegação contextual e depois formulários/editor |
| `qualidade_tecnica` | Revisão independente, regressões, testes e contratos | Verificação das entregas; não editar simultaneamente arquivos dos demais |
| Integrador principal | Direção de produto, páginas, integração e aceite | Layouts/páginas, ordem das entregas e consolidação das verificações |

Os três subagentes concluíram auditorias somente leitura. As responsabilidades acima organizam a próxima etapa; não significam que a implementação ou os testes já foram executados.

## Evidências iniciais

- Navegação de departamento precede o conteúdo em telas menores que `lg`; a lista admite até `60vh` (`src/app/(app)/departamentos/[slug]/layout.tsx`, `department-sidebar.tsx`).
- A barra de ações da leitura não permite quebra interna de linha; risco de transbordamento com todas as ações disponíveis (`src/app/(app)/departamentos/[slug]/[docSlug]/page.tsx`).
- O par de tokens neutros de texto secundário/fundo claro tem contraste calculado de aproximadamente 4,28:1; validar também as superfícies efetivamente renderizadas (`globals.css`).
- Marca e tema Tailwind definem nomes concorrentes `--color-primary` e `--color-secondary`; o efeito final exige inspeção do CSS compilado (`brand-tokens.css`, `globals.css`).
- Trocar modelo substitui o conteúdo do editor sem confirmação; sair não protege alterações pendentes (`document-editor.tsx`).
- Rótulo de conteúdo aponta a um campo oculto; erros não se associam aos campos por ARIA (`document-editor.tsx`, `rich-text-editor.tsx`).
- Busca limita a 50 resultados e apresenta a quantidade retornada sem explicitar o limite (`src/lib/search.ts`, `src/app/(app)/busca/page.tsx`).
- O sumário de leitura existe, mas fica oculto abaixo de `xl`; a melhoria é torná-lo acessível nessas larguras, não recriar essa funcionalidade.

Esses achados vêm de inspeção de código. Não houve teste visual ou de interação no navegador nesta rodada.

## Sequência

1. Consolidar tokens e contraste (T1); estabelecer a base visual antes de editar componentes compartilhados.
2. Reorganizar entrada e busca (T2) e navegação de departamento (T3).
3. Validar o percurso início → departamento → documento em desktop e mobile.
4. Refinar leitura/sumário (T4) e catálogo (T5).
5. Melhorar autoria e acessibilidade (T6), transparência da busca (T7) e navegação administrativa (T8).
6. Rodar validação integrada e registrar resultados (T9).

Depois de T1, T2 e T3 podem ser executadas em paralelo com propriedade exclusiva de arquivos. T4 e T5 também podem ser paralelas. T6 e T7 são independentes, mas T6 deve começar depois das mudanças nos controles compartilhados. Testes com banco são sempre seriais.

## Contratos preservados

- Autorização no servidor, incluindo diferenças entre leitor, editor, administrador de departamento e administrador geral.
- HTML em disco como fonte de conteúdo; sanitização, indexação e histórico existentes.
- Busca por GET e filtros compartilháveis por URL.
- Input `bodyHtml` fora de abas desmontáveis; publicação diretamente da prévia continua funcionando.
- Tiptap com renderização inicial compatível com SSR e sincronização de conteúdo sem ciclo de atualizações.
- Impressão legível, foco de teclado, movimento reduzido e ambos os temas.

Não há necessidade identificada de migration ou troca de biblioteca para o redesign.

## Verificação e riscos

Antes de escrever código, consultar os guias pertinentes em `node_modules/next/dist/docs/`, conforme `AGENTS.md`. Preservar alterações preexistentes em `.specify/scripts/bash/`, `.claude/worktrees/` e `.opencode/`.

Validar cada fluxo em 320, 768, 1024 e 1440 px, nos dois temas, por teclado e toque. Cobrir títulos longos, listas extensas, estados vazio/erro/pendente e diferentes permissões. Medir contraste nos pares renderizados. Testes Node existentes não comprovam a experiência no navegador.

Após integração, executar `npm run build`, `npm run typecheck`, `npm run lint` e `npm test`, na ordem documentada no projeto. Antes de `npm test`, definir e validar um caminho exclusivo de teste: o setup remove o banco indicado por `TEST_DATABASE_URL`. Não executar suites simultâneas sobre o mesmo banco.

## Funcionalidades futuras a definir

Favoritos, acesso recente e recuperação de rascunhos são candidatos, não escopo aprovado. Paginação de busca depende de definir o contrato e testar o recorte de acesso; a primeira correção pode apenas informar o limite atual com clareza.
