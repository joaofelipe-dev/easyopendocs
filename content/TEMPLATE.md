# Padrão dos arquivos de documentação

Toda documentação do portal é **um arquivo `.html`** dentro da pasta do seu
departamento. O app descobre esses arquivos sozinho — não existe passo de build,
deploy ou cadastro manual.

```
content/departamentos/
├── engenharia/                 <- um departamento = uma pasta
│   ├── _departamento.json      <- (opcional) nome e descrição do departamento
│   ├── setup-ambiente.html     <- uma documentação = um arquivo .html
│   └── padroes-de-codigo.html
└── recursos-humanos/
    ├── onboarding.html
    └── politica-de-ferias.html
```

## 1. Nome do arquivo

O nome do arquivo (sem `.html`) vira o slug na URL:

```
content/departamentos/engenharia/setup-ambiente.html
        -> /departamentos/engenharia/setup-ambiente
```

Regras — arquivos fora delas são **ignorados pelo indexador**:

- somente letras minúsculas `a-z`, dígitos `0-9` e hífen `-`;
- sem acento, espaço, underscore ou maiúscula;
- sem hífen no começo/fim e sem hífen duplo;
- máximo de 100 caracteres.

O mesmo vale para o nome da pasta do departamento.

Arquivos e pastas começando com `.` ou `_` são ignorados de propósito — use esse
prefixo para rascunhos (`_rascunho.html`) e para metadados
(`_departamento.json`).

## 2. Estrutura do arquivo

O arquivo contém **apenas o conteúdo**, nunca uma página HTML completa. Não use
`<html>`, `<head>`, `<body>`, `<style>` ou `<script>` — o layout, a tipografia,
o cabeçalho e o índice lateral são responsabilidade do app.

```html
<!-- title: Como configurar o ambiente local -->
<!-- description: Passo a passo para subir o projeto localmente -->
<article>
  <h1>Como configurar o ambiente local</h1>

  <p>Texto de introdução explicando o objetivo do documento.</p>

  <h2>Pré-requisitos</h2>
  <ul>
    <li>Node.js 20 ou superior</li>
    <li>Docker e Docker Compose</li>
  </ul>

  <h2>Passo a passo</h2>
  <ol>
    <li>Clone o repositório.</li>
    <li>Rode <code>npm install</code>.</li>
  </ol>
</article>
```

### Front-matter

As linhas `<!-- chave: valor -->` no **topo** do arquivo são o front-matter. O
indexador lê os comentários até encontrar o primeiro conteúdo que não seja
comentário, e para ali.

| Chave         | Obrigatório | Uso                                                    |
| ------------- | ----------- | ------------------------------------------------------ |
| `title`       | recomendado | Título exibido na listagem, na aba e no índice lateral |
| `description` | opcional    | Resumo de uma linha exibido no card da listagem        |
| `author`      | opcional    | Preenchido automaticamente por docs criadas pela UI    |
| `createdAt`   | opcional    | ISO 8601, preenchido automaticamente por docs da UI    |
| `reviewEvery` | opcional    | Dias entre revisões desta documentação                  |
| `reviewedAt`  | opcional    | Data da última revisão (`AAAA-MM-DD`)                  |

Sem `title`, o indexador tenta nesta ordem: tag `<title>` → primeiro `<h1>` →
nome do arquivo humanizado. Ainda assim, **declare `title` explicitamente** —
é o único jeito de o título não depender do corpo do documento.

### Ciclo de revisão

Documentação interna envelhece em silêncio. Declarando `reviewEvery`, o portal
passa a mostrar um selo — **em dia**, **vence em N dias** ou **vencida há N
dias** — na listagem e na tela do documento, e conta as vencidas no `/admin`.

```html
<!-- reviewEvery: 180 -->
<!-- reviewedAt: 2026-09-04 -->
```

- Sem `reviewedAt`, a **data de alteração do arquivo** conta como a última
  revisão: na prática, editar é revisar.
- Um padrão para o departamento inteiro vai no `_departamento.json`
  (`reviewEveryDays`); o `reviewEvery` do documento sobrepõe.
- Sem nenhum dos dois, a documentação simplesmente **não participa** — nada de
  selo em quem nunca pediu para ser acompanhado.
- O botão **Marcar como revisada** (permissão `document:edit`) carimba a data
  de hoje em `reviewedAt`, alterando só essa linha do arquivo.

### Corpo

- Envolva o conteúdo em um único `<article>`.
- Use exatamente um `<h1>`, repetindo o `title`. Os subtítulos começam em `<h2>`.
- O índice lateral da documentação é montado a partir dos `<h2>` e `<h3>`.

## 3. Tags permitidas

Todo HTML é sanitizado com DOMPurify antes de ser renderizado. Tags e atributos
fora da lista são removidos silenciosamente — se algo "sumiu" da sua doc, é aqui
que você deve olhar.

**Permitido:** `article`, `section`, `div`, `span`, `p`, `br`, `hr`, `h1`–`h6`,
`ul`, `ol`, `li`, `dl`, `dt`, `dd`, `strong`, `b`, `em`, `i`, `u`, `s`, `mark`,
`small`, `sub`, `sup`, `a`, `img`, `figure`, `figcaption`, `video`, `source`,
`blockquote`, `q`, `cite`, `code`, `pre`, `kbd`, `samp`, `var`, `table`,
`thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `colgroup`, `col`,
`details`, `summary`, `abbr`, `time`.

**Atributos permitidos:** `href`, `src`, `alt`, `title`, `id`, `class`,
`colspan`, `rowspan`, `start`, `reversed`, `datetime`, `open`, `width`,
`height`, `loading`, `controls`, `preload`, `poster`, `type`.

**Sempre removido:** `<script>`, `<style>`, `<iframe>`, `<form>`, `<input>`,
`<link>`, `<meta>`, atributos `on*` (`onclick`, …), `style=` inline e URLs
`javascript:`. Imagens aceitam `https:`, caminho relativo ou `data:image/*`
em base64.

### Vídeo

Use o par `<video>`/`<source>`, com `controls` para o usuário poder tocar,
pausar e navegar:

```html
<video controls preload="metadata">
  <source src="/api/media/engenharia/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.mp4" type="video/mp4" />
</video>
```

Pela interface, o botão de vídeo do editor já cuida do upload e gera esse
HTML sozinho — veja "Mídia (imagens e vídeo)" no README.

## 4. Metadados do departamento (opcional)

Por padrão o nome do departamento é o slug da pasta humanizado
(`recursos-humanos` → "Recursos Humanos"). Para controlar o nome e a descrição,
crie um `_departamento.json` dentro da pasta:

```json
{
  "name": "Recursos Humanos",
  "description": "Políticas, benefícios e processos de pessoas",
  "reviewEveryDays": 180
}
```

`reviewEveryDays` é opcional: define o ciclo de revisão padrão das
documentações deste departamento, que cada arquivo pode sobrepor com
`reviewEvery` no front-matter.

## 5. Como publicar

1. Coloque o `.html` na pasta do departamento (git, FTP, cópia manual — tanto faz).
2. Abra o portal. A home e a página do departamento disparam o sync sozinhas.
3. Se quiser forçar: `POST /api/sync` (ou o botão "Sincronizar agora" em `/admin/sync`).

O sync é incremental: ele compara `mtime` + tamanho e, se necessário, o hash
SHA-256 do arquivo. Arquivos intocados não são reprocessados.

**Nada é apagado.** Um arquivo removido do disco vira *órfão*: some da listagem,
mas mantém registro e permissões — se o arquivo voltar, ele volta com ele.
Órfãos ficam visíveis em `/admin/sync`.
