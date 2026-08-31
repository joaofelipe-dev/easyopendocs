import { describe, expect, it } from "vitest";

import { htmlToPlainText, sanitizeDocumentHtml } from "@/lib/sanitize";

/**
 * O front-matter é conteúdo controlado por usuário (arquivo no disco ou
 * editor da UI), injetado com dangerouslySetInnerHTML — ver o comentário em
 * src/lib/sanitize.ts. Cada caso aqui é uma forma real de fuga de sandbox,
 * não uma paráfrase da allowlist: se um teste passasse simplesmente por
 * repetir ALLOWED_TAGS/FORBID_TAGS de volta, ele não provaria nada sobre o
 * DOMPurify em si.
 */
describe("sanitizeDocumentHtml", () => {
  it("remove <script>, mantendo o texto ao redor", () => {
    const html = sanitizeDocumentHtml(
      '<p>antes</p><script>alert("x")</script><p>depois</p>',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
    expect(html).toContain("antes");
    expect(html).toContain("depois");
  });

  it("remove <iframe>, <style>, <form> e <input>", () => {
    const html = sanitizeDocumentHtml(
      '<iframe src="https://evil.example"></iframe>' +
        "<style>body{display:none}</style>" +
        '<form action="/x"><input name="y"></form>',
    );

    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });

  it("remove atributos on* mesmo em tags permitidas", () => {
    const html = sanitizeDocumentHtml('<p onclick="alert(1)">clique</p>');

    expect(html).not.toContain("onclick");
    expect(html).toContain("clique");
  });

  it("remove style= inline e o atributo srcset", () => {
    const html = sanitizeDocumentHtml(
      '<p style="display:none">x</p><img src="a.png" srcset="a.png 1x, b.png 2x">',
    );

    expect(html).not.toContain("style=");
    expect(html).not.toContain("srcset");
  });

  it("bloqueia href javascript: mas preserva https:// e mailto:", () => {
    const html = sanitizeDocumentHtml(
      '<a href="javascript:alert(1)">a</a>' +
        '<a href="https://exemplo.com">b</a>' +
        '<a href="mailto:x@exemplo.com">c</a>',
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://exemplo.com"');
    expect(html).toContain('href="mailto:x@exemplo.com"');
  });

  it("preserva <video><source>, o par que o editor de vídeo gera", () => {
    // Espelha tiptap-video-extension.ts: se esse par parar de passar aqui,
    // todo vídeo já publicado em produção desaparece silenciosamente.
    const html = sanitizeDocumentHtml(
      '<video controls preload="metadata"><source src="/api/media/ti/a.mp4" type="video/mp4"></video>',
    );

    expect(html).toContain("<video");
    expect(html).toContain("<source");
    expect(html).toContain('src="/api/media/ti/a.mp4"');
    expect(html).toContain('type="video/mp4"');
  });

  it("libera data:image;base64 mas não data: genérico", () => {
    const pngDataUri = "data:image/png;base64,iVBORw0KGgo=";
    const withImage = sanitizeDocumentHtml(`<img src="${pngDataUri}">`);
    expect(withImage).toContain(pngDataUri);

    const withGenericData = sanitizeDocumentHtml(
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    );
    expect(withGenericData).not.toContain("data:text/html");
  });

  it("preserva tabela, listas e código — vocabulário normal de documentação", () => {
    const html = sanitizeDocumentHtml(
      "<table><thead><tr><th>a</th></tr></thead>" +
        "<tbody><tr><td>1</td></tr></tbody></table>" +
        "<ul><li>item</li></ul>" +
        "<pre><code>const x = 1;</code></pre>",
    );

    expect(html).toContain("<table");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<li>item</li>");
    expect(html).toContain("<pre><code>const x = 1;</code></pre>");
  });
});

describe("htmlToPlainText", () => {
  it("remove toda marcação e normaliza espaços", () => {
    const text = htmlToPlainText("<p>Olá   <strong>mundo</strong></p>\n<p>!</p>");
    expect(text).toBe("Olá mundo !");
  });

  it("corta no tamanho máximo com reticências", () => {
    const text = htmlToPlainText(`<p>${"a".repeat(300)}</p>`, 10);
    expect(text).toHaveLength(10);
    expect(text.endsWith("…")).toBe(true);
  });

  it("descarta o conteúdo de <script> inteiro, não só a tag", () => {
    // Diferença real de comportamento: uma tag proibida qualquer preserva o
    // texto de dentro (é o "KEEP_CONTENT: true" do sanitizeDocumentHtml); um
    // <script> não — o DOMPurify trata como elemento especial e descarta a
    // tag E o conteúdo. Uma prévia de listagem não pode vazar o corpo de um
    // script que nunca deveria ter sido salvo.
    const text = htmlToPlainText("<p>antes</p><script>alert(1)</script><p>depois</p>");

    // Sem espaço entre as palavras: não há whitespace nenhum na entrada, e
    // remover tags não insere separador — só o próprio conteúdo do script
    // some por completo.
    expect(text).toBe("antesdepois");
    expect(text).not.toContain("alert");
  });
});
