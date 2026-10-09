import { describe, expect, it } from "vitest";
import { anoMes, formatarCodigo, hojeEmBrasilia, PADRAO_CODIGO } from "@/lib/rnc/codigo";
import { contemCpf, esquemaRegistro, lerDecimal } from "@/lib/rnc/validacao";
import { condicaoLista, lerFiltros } from "@/lib/rnc/filtros";

describe("código RNC-AAMM-XXXX", () => {
  it("formata com quatro dígitos", () => {
    expect(formatarCodigo("2610", 1)).toBe("RNC-2610-0001");
    expect(formatarCodigo("2612", 9999)).toBe("RNC-2612-9999");
    expect(PADRAO_CODIGO.test(formatarCodigo("2610", 42))).toBe(true);
  });
  it("recusa número fora da faixa e mês inválido", () => {
    expect(() => formatarCodigo("2610", 0)).toThrow();
    expect(() => formatarCodigo("2610", 10000)).toThrow(/9.999/);
    expect(() => formatarCodigo("2613", 1)).toThrow();
  });
  it("usa o mês de Brasília, não o UTC", () => {
    // 01/11/2026 01:00 UTC ainda é 31/10/2026 em Brasília
    const virada = new Date("2026-11-01T01:00:00Z");
    expect(hojeEmBrasilia(virada)).toBe("2026-10-31");
    expect(anoMes(virada)).toBe("2610");
  });
});

describe("lerDecimal", () => {
  it("aceita formatos brasileiros e com ponto", () => {
    expect(lerDecimal("1.234,56")).toBe(1234.56);
    expect(lerDecimal("1234,5")).toBe(1234.5);
    expect(lerDecimal("1234.56")).toBe(1234.56);
    expect(lerDecimal("R$ 10,00")).toBe(10);
    expect(lerDecimal("")).toBe(0);
  });
  it("recusa texto e negativos", () => {
    expect(lerDecimal("abc")).toBeNull();
    expect(lerDecimal("-5")).toBeNull();
  });
});

describe("esquema do registro", () => {
  const hoje = "2026-10-08";
  const valido = {
    setorId: "8284dbf3-1648-4cc1-82e3-107aafdac182",
    dataOcorrencia: "2026-10-07",
    cliente: "Cliente Exemplo Ltda",
    tipoProblema: "Guia paga em atraso",
    origem: "erro_interno",
    severidade: "critica",
    descricao: "DARF do IRPJ pago dois dias após o vencimento.",
    correcaoImediata: "",
    multasJuros: "152,30",
    horasRetrabalho: "1,5",
  };
  const validar = (mudanca: Record<string, string>) => esquemaRegistro(hoje).safeParse({ ...valido, ...mudanca });
  const erro = (mudanca: Record<string, string>) => {
    const r = validar(mudanca);
    return r.success ? null : r.error.issues[0].message;
  };

  it("aceita um registro completo e converte valores", () => {
    const r = validar({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.multasJuros).toBe(152.3);
      expect(r.data.horasRetrabalho).toBe(1.5);
    }
  });
  it("cliente e correção imediata são opcionais", () => {
    expect(validar({ cliente: "", correcaoImediata: "" }).success).toBe(true);
  });
  it("exige setor, tipo, origem, severidade e o que aconteceu", () => {
    expect(erro({ setorId: "" })).toMatch(/setor/);
    expect(erro({ tipoProblema: " " })).toMatch(/tipo de problema/);
    expect(erro({ origem: "" })).toMatch(/origem/);
    expect(erro({ severidade: "gravissima" })).toMatch(/severidade/);
    expect(erro({ descricao: "   " })).toMatch(/aconteceu/);
  });
  it("recusa data futura e valores inválidos", () => {
    expect(erro({ dataOcorrencia: "2026-10-09" })).toMatch(/futuro/);
    expect(validar({ dataOcorrencia: hoje }).success).toBe(true);
    expect(erro({ multasJuros: "-10" })).toMatch(/reais/);
    expect(erro({ horasRetrabalho: "duas" })).toMatch(/horas/);
  });
  it("LGPD: recusa CPF nos campos livres", () => {
    expect(contemCpf("funcionário 123.456.789-09 sem registro")).toBe(true);
    expect(contemCpf("CNPJ 12.345.678/0001-90")).toBe(false);
    expect(erro({ descricao: "Folha do funcionário CPF 123.456.789-09 errada" })).toMatch(/LGPD/);
    expect(erro({ correcaoImediata: "Corrigido para 123.456.789-09" })).toMatch(/LGPD/);
  });
});

describe("filtros da lista", () => {
  it("padrão é 'em aberto' e ignora valores inválidos", () => {
    expect(lerFiltros({})).toEqual({ q: "", etapa: "abertas", setor: "", sev: "" });
    expect(lerFiltros({ etapa: "xpto", setor: "1 OR 1=1", sev: "gravissima" })).toEqual({ q: "", etapa: "abertas", setor: "", sev: "" });
  });
  it("em aberto exclui as encerradas", () => {
    expect(condicaoLista(lerFiltros({}))).toEqual({ AND: [{ status: { not: "encerrada" } }] });
  });
  it("todas não filtra etapa", () => {
    expect(condicaoLista(lerFiltros({ etapa: "todas" }))).toEqual({});
  });
  it("combina etapa, setor e severidade", () => {
    const setor = "8284dbf3-1648-4cc1-82e3-107aafdac182";
    expect(condicaoLista(lerFiltros({ etapa: "acao", setor, sev: "alta" }))).toEqual({
      AND: [{ status: "acao" }, { setorId: setor }, { severidade: "alta" }],
    });
  });
  it("busca sem acentos por código, tipo, cliente e responsável", () => {
    const c = condicaoLista(lerFiltros({ etapa: "todas", q: "  Retificação " }));
    const or = (c.AND as { OR: unknown[] }[])[0].OR;
    expect(or).toContainEqual({ tipoProblemaNorm: { contains: "retificacao" } });
    expect(or).toContainEqual({ cliente: { nomeNormalizado: { contains: "retificacao" } } });
    expect(or).toContainEqual({ codigo: { contains: "RETIFICAÇÃO" } });
  });
});
