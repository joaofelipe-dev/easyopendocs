export type DocumentTemplate = {
  id: string;
  label: string;
  description: string;
  bodyHtml: string;
};

/**
 * Modelos pequenos e deliberadamente editáveis. Eles são HTML comum, portanto
 * o arquivo publicado continua idêntico a um criado ou revisado no Git.
 */
export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "runbook",
    label: "Runbook operacional",
    description: "Procedimento acionável para operação e incidentes.",
    bodyHtml: `<article>\n  <h1>Nome do procedimento</h1>\n  <p>Explique quando este procedimento deve ser usado e qual resultado se espera.</p>\n\n  <h2>Pré-requisitos</h2>\n  <ul>\n    <li>Acesso ou ferramenta necessária</li>\n    <li>Condição que deve ser confirmada antes de começar</li>\n  </ul>\n\n  <h2>Passo a passo</h2>\n  <ol>\n    <li>Descreva a primeira ação verificável.</li>\n    <li>Descreva como validar o resultado.</li>\n  </ol>\n\n  <h2>Como reverter</h2>\n  <p>Explique como desfazer a alteração ou quando escalar o caso.</p>\n</article>`,
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Guia para uma pessoa começar com autonomia.",
    bodyHtml: `<article>\n  <h1>Boas-vindas</h1>\n  <p>Contexto curto sobre o time, sistema ou processo.</p>\n\n  <h2>O que você vai precisar</h2>\n  <ul>\n    <li>Contas e permissões</li>\n    <li>Ferramentas a instalar</li>\n  </ul>\n\n  <h2>Primeiros passos</h2>\n  <ol>\n    <li>Faça a primeira configuração.</li>\n    <li>Valide que está tudo funcionando.</li>\n  </ol>\n\n  <h2>Próximas referências</h2>\n  <ul>\n    <li><a href="#">Link para a documentação relacionada</a></li>\n  </ul>\n</article>`,
  },
  {
    id: "decision",
    label: "Registro de decisão",
    description: "Contexto e justificativa de uma decisão importante.",
    bodyHtml: `<article>\n  <h1>Decisão: título curto</h1>\n\n  <h2>Contexto</h2>\n  <p>Qual problema ou oportunidade motivou esta decisão?</p>\n\n  <h2>Decisão</h2>\n  <p>Registre o que foi decidido e a partir de quando vale.</p>\n\n  <h2>Alternativas consideradas</h2>\n  <ul>\n    <li>Alternativa e por que não foi escolhida.</li>\n  </ul>\n\n  <h2>Consequências</h2>\n  <p>Impactos, riscos e documentação que precisa ser atualizada.</p>\n</article>`,
  },
];

