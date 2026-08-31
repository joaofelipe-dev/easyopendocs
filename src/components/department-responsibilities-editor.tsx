"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileText,
  FolderPlus,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  deleteDepartmentResponsibilitiesAction,
  saveDepartmentResponsibilitiesAction,
} from "@/actions/department-responsibilities";
import { ActionForm, ConfirmSubmit } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
// Só tipos: o schema (e o zod junto dele) fica no servidor.
import type { DepartmentResponsibilities } from "@/lib/department-responsibilities";

export type ResponsibilitiesEditorDocument = { slug: string; title: string };

/**
 * O estado do editor é uma cópia editável do `_responsabilidades.json`, com
 * uma chave de React por linha. `id` e `deliversTo` viajam intocados: o id é o
 * que mantém as referências válidas quando alguém renomeia um bloco, e o
 * `deliversTo` é o campo que o diagrama vai usar quando existir.
 */
type EditorItem = {
  key: string;
  id: string;
  title: string;
  description: string;
  owner: string;
  docs: string[];
  deliversTo: string[];
};

type EditorArea = {
  key: string;
  id: string;
  title: string;
  items: EditorItem[];
};

function toEditorAreas(responsibilities: DepartmentResponsibilities): EditorArea[] {
  // As chaves iniciais saem dos ids (estáveis e únicos) em vez de um uuid
  // aleatório, senão o render do servidor e o da hidratação divergiriam.
  return responsibilities.areas.map((area) => ({
    key: area.id,
    id: area.id,
    title: area.title,
    items: area.items.map((item) => ({
      key: item.id,
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      owner: item.owner ?? "",
      docs: item.docs,
      deliversTo: item.deliversTo,
    })),
  }));
}

// Contador de módulo em vez de `crypto.randomUUID()`: essa função só existe em
// contexto seguro (HTTPS ou localhost), e o portal roda em HTTP na rede local.
// O "#" garante que a chave nunca colida com um id vindo do arquivo — slugify()
// só produz [a-z0-9-].
let keySeed = 0;

function newKey(): string {
  keySeed += 1;
  return `#${keySeed}`;
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;

  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending}>
      <Save />
      {pending ? "Salvando…" : "Salvar"}
    </Button>
  );
}

