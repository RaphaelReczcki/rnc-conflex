import { describe, expect, it } from "vitest";
import { celulaCsv, gerarCsv, numeroCsv } from "@/lib/csv";

describe("célula do CSV", () => {
  it("sempre entre aspas, com aspas internas dobradas", () => {
    expect(celulaCsv("Guia paga em atraso")).toBe('"Guia paga em atraso"');
    expect(celulaCsv('Cliente "Exemplo"')).toBe('"Cliente ""Exemplo"""');
  });
  it("vazio e nulo viram célula vazia", () => {
    expect(celulaCsv("")).toBe('""');
    expect(celulaCsv(null)).toBe('""');
    expect(celulaCsv(undefined)).toBe('""');
  });
  it("mantém ponto e vírgula e quebra de linha dentro da célula", () => {
    expect(celulaCsv("a; b")).toBe('"a; b"');
    expect(celulaCsv("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });
  it("protege contra injeção de fórmula: = + - @ ganham apóstrofo", () => {
    expect(celulaCsv("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(celulaCsv("+55 11 99999")).toBe('"\'+55 11 99999"');
    expect(celulaCsv("-2+3")).toBe('"\'-2+3"');
    expect(celulaCsv("@SOMA(A1)")).toBe('"\'@SOMA(A1)"');
  });
  it("também protege tab e retorno de carro no início", () => {
    expect(celulaCsv("\t=1")).toBe('"\'\t=1"');
    expect(celulaCsv("\r=1")).toBe('"\'\r=1"');
  });
  it("não mexe em texto comum nem em sinais no meio", () => {
    expect(celulaCsv("Erro = atraso")).toBe('"Erro = atraso"');
    expect(celulaCsv("RNC-2610-0001")).toBe('"RNC-2610-0001"');
  });
});

describe("arquivo CSV", () => {
  it("começa com BOM UTF-8, separa por ; e usa CRLF", () => {
    const csv = gerarCsv(["Código", "Severidade"], [["RNC-2610-0001", "Crítica"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('"Código";"Severidade"\r\n"RNC-2610-0001";"Crítica"\r\n');
  });
  it("só cabeçalho quando não há linhas", () => {
    expect(gerarCsv(["A"], []).slice(1)).toBe('"A"\r\n');
  });
});

describe("números", () => {
  it("vírgula decimal, sem separador de milhar", () => {
    expect(numeroCsv(1234.5)).toBe("1234,50");
    expect(numeroCsv(0)).toBe("0,00");
    expect(numeroCsv(2.5, 1)).toBe("2,5");
    expect(numeroCsv(null)).toBe("");
  });
});
