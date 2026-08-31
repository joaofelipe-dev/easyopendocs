"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Eye, Pencil, Save } from "lucide-react";

import { previewDocumentAction, type DocumentFormState } from "@/actions/documents";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/rich-text-editor";
import { slugify } from "@/lib/slug";

const INITIAL_STATE: DocumentFormState = { error: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <Save />
      {pending ? "Salvando…" : label}
    </Button>
  );
}

export function DocumentEditor({
  action,
  departmentSlug,
  departmentName,
  mode,
  initialValues,
}: {
  action: (
    state: DocumentFormState,
    formData: FormData,
  ) => Promise<DocumentFormState>;
  departmentSlug: string;
  departmentName: string;
  mode: "create" | "edit";
  initialValues?: {
    documentSlug: string;
    title: string;
    description: string;
    bodyHtml: string;
  };
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialValues?.bodyHtml ?? "");
  const [tab, setTab] = useState("editar");
  const [preview, setPreview] = useState("");
  const [isPreviewing, startPreview] = useTransition();

  // Ao editar, o nome do arquivo é imutável: renomear quebraria links já
  // compartilhados. Ao criar, ele é derivado do título em tempo real.
  const documentSlug = useMemo(
    () => (mode === "edit" ? (initialValues?.documentSlug ?? "") : slugify(title)),
    [mode, title, initialValues?.documentSlug],
  );

  useEffect(() => {
    if (tab !== "previa") return;

    // A prévia é gerada no servidor, pelo mesmo sanitizador da renderização
    // final — assim o autor vê inclusive o que foi removido.
    startPreview(async () => {
      setPreview(await previewDocumentAction(bodyHtml));
    });
  }, [tab, bodyHtml]);

  const filePath = documentSlug
    ? `content/departamentos/${departmentSlug}/${documentSlug}.html`
    : `content/departamentos/${departmentSlug}/…`;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="departmentSlug" value={departmentSlug} />
      {mode === "edit" ? (
        <input type="hidden" name="documentSlug" value={documentSlug} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Como configurar o ambiente local"
            maxLength={160}
            required
            autoFocus
          />
          {state.fieldErrors?.title ? (
            <p className="text-destructive text-xs">{state.fieldErrors.title}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Arquivo: <code className="font-mono">{filePath}</code>
              {mode === "edit" ? " (não muda ao editar)" : null}
            </p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">
            Descrição{" "}
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="description"
            name="description"
            defaultValue={initialValues?.description ?? ""}
            placeholder="Resumo de uma linha exibido na listagem do departamento"
            maxLength={300}
          />
          {state.fieldErrors?.description ? (
            <p className="text-destructive text-xs">
              {state.fieldErrors.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="bodyHtml">Conteúdo</Label>
            <TabsList>
              <TabsTrigger value="editar">
                <Pencil className="size-3.5" />
                Editar
              </TabsTrigger>
              <TabsTrigger value="previa">
                <Eye className="size-3.5" />
                Prévia final
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="editar" className="mt-2">
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Comece a escrever a documentação…"
              departmentSlug={departmentSlug}
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Use a barra de ferramentas para formatar — não é preciso saber
              HTML. Colar texto do Word ou Google Docs também funciona.
            </p>
          </TabsContent>

          <TabsContent value="previa" className="mt-2">
            <div className="bg-background min-h-[22rem] rounded-lg border p-6">
              {isPreviewing ? (
                <p className="text-muted-foreground text-sm">Gerando prévia…</p>
              ) : preview.trim() ? (
                <div
                  className="doc-content"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nada para pré-visualizar ainda.
                </p>
              )}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Assim a documentação vai ficar publicada. Se algo formatado no
              editor não aparecer aqui, avise o time técnico.
            </p>
          </TabsContent>
        </Tabs>

        {/* Fora das TabsContent de propósito: Radix desmonta a aba inativa,
            então um input escondido lá dentro sumiria do FormData ao
            publicar direto da aba "Prévia final". */}
        <input type="hidden" id="bodyHtml" name="bodyHtml" value={bodyHtml} />

        {state.fieldErrors?.bodyHtml ? (
          <p className="text-destructive text-xs">{state.fieldErrors.bodyHtml}</p>
        ) : null}
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2">
        <SubmitButton
          label={mode === "create" ? "Publicar documentação" : "Salvar alterações"}
        />
        <Button asChild variant="ghost">
          <Link href={`/departamentos/${departmentSlug}`}>Cancelar</Link>
        </Button>
        <span className="text-muted-foreground ml-auto hidden text-xs sm:inline">
          {departmentName}
        </span>
      </div>
    </form>
  );
}
