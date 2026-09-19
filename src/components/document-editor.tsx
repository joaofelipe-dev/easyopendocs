"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { DOCUMENT_TEMPLATES } from "@/lib/document-templates";

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
    owner: string;
    criticality: "low" | "normal" | "high";
    status: "active" | "deprecated";
    bodyHtml: string;
  };
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialValues?.bodyHtml ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [owner, setOwner] = useState(initialValues?.owner ?? "");
  const [criticality, setCriticality] = useState(initialValues?.criticality ?? "normal");
  const [status, setStatus] = useState(initialValues?.status ?? "active");
  const [templateId, setTemplateId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = title !== (initialValues?.title ?? "") || bodyHtml !== (initialValues?.bodyHtml ?? "") ||
    description !== (initialValues?.description ?? "") || owner !== (initialValues?.owner ?? "") ||
    criticality !== (initialValues?.criticality ?? "normal") || status !== (initialValues?.status ?? "active");
  const [tab, setTab] = useState("editar");
  const [preview, setPreview] = useState("");
  const [isPreviewing, startPreview] = useTransition();
  const firstErrorField = (["title", "description", "owner", "criticality", "status", "bodyHtml"] as const)
    .find((field) => state.fieldErrors?.[field]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Capture before Next's link handler, preserving its normal navigation on acceptance.
    // Browser Back/Forward within the SPA is intentionally not intercepted.
    const leaveViaLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!window.confirm("Há alterações não salvas. Sair e descartá-las?")) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        window.removeEventListener("beforeunload", beforeUnload);
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leaveViaLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", leaveViaLink, true);
    };
  }, [dirty]);

  useEffect(() => {
    const first = firstErrorField;
    const frame = requestAnimationFrame(() => {
      if (first === "bodyHtml") setTab("editar");
      const target = first === "bodyHtml" ? "document-body" : first ?? "document-form-error";
      formRef.current?.querySelector<HTMLElement>(`#${target}`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [state, firstErrorField]);

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
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="departmentSlug" value={departmentSlug} />
      {mode === "edit" ? (
        <input type="hidden" name="documentSlug" value={documentSlug} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "create" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="template">Começar com um modelo</Label>
            <select
              id="template"
              value={templateId}
              className="border-input bg-background focus-visible:ring-ring/35 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
              onChange={(event) => {
                const template = DOCUMENT_TEMPLATES.find((item) => item.id === event.target.value);
                if (bodyHtml.trim() && !window.confirm("Substituir o conteúdo atual pelo modelo? Esta alteração descarta o texto do editor.")) return;
                setTemplateId(event.target.value);
                setBodyHtml(template?.bodyHtml ?? "");
              }}
            >
              <option value="">Página em branco</option>
              {DOCUMENT_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label} — {template.description}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              O modelo preenche o conteúdo inicial; tudo continua sendo HTML comum no arquivo final.
            </p>
          </div>
        ) : null}
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
            aria-invalid={Boolean(state.fieldErrors?.title)}
            aria-describedby={state.fieldErrors?.title ? "title-error" : undefined}
            autoFocus
          />
          {state.fieldErrors?.title ? (
            <p id="title-error" className="text-destructive text-xs">{state.fieldErrors.title}</p>
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
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.description)}
            aria-describedby={state.fieldErrors?.description ? "description-error" : undefined}
            placeholder="Resumo de uma linha exibido na listagem do departamento"
            maxLength={300}
          />
          {state.fieldErrors?.description ? (
            <p id="description-error" className="text-destructive text-xs">
              {state.fieldErrors.description}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">
            Responsável <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="owner"
            name="owner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.owner)}
            aria-describedby={state.fieldErrors?.owner ? "owner-error" : undefined}
            placeholder="Time ou pessoa que mantém este conteúdo"
            maxLength={120}
          />
          <p className="text-muted-foreground text-xs">
            Aparece na saúde da documentação para deixar claro quem pode confirmar uma mudança.
          </p>
          {state.fieldErrors?.owner ? <p id="owner-error" className="text-destructive text-xs">{state.fieldErrors.owner}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="criticality">Criticidade</Label>
            <select
              id="criticality"
              name="criticality"
              value={criticality}
              onChange={(event) => setCriticality(event.target.value as typeof criticality)}
              aria-invalid={Boolean(state.fieldErrors?.criticality)}
              aria-describedby={state.fieldErrors?.criticality ? "metadata-error" : undefined}
              className="border-input bg-background focus-visible:ring-ring/35 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              aria-invalid={Boolean(state.fieldErrors?.status)}
              aria-describedby={state.fieldErrors?.status ? "metadata-error" : undefined}
              className="border-input bg-background focus-visible:ring-ring/35 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
            >
              <option value="active">Ativa</option>
              <option value="deprecated">Descontinuada</option>
            </select>
          </div>
          {state.fieldErrors?.criticality || state.fieldErrors?.status ? (
            <p id="metadata-error" className="text-destructive col-span-2 text-xs">
              {state.fieldErrors.criticality ?? state.fieldErrors.status}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label id="document-body-label" htmlFor="document-body">Conteúdo</Label>
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
              invalid={Boolean(state.fieldErrors?.bodyHtml)}
              focusOnError={firstErrorField === "bodyHtml"}
              describedBy={state.fieldErrors?.bodyHtml ? "bodyHtml-error" : undefined}
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
          <p id="bodyHtml-error" className="text-destructive text-xs">{state.fieldErrors.bodyHtml}</p>
        ) : null}
      </div>

      {state.error ? (
        <Alert id="document-form-error" tabIndex={-1} variant="destructive">
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
      <p role="status" className="text-muted-foreground text-xs">
        {dirty ? "Alterações não salvas. Salve antes de usar Voltar ou Avançar do navegador." : "Nenhuma alteração pendente."}
      </p>
    </form>
  );
}
