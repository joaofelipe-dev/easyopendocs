import { renderDocumentFile } from "@/lib/content";

/**
 * Toda pasta de departamento recebe este arquivo automaticamente (na criação
 * pelo admin e no seed), para que ninguém comece do zero sem saber como
 * publicar. Escrito para quem nunca usou o portal — sem jargão técnico.
 */
export const TUTORIAL_DOCUMENT_SLUG = "como-criar-documentacao";

const TUTORIAL_TITLE = "Como criar uma documentação";
const TUTORIAL_DESCRIPTION =
  "Passo a passo para publicar uma documentação neste departamento pelo portal";

const TUTORIAL_BODY = `<h1>${TUTORIAL_TITLE}</h1>
<p>Este guia mostra como publicar uma documentação neste departamento usando
só o portal — não é preciso saber HTML nem programação.</p>

<h2>Antes de começar</h2>
<p>Você precisa ter permissão de <strong>criação</strong> neste departamento.
Se o botão "Nova documentação" não aparecer para você, peça ao administrador
do portal para liberar seu acesso.</p>

<h2>Passo 1 — Abra "Nova documentação"</h2>
<p>Dentro deste departamento, clique no botão <strong>Nova documentação</strong>,
no topo da página.</p>

<h2>Passo 2 — Título e descrição</h2>
<ul>
  <li><strong>Título:</strong> nome claro e direto, como "Como pedir reembolso"
  ou "Política de home office".</li>
  <li><strong>Descrição</strong> (opcional): um resumo de uma linha, mostrado
  na listagem do departamento.</li>
</ul>

<h2>Passo 3 — Escreva o conteúdo</h2>
<p>Use a barra de ferramentas do editor para formatar o texto — não é
necessário escrever nenhum código:</p>
<ul>
  <li><strong>Negrito</strong>, <em>itálico</em>, sublinhado e tachado para
  destacar palavras.</li>
  <li>Subtítulos para organizar o texto em seções.</li>
  <li>Listas com marcadores ou numeradas.</li>
  <li>Links, imagens (por endereço) e tabelas.</li>
</ul>
<p>Você também pode colar texto direto do Word ou do Google Docs — a
formatação é mantida.</p>

<h2>Passo 4 — Confira a prévia final</h2>
<p>Clique na aba <strong>Prévia final</strong> para ver exatamente como a
documentação vai aparecer publicada, antes de confirmar.</p>

<h2>Passo 5 — Publique</h2>
<p>Clique em <strong>Publicar documentação</strong>. Ela aparece
imediatamente na listagem do departamento para quem tem acesso de leitura.</p>

<h2>Depois de publicar</h2>
<ul>
  <li>Para corrigir algo, abra a documentação e clique em <strong>Editar</strong>.</li>
  <li>Quem tem permissão de exclusão pode apagar a documentação pela mesma
  tela, se ela não fizer mais sentido.</li>
  <li>O endereço da documentação não muda depois de criada — só o título e o
  conteúdo podem ser atualizados.</li>
</ul>

<blockquote>Dúvidas sobre o portal ou sobre seu acesso? Fale com o
administrador.</blockquote>`;

export function buildTutorialDocument(): string {
  return renderDocumentFile({
    title: TUTORIAL_TITLE,
    description: TUTORIAL_DESCRIPTION,
    bodyHtml: TUTORIAL_BODY,
  });
}
