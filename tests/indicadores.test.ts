import { describe, expect, it } from "vitest";
import { calcularIndicadores, inicioDaCarga, periodoDe, type LinhaPainel } from "@/lib/painel/indicadores";

// "Agora": 08/10/2026 12:00 em Brasília
const agora = new Date("2026-10-08T15:00:00Z");
const FISCAL = "s-fiscal";
const FOLHA = "s-folha";
const setores = [
  { id: FISCAL, nome: "Fiscal" },
  { id: FOLHA, nome: "Pessoal/Folha" },
];

let n = 0;
function rnc(p: Partial<Omit<LinhaPainel, "criadaEm">> & { criadaEm: string }): LinhaPainel {
  n++;
  const { criadaEm, ...resto } = p;
  return {
    codigo: `RNC-2610-${String(n).padStart(4, "0")}`,
    setorId: FISCAL,
    tipoProblema: "Guia paga em atraso",
    tipoProblemaNorm: "guia paga em atraso",
    origem: "erro_interno",
    severidade: "media",
    status: "analise",
    reaberturas: 0,
    encerradaEm: null,
    multas: 0,
    horas: 0,
    prazo: null,
    verificarEm: null,
    ...resto,
    criadaEm: new Date(criadaEm),
  };
}

const calc = (linhas: LinhaPainel[], chave = "12m") => calcularIndicadores(linhas, { agora, periodo: periodoDe(chave, agora), setores });

describe("período", () => {
  it("padrão: últimos 12 meses, a partir da meia-noite de Brasília", () => {
    const p = periodoDe(undefined, agora);
    expect(p.chave).toBe("12m");
    expect(p.inicio.toISOString()).toBe("2025-10-08T03:00:00.000Z");
    expect(p.fim).toBe(agora);
  });
  it("este ano e ano passado", () => {
    expect(periodoDe("ano", agora).inicio.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    const ap = periodoDe("ano_anterior", agora);
    expect([ap.inicio.toISOString(), ap.fim.toISOString()]).toEqual(["2025-01-01T03:00:00.000Z", "2026-01-01T03:00:00.000Z"]);
  });
  it("3 meses a partir de 31/mai cai no último dia do mês curto", () => {
    expect(periodoDe("3m", new Date("2026-05-31T15:00:00Z")).inicio.toISOString()).toBe("2026-02-28T03:00:00.000Z");
  });
  it("valor desconhecido volta ao padrão", () => {
    expect(periodoDe("xpto", agora).chave).toBe("12m");
  });
  it("carrega o suficiente para o período, os 180 dias e os 6 meses", () => {
    const p = periodoDe("3m", agora);
    expect(+inicioDaCarga(p)).toBeLessThanOrEqual(+agora - 180 * 86_400_000);
    expect(+inicioDaCarga(p)).toBeLessThanOrEqual(+new Date("2026-05-01T03:00:00Z"));
  });
});

describe("contagem por etapa", () => {
  it("em aberto contam sempre; encerradas só se encerradas no período", () => {
    const i = calc([
      rnc({ criadaEm: "2024-01-10T12:00:00Z", status: "analise" }), // antiga, mas em aberto
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "acao" }),
      rnc({ criadaEm: "2026-09-02T12:00:00Z", status: "verificacao" }),
      rnc({ criadaEm: "2026-03-01T12:00:00Z", status: "encerrada", encerradaEm: new Date("2026-04-01T12:00:00Z") }),
      rnc({ criadaEm: "2025-01-01T12:00:00Z", status: "encerrada", encerradaEm: new Date("2025-02-01T12:00:00Z") }), // fora
    ]);
    expect(i.porEtapa).toEqual({ analise: 1, acao: 1, verificacao: 1, encerrada: 1 });
    expect(i.abertas).toBe(3);
  });
});

describe("pedem atenção", () => {
  it("prazo vencido, verificação liberada e crítica sem análise", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "acao", prazo: "2026-10-07" }), // venceu ontem
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "acao", prazo: "2026-10-08" }), // vence hoje: ainda no prazo
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "verificacao", verificarEm: "2026-10-08" }), // liberada hoje
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "verificacao", verificarEm: "2026-10-09" }), // amanhã
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "analise", severidade: "critica" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "acao", severidade: "critica" }), // já analisada
    ]);
    expect(i.atencao.map((a) => a.motivo)).toEqual(["prazo", "verificacao", "critica"]);
    expect(i.pedemAtencao).toBe(3);
  });
  it("lista os prazos vencidos do mais antigo para o mais recente", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "acao", prazo: "2026-10-05", codigo: "B" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", status: "acao", prazo: "2026-09-20", codigo: "A" }),
    ]);
    expect(i.atencao.map((a) => a.codigo)).toEqual(["A", "B"]);
  });
});

describe("tempo médio até encerrar", () => {
  it("média em dias das encerradas no período", () => {
    const i = calc([
      rnc({ criadaEm: "2026-08-01T12:00:00Z", status: "encerrada", encerradaEm: new Date("2026-08-11T12:00:00Z") }), // 10
      rnc({ criadaEm: "2026-07-01T12:00:00Z", status: "encerrada", encerradaEm: new Date("2026-07-31T12:00:00Z") }), // 30
      rnc({ criadaEm: "2024-01-01T12:00:00Z", status: "encerrada", encerradaEm: new Date("2024-03-01T12:00:00Z") }), // fora
    ]);
    expect(i.tempoMedioDias).toBe(20);
  });
  it("sem encerradas: vazio (não zero)", () => {
    expect(calc([rnc({ criadaEm: "2026-09-01T12:00:00Z" })]).tempoMedioDias).toBeNull();
  });
});

