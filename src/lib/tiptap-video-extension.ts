import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Nó mínimo para vídeo embutido — o pacote @tiptap/extension-image não tem
 * equivalente para <video>. Espelha exatamente o par <video><source> que
 * `sanitizeDocumentHtml` permite (src/lib/sanitize.ts); mude os dois juntos.
 */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      type: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (element) => {
          const source = element.querySelector("source");
          return {
            src: source?.getAttribute("src") ?? element.getAttribute("src"),
            type: source?.getAttribute("type") ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, type } = HTMLAttributes as { src: string | null; type: string | null };
    return [
      "video",
      mergeAttributes({ controls: "controls", preload: "metadata" }),
      ["source", type ? { src, type } : { src }],
    ];
  },
});
