// Rótulos e listas do domínio da RNC (valores iguais aos ENUMs do banco).
// Sem dependências de servidor: usado também no navegador.

export const ORIGENS = {
  erro_interno: "Erro interno",
  cliente: "Cliente",
  sistema_software: "Sistema/software",
  mudanca_legislacao: "Mudança na legislação",
  fornecedor_terceiro: "Fornecedor/terceiro",
  orgao_publico: "Órgão público",
} as const;
export type Origem = keyof typeof ORIGENS;

export const SEVERIDADES = {
  critica: { rotulo: "Crítica", descricao: "Gera multa, autuação ou risco legal" },
  alta: { rotulo: "Alta", descricao: "Exige retificação ou retrabalho significativo" },
  media: { rotulo: "Média", descricao: "Atraso interno, sem impacto externo" },
  baixa: { rotulo: "Baixa", descricao: "Oportunidade de melhoria" },
} as const;
export type Severidade = keyof typeof SEVERIDADES;
export const ORDEM_SEVERIDADE: Severidade[] = ["critica", "alta", "media", "baixa"];

export const ETAPAS = {
  analise: { rotulo: "Aguardando análise de causa", curto: "Análise de causa", indice: 1 },
  acao: { rotulo: "Ação corretiva em andamento", curto: "Ação corretiva", indice: 2 },
  verificacao: { rotulo: "Aguardando verificação de eficácia", curto: "Verificação", indice: 3 },
  encerrada: { rotulo: "Encerrada", curto: "Encerrada", indice: 4 },
} as const;
export type Status = keyof typeof ETAPAS;

export const PASSOS = ["Registro", "Causa raiz", "Ação corretiva", "Eficácia"] as const;
