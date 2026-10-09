// Indicadores do painel, calculados sobre uma lista de RNCs já carregada.
// Funções puras (sem banco): as regras de cada número estão em docs/indicadores.md.
import { hojeEmBrasilia } from "@/lib/rnc/codigo";
import { ORIGENS, ORDEM_SEVERIDADE, type Origem, type Severidade, type Status } from "@/lib/rnc/dominio";

export type LinhaPainel = {
  codigo: string;
  setorId: string;
  tipoProblema: string;
  tipoProblemaNorm: string;
  origem: Origem;
  severidade: Severidade;
  status: Status;
  reaberturas: number;
  criadaEm: Date;
  encerradaEm: Date | null;
  multas: number;
  horas: number;
  // Ação do ciclo atual (AAAA-MM-DD)
  prazo: string | null;
  verificarEm: string | null;
};

export const PERIODOS = {
  "12m": "Últimos 12 meses",
  "6m": "Últimos 6 meses",
  "3m": "Últimos 3 meses",
  ano: "Este ano",
  ano_anterior: "Ano passado",
} as const;
export type ChavePeriodo = keyof typeof PERIODOS;

export type Periodo = { chave: ChavePeriodo; rotulo: string; inicio: Date; fim: Date };

const DIA = 86_400_000;

// Meia-noite de Brasília (UTC-3, sem horário de verão desde 2019)
const meiaNoite = (iso: string) => new Date(`${iso}T00:00:00-03:00`);

function voltarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 - meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export function periodoDe(chave: string | undefined, agora = new Date()): Periodo {
  const c: ChavePeriodo = chave && chave in PERIODOS ? (chave as ChavePeriodo) : "12m";
  const hoje = hojeEmBrasilia(agora);
  const ano = Number(hoje.slice(0, 4));
  const base = { chave: c, rotulo: PERIODOS[c] };
  switch (c) {
    case "ano":
      return { ...base, inicio: meiaNoite(`${ano}-01-01`), fim: agora };
    case "ano_anterior":
      return { ...base, inicio: meiaNoite(`${ano - 1}-01-01`), fim: meiaNoite(`${ano}-01-01`) };
    default: {
      const meses = { "12m": 12, "6m": 6, "3m": 3 }[c];
      return { ...base, inicio: meiaNoite(voltarMeses(hoje, meses)), fim: agora };
    }
  }
}

const dentro = (d: Date | null, p: { inicio: Date; fim: Date }) => !!d && d >= p.inicio && d < p.fim;
const pct = (parte: number, total: number) => (total ? Math.round((100 * parte) / total) : null);

export type ItemAtencao = { codigo: string; tipoProblema: string; motivo: "prazo" | "verificacao" | "critica"; data: string | null };

