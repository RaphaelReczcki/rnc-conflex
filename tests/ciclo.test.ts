import { describe, expect, it } from "vitest";
import {
  aplicarEvento,
  cicloAtual,
  ErroCiclo,
  etapaPermite,
  validarAcao,
  validarAnalise,
  validarVerificacao,
  type EstadoCiclo,
  type Evento,
} from "@/lib/rnc/ciclo";
import { somarDias } from "@/lib/datas";
import type { Status } from "@/lib/rnc/dominio";

const agora = new Date("2026-10-08T15:00:00Z");
const estado = (status: Status, reaberturas = 0): EstadoCiclo => ({ status, reaberturas, encerradaEm: null });
const EVENTOS: Evento[] = ["concluir_analise", "concluir_acao", "verificar_eficaz", "verificar_ineficaz"];
const STATUS: Status[] = ["analise", "acao", "verificacao", "encerrada"];

describe("transições válidas", () => {
  it("análise → ação", () => {
    const r = aplicarEvento(estado("analise"), "concluir_analise", agora);
    expect(r.status).toBe("acao");
    expect(r.reaberturas).toBe(0);
    expect(r.encerradaEm).toBeNull();
    expect(r.historico).toEqual({ tipo: "analise_concluida", texto: "Análise de causa concluída", statusAnterior: "analise", statusNovo: "acao", ciclo: 1 });
  });
  it("ação → verificação", () => {
    const r = aplicarEvento(estado("acao"), "concluir_acao", agora);
    expect(r.status).toBe("verificacao");
    expect(r.historico.tipo).toBe("acao_concluida");
  });
  it("verificação eficaz → encerrada, com data de encerramento", () => {
    const r = aplicarEvento(estado("verificacao"), "verificar_eficaz", agora);
    expect(r.status).toBe("encerrada");
    expect(r.encerradaEm).toEqual(agora);
    expect(r.reaberturas).toBe(0);
    expect(r.historico.texto).toBe("Verificada como eficaz e encerrada");
  });
  it("verificação ineficaz → volta para análise e soma uma reabertura", () => {
    const r = aplicarEvento(estado("verificacao"), "verificar_ineficaz", agora);
    expect(r.status).toBe("analise");
    expect(r.reaberturas).toBe(1);
    expect(r.encerradaEm).toBeNull();
    expect(r.historico).toMatchObject({ tipo: "verificacao_ineficaz", statusAnterior: "verificacao", statusNovo: "analise", ciclo: 1 });
  });
});

describe("transições inválidas", () => {
  // Só 4 das 16 combinações (status × evento) são permitidas
  const validas = new Set(["analise:concluir_analise", "acao:concluir_acao", "verificacao:verificar_eficaz", "verificacao:verificar_ineficaz"]);
  for (const s of STATUS) {
    for (const e of EVENTOS) {
      if (validas.has(`${s}:${e}`)) continue;
      it(`${s} não aceita ${e}`, () => {
        expect(etapaPermite(s, e)).toBe(false);
        expect(() => aplicarEvento(estado(s), e, agora)).toThrow(ErroCiclo);
      });
    }
  }
  it("encerrada não aceita nenhum evento", () => {
    for (const e of EVENTOS) expect(() => aplicarEvento(estado("encerrada"), e)).toThrow(/encerrada/);
  });
  it("não pula etapas: análise não vai direto para verificação ou encerrada", () => {
    expect(() => aplicarEvento(estado("analise"), "concluir_acao")).toThrow(ErroCiclo);
    expect(() => aplicarEvento(estado("analise"), "verificar_eficaz")).toThrow(ErroCiclo);
  });
});