describe("reincidência", () => {
  it("% das RNCs do período cujo par (setor, tipo normalizado) se repete", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FISCAL, tipoProblemaNorm: "guia paga em atraso" }),
      rnc({ criadaEm: "2026-09-02T12:00:00Z", setorId: FISCAL, tipoProblemaNorm: "guia paga em atraso" }),
      rnc({ criadaEm: "2026-09-03T12:00:00Z", setorId: FOLHA, tipoProblemaNorm: "guia paga em atraso" }), // outro setor
      rnc({ criadaEm: "2026-09-04T12:00:00Z", setorId: FISCAL, tipoProblemaNorm: "cadastro desatualizado" }),
    ]);
    expect(i.reincidencia).toBe(50); // 2 de 4
  });
  it("repetição fora do período não conta", () => {
    const i = calc([
      rnc({ criadaEm: "2024-09-01T12:00:00Z", status: "encerrada", encerradaEm: new Date("2024-10-01T12:00:00Z") }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z" }),
    ]);
    expect(i.reincidencia).toBe(0);
  });
  it("sem RNCs no período: vazio", () => {
    expect(calc([]).reincidencia).toBeNull();
  });
});

describe("origem no cliente e custo", () => {
  it("% com origem no cliente e soma de multas e horas no período", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", origem: "cliente", multas: 100.1, horas: 1.5 }),
      rnc({ criadaEm: "2026-09-02T12:00:00Z", origem: "cliente", multas: 0.2, horas: 0 }),
      rnc({ criadaEm: "2026-09-03T12:00:00Z", origem: "erro_interno", multas: 50, horas: 2 }),
      rnc({ criadaEm: "2024-01-01T12:00:00Z", origem: "cliente", multas: 999, horas: 9, status: "acao" }), // fora do período
    ]);
    expect(i.origemCliente).toBe(67); // 2 de 3
    expect(i.custo).toEqual({ multas: 150.3, horas: 3.5 });
    expect(i.totalNoPeriodo).toBe(3);
  });
});

describe("gráficos", () => {
  it("por setor empilhado por severidade", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FISCAL, severidade: "critica" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FISCAL, severidade: "critica" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FISCAL, severidade: "baixa" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FOLHA, severidade: "alta" }),
    ]);
    expect(i.porSetor).toEqual([
      { setorId: FISCAL, nome: "Fiscal", critica: 2, alta: 0, media: 0, baixa: 1, total: 3 },
      { setorId: FOLHA, nome: "Pessoal/Folha", critica: 0, alta: 1, media: 0, baixa: 0, total: 1 },
    ]);
  });
  it("por origem, com todas as origens", () => {
    const i = calc([rnc({ criadaEm: "2026-09-01T12:00:00Z", origem: "orgao_publico" })]);
    expect(i.porOrigem).toHaveLength(6);
    expect(i.porOrigem.find((o) => o.origem === "orgao_publico")?.total).toBe(1);
  });
  it("registros por mês: 6 meses até o mês atual, no horário de Brasília", () => {
    const i = calc([
      rnc({ criadaEm: "2026-10-01T02:00:00Z" }), // 30/09 23h em Brasília: conta em setembro
      rnc({ criadaEm: "2026-10-05T12:00:00Z" }),
      rnc({ criadaEm: "2026-05-10T12:00:00Z" }),
      rnc({ criadaEm: "2026-04-30T12:00:00Z" }), // antes da janela de 6 meses
    ]);
    expect(i.meses.map((m) => m.chave)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(i.meses.map((m) => m.total)).toEqual([1, 0, 0, 0, 1, 1]);
    expect(i.meses[5].rotulo).toBe("out");
  });
  it("ano passado: os 6 meses terminam em dezembro", () => {
    const i = calc([], "ano_anterior");
    expect(i.meses.map((m) => m.chave)).toEqual(["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]);
  });
});

describe("problemas que se repetem", () => {
  it("pares com 2 ou mais ocorrências nos últimos 180 dias, do mais frequente ao menos", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", tipoProblema: "Guia paga em atraso" }),
      rnc({ criadaEm: "2026-09-10T12:00:00Z", tipoProblema: "guia paga em atraso" }),
      rnc({ criadaEm: "2026-08-01T12:00:00Z", tipoProblema: "Guia paga em atraso" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FOLHA, tipoProblema: "Erro de cálculo na folha", tipoProblemaNorm: "erro de calculo na folha" }),
      rnc({ criadaEm: "2026-09-05T12:00:00Z", setorId: FOLHA, tipoProblema: "Erro de cálculo na folha", tipoProblemaNorm: "erro de calculo na folha" }),
      rnc({ criadaEm: "2026-01-01T12:00:00Z", setorId: FOLHA, tipoProblema: "Cadastro desatualizado", tipoProblemaNorm: "cadastro desatualizado" }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", setorId: FOLHA, tipoProblema: "Cadastro desatualizado", tipoProblemaNorm: "cadastro desatualizado" }), // a outra está fora dos 180 dias
    ]);
    expect(i.recorrentes).toEqual([
      { setor: "Fiscal", tipoProblema: "guia paga em atraso", total: 3 }, // grafia da ocorrência mais recente
      { setor: "Pessoal/Folha", tipoProblema: "Erro de cálculo na folha", total: 2 },
    ]);
  });
});

describe("reaberturas", () => {
  it("soma das verificações ineficazes das RNCs do período", () => {
    const i = calc([
      rnc({ criadaEm: "2026-09-01T12:00:00Z", reaberturas: 2 }),
      rnc({ criadaEm: "2026-09-01T12:00:00Z", reaberturas: 1 }),
      rnc({ criadaEm: "2024-09-01T12:00:00Z", reaberturas: 5, status: "acao" }),
    ]);
    expect(i.reaberturas).toBe(3);
  });
});