function DocumentPicker({
  documents,
  selected,
  onToggle,
}: {
  documents: ResponsibilitiesEditorDocument[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileText />
          {selected.length === 0
            ? "Vincular documentações"
            : `${selected.length} vinculada${selected.length > 1 ? "s" : ""}`}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
        {documents.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Este departamento ainda não tem documentações.
          </p>
        ) : (
          documents.map((document) => (
            <DropdownMenuCheckboxItem
              key={document.slug}
              checked={selected.includes(document.slug)}
              onCheckedChange={() => onToggle(document.slug)}
              // Sem isso o menu fecha a cada clique e vincular três documentos
              // vira três aberturas.
              onSelect={(event) => event.preventDefault()}
            >
              {document.title}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DepartmentResponsibilitiesEditor({
  departmentSlug,
  documents,
  initialResponsibilities,
  hasExisting,
  filePath,
}: {
  departmentSlug: string;
  documents: ResponsibilitiesEditorDocument[];
  initialResponsibilities: DepartmentResponsibilities;
  hasExisting: boolean;
  filePath: string;
}) {
  const [state, formAction] = useActionState(
    saveDepartmentResponsibilitiesAction,
    INITIAL_ACTION_STATE,
  );
  const [areas, setAreas] = useState<EditorArea[]>(() =>
    toEditorAreas(initialResponsibilities),
  );

  const titleBySlug = useMemo(
    () => new Map(documents.map((document) => [document.slug, document.title])),
    [documents],
  );

  const payload = useMemo(
    () =>
      JSON.stringify({
        areas: areas.map((area) => ({
          ...(area.id ? { id: area.id } : {}),
          title: area.title,
          items: area.items.map((item) => ({
            ...(item.id ? { id: item.id } : {}),
            title: item.title,
            description: item.description,
            owner: item.owner,
            docs: item.docs,
            deliversTo: item.deliversTo,
          })),
        })),
      }),
    [areas],
  );

  const incomplete = areas.some(
    (area) => !area.title.trim() || area.items.some((item) => !item.title.trim()),
  );

  const patchArea = (areaKey: string, patch: Partial<EditorArea>) =>
    setAreas((previous) =>
      previous.map((area) => (area.key === areaKey ? { ...area, ...patch } : area)),
    );

  const patchItem = (areaKey: string, itemKey: string, patch: Partial<EditorItem>) =>
    setAreas((previous) =>
      previous.map((area) =>
        area.key === areaKey
          ? {
              ...area,
              items: area.items.map((item) =>
                item.key === itemKey ? { ...item, ...patch } : item,
              ),
            }
          : area,
      ),
    );

  const backHref = `/departamentos/${departmentSlug}${hasExisting ? "/responsabilidades" : ""}`;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="departmentSlug" value={departmentSlug} />
        <input type="hidden" name="responsibilities" value={payload} />

        {state.message ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {areas.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Comece criando uma frente de atuação — por exemplo{" "}
            <span className="text-foreground">Infraestrutura</span>,{" "}
            <span className="text-foreground">Suporte</span> ou{" "}
            <span className="text-foreground">Folha de pagamento</span>.
          </p>
        ) : null}

        {areas.map((area, areaIndex) => (
          <Card key={area.key}>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label={`Título da frente ${areaIndex + 1}`}
                    placeholder="Nome da frente (ex.: Infraestrutura)"
                    value={area.title}
                    onChange={(event) => patchArea(area.key, { title: event.target.value })}
                    className="font-medium"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mover frente para cima"
                  disabled={areaIndex === 0}
                  onClick={() => setAreas((previous) => move(previous, areaIndex, -1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mover frente para baixo"
                  disabled={areaIndex === areas.length - 1}
                  onClick={() => setAreas((previous) => move(previous, areaIndex, 1))}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover frente"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    setAreas((previous) =>
                      previous.filter((candidate) => candidate.key !== area.key),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>

              <ul className="space-y-3">
                {area.items.map((item, itemIndex) => (
                  <li
                    key={item.key}
                    className="border-border/70 space-y-3 rounded-lg border p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Input
                        aria-label={`Responsabilidade ${itemIndex + 1}`}
                        placeholder="Responsabilidade (ex.: Backup e restore)"
                        value={item.title}
                        onChange={(event) =>
                          patchItem(area.key, item.key, { title: event.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Mover responsabilidade para cima"
                        disabled={itemIndex === 0}
                        onClick={() =>
                          patchArea(area.key, { items: move(area.items, itemIndex, -1) })
                        }
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Mover responsabilidade para baixo"
                        disabled={itemIndex === area.items.length - 1}
                        onClick={() =>
                          patchArea(area.key, { items: move(area.items, itemIndex, 1) })
                        }
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover responsabilidade"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          patchArea(area.key, {
                            items: area.items.filter(
                              (candidate) => candidate.key !== item.key,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    <Textarea
                      aria-label="Descrição da responsabilidade"
                      placeholder="Descrição (opcional)"
                      rows={2}
                      value={item.description}
                      onChange={(event) =>
                        patchItem(area.key, item.key, { description: event.target.value })
                      }
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label="Responsável"
                        placeholder="Responsável (opcional)"
                        value={item.owner}
                        onChange={(event) =>
                          patchItem(area.key, item.key, { owner: event.target.value })
                        }
                        className="w-full sm:w-56"
                      />

                      <DocumentPicker
                        documents={documents}
                        selected={item.docs}
                        onToggle={(slug) =>
                          patchItem(area.key, item.key, {
                            docs: item.docs.includes(slug)
                              ? item.docs.filter((candidate) => candidate !== slug)
                              : [...item.docs, slug],
                          })
                        }
                      />
                    </div>

                    {item.docs.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {item.docs.map((slug) => {
                          const title = titleBySlug.get(slug);

                          return (
                            <li key={slug}>
                              <span
                                className={`bg-muted flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-xs ${
                                  title === undefined ? "text-destructive" : ""
                                }`}
                              >
                                {title ?? `${slug} (não encontrada)`}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-5"
                                  aria-label={`Desvincular ${title ?? slug}`}
                                  onClick={() =>
                                    patchItem(area.key, item.key, {
                                      docs: item.docs.filter(
                                        (candidate) => candidate !== slug,
                                      ),
                                    })
                                  }
                                >
                                  <X className="size-3" />
                                </Button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  patchArea(area.key, {
                    items: [
                      ...area.items,
                      {
                        key: newKey(),
                        id: "",
                        title: "",
                        description: "",
                        owner: "",
                        docs: [],
                        deliversTo: [],
                      },
                    ],
                  })
                }
              >
                <Plus />
                Responsabilidade
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setAreas((previous) => [
              ...previous,
              { key: newKey(), id: "", title: "", items: [] },
            ])
          }
        >
          <FolderPlus />
          Nova frente
        </Button>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <SaveButton disabled={incomplete} />
          <Button asChild variant="ghost">
            <Link href={backHref}>Cancelar</Link>
          </Button>
          {incomplete ? (
            <p className="text-muted-foreground text-xs">
              Preencha o título de todas as frentes e responsabilidades.
            </p>
          ) : null}
          <span className="text-muted-foreground ml-auto hidden font-mono text-xs sm:inline">
            {filePath}
          </span>
        </div>
      </form>

      {hasExisting ? (
        <ActionForm
          id="excluir-responsabilidades"
          action={deleteDepartmentResponsibilitiesAction}
        >
          <input type="hidden" name="departmentSlug" value={departmentSlug} />
          <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Excluir o mapa de responsabilidades</p>
              <p className="text-muted-foreground text-xs">
                Remove o arquivo do disco. As documentações vinculadas não são
                afetadas.
              </p>
            </div>
            <ConfirmSubmit
              formId="excluir-responsabilidades"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              title="Excluir as responsabilidades do departamento?"
              description="O arquivo _responsabilidades.json será removido do disco. As documentações vinculadas continuam intactas."
              confirmLabel="Excluir"
            >
              <Trash2 />
              Excluir
            </ConfirmSubmit>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