describe("ciclo completo com reaberturas", () => {
  function rodar(inicial: EstadoCiclo, eventos: Evento[]) {
    let s = inicial;
    const historico = [];
    for (const e of eventos) {
      const r = aplicarEvento(s, e, agora);
      historico.push(r.historico);
      s = { status: r.status, reaberturas: r.reaberturas, encerradaEm: r.encerradaEm };
    }
    return { final: s, historico };
  }

  it("caminho feliz em um ciclo", () => {
    const { final, historico } = rodar(estado("analise"), ["concluir_analise", "concluir_acao", "verificar_eficaz"]);
    expect(final).toEqual({ status: "encerrada", reaberturas: 0, encerradaEm: agora });
    expect(historico.map((h) => h.ciclo)).toEqual([1, 1, 1]);
  });

  it("duas verificações ineficazes e depois eficaz: 3 ciclos, 2 reaberturas", () => {
    const umCiclo: Evento[] = ["concluir_analise", "concluir_acao"];
    const { final, historico } = rodar(estado("analise"), [
      ...umCiclo,
      "verificar_ineficaz",
      ...umCiclo,
      "verificar_ineficaz",
      ...umCiclo,
      "verificar_eficaz",
    ]);
    expect(final.status).toBe("encerrada");
    expect(final.reaberturas).toBe(2);
    expect(cicloAtual(final.reaberturas)).toBe(3);
    // Cada evento registra o ciclo em que aconteceu
    expect(historico.map((h) => h.ciclo)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    // Toda transição gera uma entrada de histórico
    expect(historico).toHaveLength(9);
  });
});

describe("validação da análise", () => {
  const base = { metodo: "cinco_porques", porque1: "Guia vencia no feriado", porque2: "", porque3: "", porque4: "", porque5: "", ishMetodo: "", ishPessoas: "", ishSistema: "", ishCliente: "", ishDocumentacao: "", ishPrazo: "", causaRaiz: "" };
  it("rascunho pode ficar sem causa raiz", () => {
    expect(validarAnalise(base, false)).toHaveProperty("dados");
  });
  it("concluir exige causa raiz", () => {
    expect(validarAnalise(base, true)).toMatchObject({ campo: "causaRaiz" });
    expect(validarAnalise({ ...base, causaRaiz: "   " }, true)).toMatchObject({ campo: "causaRaiz" });
    expect(validarAnalise({ ...base, causaRaiz: "Checklist sem conferência de feriados" }, true)).toHaveProperty("dados");
  });
  it("método precisa ser 5 Porquês ou Ishikawa", () => {
    expect(validarAnalise({ ...base, metodo: "pdca" }, false)).toHaveProperty("erro");
  });
  it("LGPD: recusa CPF", () => {
    expect(validarAnalise({ ...base, porque2: "funcionário 123.456.789-09" }, false)).toMatchObject({ campo: "porque2" });
  });
});

describe("validação da ação", () => {
  const ctx = { hoje: "2026-10-08", dataOcorrencia: "2026-10-01" };
  const resp = "8284dbf3-1648-4cc1-82e3-107aafdac182";
  const base = { descricao: "Incluir conferência de feriados no checklist", responsavelId: resp, prazo: "", verificarEm: "", exigeAtualizarDocumento: "" };

  it("concluir exige ação e responsável", () => {
    expect(validarAcao({ ...base, descricao: "" }, true, ctx)).toMatchObject({ campo: "descricao" });
    expect(validarAcao({ ...base, responsavelId: "" }, true, ctx)).toMatchObject({ campo: "responsavelId" });
  });
  it("rascunho aceita campos vazios", () => {
    expect(validarAcao({ descricao: "", responsavelId: "", prazo: "", verificarEm: "" }, false, ctx)).toHaveProperty("dados");
  });
  it("verificação padrão: hoje + 30 dias", () => {
    const r = validarAcao(base, true, ctx);
    expect("dados" in r && r.dados.verificarEm).toBe(somarDias("2026-10-08", 30));
    expect(somarDias("2026-10-08", 30)).toBe("2026-11-07");
  });
  it("mantém a data de verificação escolhida", () => {
    const r = validarAcao({ ...base, verificarEm: "2026-12-01" }, true, ctx);
    expect("dados" in r && r.dados.verificarEm).toBe("2026-12-01");
  });
  it("recusa datas inválidas ou anteriores à ocorrência", () => {
    expect(validarAcao({ ...base, prazo: "2026-02-30" }, false, ctx)).toMatchObject({ campo: "prazo" });
    expect(validarAcao({ ...base, verificarEm: "2026-09-30" }, false, ctx)).toMatchObject({ campo: "verificarEm" });
  });
  it("lê o aviso de atualizar POP/checklist/modelo", () => {
    const r = validarAcao({ ...base, exigeAtualizarDocumento: "on" }, false, ctx);
    expect("dados" in r && r.dados.exigeAtualizarDocumento).toBe(true);
  });
  it("responsável precisa ser um id válido", () => {
    expect(validarAcao({ ...base, responsavelId: "Fulano" }, false, ctx)).toMatchObject({ campo: "responsavelId" });
  });
});

describe("validação da verificação", () => {
  it("exige o resultado", () => {
    expect(validarVerificacao({ evidencia: "x" })).toMatchObject({ campo: "resultado" });
  });
  it("eficaz exige evidência; ineficaz não", () => {
    expect(validarVerificacao({ resultado: "eficaz", evidencia: "" })).toMatchObject({ campo: "evidencia" });
    expect(validarVerificacao({ resultado: "eficaz", evidencia: "Três fechamentos sem atraso" })).toEqual({ resultado: "eficaz", evidencia: "Três fechamentos sem atraso" });
    expect(validarVerificacao({ resultado: "ineficaz", evidencia: "" })).toEqual({ resultado: "ineficaz", evidencia: "" });
  });
});