export function calcularIndicadores(
  linhas: LinhaPainel[],
  { agora = new Date(), periodo, setores }: { agora?: Date; periodo: Periodo; setores: { id: string; nome: string }[] },
) {
  const hoje = hojeEmBrasilia(agora);
  const noPeriodo = linhas.filter((r) => dentro(r.criadaEm, periodo));

  // Ciclo: as em aberto são o retrato de agora; encerradas, só as do período
  const porEtapa = { analise: 0, acao: 0, verificacao: 0, encerrada: 0 };
  for (const r of linhas) {
    if (r.status !== "encerrada") porEtapa[r.status]++;
    else if (dentro(r.encerradaEm, periodo)) porEtapa.encerrada++;
  }
  const abertas = porEtapa.analise + porEtapa.acao + porEtapa.verificacao;

  // Pedem atenção (agora): prazo vencido, verificação liberada, crítica sem análise
  const atrasadas = linhas.filter((r) => r.status === "acao" && r.prazo && r.prazo < hoje);
  const verificacoes = linhas.filter((r) => r.status === "verificacao" && r.verificarEm && r.verificarEm <= hoje);
  const criticas = linhas.filter((r) => r.status === "analise" && r.severidade === "critica");
  const atencao: ItemAtencao[] = [
    ...atrasadas.sort((a, b) => a.prazo!.localeCompare(b.prazo!)).map((r) => ({ codigo: r.codigo, tipoProblema: r.tipoProblema, motivo: "prazo" as const, data: r.prazo })),
    ...verificacoes.sort((a, b) => a.verificarEm!.localeCompare(b.verificarEm!)).map((r) => ({ codigo: r.codigo, tipoProblema: r.tipoProblema, motivo: "verificacao" as const, data: r.verificarEm })),
    ...criticas.sort((a, b) => +a.criadaEm - +b.criadaEm).map((r) => ({ codigo: r.codigo, tipoProblema: r.tipoProblema, motivo: "critica" as const, data: null })),
  ];

  // Tempo médio até encerrar: RNCs encerradas dentro do período
  const encerradas = linhas.filter((r) => r.status === "encerrada" && dentro(r.encerradaEm, periodo));
  const tempoMedioDias = encerradas.length
    ? Math.round(encerradas.reduce((s, r) => s + (+r.encerradaEm! - +r.criadaEm) / DIA, 0) / encerradas.length)
    : null;

  // Reincidência: % das RNCs do período cujo par (setor, tipo) aparece mais de uma vez nele
  const contaPar = new Map<string, number>();
  const par = (r: LinhaPainel) => `${r.setorId}|${r.tipoProblemaNorm}`;
  for (const r of noPeriodo) contaPar.set(par(r), (contaPar.get(par(r)) ?? 0) + 1);
  const reincidencia = pct(noPeriodo.filter((r) => contaPar.get(par(r))! > 1).length, noPeriodo.length);

  const origemCliente = pct(noPeriodo.filter((r) => r.origem === "cliente").length, noPeriodo.length);
  const custo = {
    multas: Math.round(noPeriodo.reduce((s, r) => s + r.multas, 0) * 100) / 100,
    horas: Math.round(noPeriodo.reduce((s, r) => s + r.horas, 0) * 100) / 100,
  };

  // Por setor, empilhado por severidade (setores sem RNC aparecem só se ativos na lista)
  const porSetor = setores.map((s) => {
    const doSetor = noPeriodo.filter((r) => r.setorId === s.id);
    const contagem = Object.fromEntries(ORDEM_SEVERIDADE.map((k) => [k, doSetor.filter((r) => r.severidade === k).length])) as Record<Severidade, number>;
    return { setorId: s.id, nome: s.nome, ...contagem, total: doSetor.length };
  });

  const porOrigem = (Object.keys(ORIGENS) as Origem[]).map((o) => ({ origem: o, rotulo: ORIGENS[o], total: noPeriodo.filter((r) => r.origem === o).length }));

  // Registros por mês: os 6 meses que terminam no fim do período
  const fimIso = hojeEmBrasilia(new Date(+periodo.fim - 1));
  const meses = Array.from({ length: 6 }, (_, i) => {
    const iso = voltarMeses(`${fimIso.slice(0, 7)}-01`, 5 - i);
    const d = new Date(`${iso}T12:00:00Z`);
    return {
      chave: iso.slice(0, 7),
      rotulo: d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", ""),
      ano: iso.slice(0, 4),
      total: 0,
    };
  });
  for (const r of linhas) {
    const m = meses.find((x) => x.chave === hojeEmBrasilia(r.criadaEm).slice(0, 7));
    if (m) m.total++;
  }

  // Problemas que se repetem: (setor, tipo) com 2+ ocorrências nos 180 dias até o fim do período
  const janela180 = { inicio: new Date(+periodo.fim - 180 * DIA), fim: periodo.fim };
  const rec = new Map<string, { setorId: string; tipoProblema: string; total: number; ultima: Date }>();
  for (const r of linhas.filter((x) => dentro(x.criadaEm, janela180))) {
    const atual = rec.get(par(r));
    if (!atual) rec.set(par(r), { setorId: r.setorId, tipoProblema: r.tipoProblema, total: 1, ultima: r.criadaEm });
    else {
      atual.total++;
      if (r.criadaEm > atual.ultima) Object.assign(atual, { ultima: r.criadaEm, tipoProblema: r.tipoProblema });
    }
  }
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const recorrentes = [...rec.values()]
    .filter((x) => x.total >= 2)
    .sort((a, b) => b.total - a.total || +b.ultima - +a.ultima)
    .map((x) => ({ setor: nomeSetor.get(x.setorId) ?? "—", tipoProblema: x.tipoProblema, total: x.total }));

  // Quantas vezes, no período, uma verificação mostrou que o problema voltou
  const reaberturas = noPeriodo.reduce((s, r) => s + r.reaberturas, 0);

  return {
    totalNoPeriodo: noPeriodo.length,
    porEtapa,
    abertas,
    atencao,
    pedemAtencao: new Set(atencao.map((a) => a.codigo)).size,
    tempoMedioDias,
    reincidencia,
    origemCliente,
    custo,
    porSetor,
    porOrigem,
    meses,
    recorrentes,
    reaberturas,
  };
}

export type Indicadores = ReturnType<typeof calcularIndicadores>;

// Primeira data que o painel precisa carregar para o período escolhido
export function inicioDaCarga(periodo: Periodo): Date {
  const seisMeses = meiaNoite(voltarMeses(`${hojeEmBrasilia(new Date(+periodo.fim - 1)).slice(0, 7)}-01`, 5));
  return new Date(Math.min(+periodo.inicio, +periodo.fim - 180 * DIA, +seisMeses));
}
