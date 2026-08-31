"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Table as TableIcon,
  Minus,
  Undo2,
  Redo2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Video } from "@/lib/tiptap-video-extension";

/**
 * Extensões limitadas de propósito ao que `sanitizeDocumentHtml` permite
 * (src/lib/sanitize.ts). Se algo for adicionado aqui, adicione lá também —
 * senão o autor edita um elemento que desaparece silenciosamente ao publicar.
 */
function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  );
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/webm";

function Toolbar({ editor, departmentSlug }: { editor: Editor; departmentSlug: string }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link (https://…)", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  // Upload real, não URL — o arquivo é gravado em
  // content/departamentos/{dept}/_media/ (src/app/api/media/upload/route.ts)
  // e servido de volta por src/app/api/media/[deptSlug]/[filename]/route.ts.
  const uploadFile = async (file: File): Promise<{ url: string; type: string } | null> => {
    const formData = new FormData();
    formData.append("departmentSlug", departmentSlug);
    formData.append("file", file);

    try {
      const response = await fetch("/api/media/upload", { method: "POST", body: formData });
      const body = (await response.json().catch(() => null)) as
        | { url?: string; type?: string; error?: string }
        | null;

      if (!response.ok || !body?.url) {
        toast.error(body?.error ?? "Não foi possível enviar o arquivo.");
        return null;
      }
      return { url: body.url, type: body.type ?? file.type };
    } catch {
      toast.error("Não foi possível enviar o arquivo. Verifique sua conexão.");
      return null;
    }
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading("image");
    const result = await uploadFile(file);
    setUploading(null);
    if (result) editor.chain().focus().setImage({ src: result.url }).run();
  };

  const handleVideoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading("video");
    const result = await uploadFile(file);
    setUploading(null);
    if (result) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "video", attrs: { src: result.url, type: result.type } })
        .run();
    }
  };

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 p-1.5">
      <ToolbarButton
        label="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Sublinhado"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Subtítulo grande"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subtítulo médio"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subtítulo pequeno"
        active={editor.isActive("heading", { level: 4 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Lista com marcadores"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Citação"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Código"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Imagem"
        disabled={uploading !== null}
        onClick={() => imageInputRef.current?.click()}
      >
        {uploading === "image" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImageIcon className="size-4" />
        )}
      </ToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleImageSelected}
      />
      <ToolbarButton
        label="Vídeo"
        disabled={uploading !== null}
        onClick={() => videoInputRef.current?.click()}
      >
        {uploading === "video" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <VideoIcon className="size-4" />
        )}
      </ToolbarButton>
      <input
        ref={videoInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={handleVideoSelected}
      />
      <ToolbarButton label="Tabela" onClick={addTable}>
        <TableIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Linha divisória"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Desfazer"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Refazer"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  departmentSlug,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  departmentSlug: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // <h1> fica reservado ao campo "Título" do formulário.
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Video,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: placeholder ?? "Comece a escrever a documentação…",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          "doc-content min-h-[22rem] rounded-b-lg border p-4 focus:outline-none",
        ),
      },
    },
  });

  // Mantém o editor em sincronia quando o valor muda por fora (ex.: ao
  // carregar os dados iniciais na edição, que chegam depois do primeiro render).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="bg-muted/20 min-h-[26rem] animate-pulse rounded-lg border" />
    );
  }

  return (
    <div>
      <Toolbar editor={editor} departmentSlug={departmentSlug} />
      <EditorContent editor={editor} />
    </div>
  );
}
