// CSV para abrir direto no Excel em português: separador ";", BOM UTF-8,
// quebras de linha CRLF e todas as células entre aspas.

// Um valor que começa com = + - @ (ou tab/CR) seria lido pelo Excel como
// fórmula: um texto digitado por alguém poderia virar um comando na planilha
// de quem exporta. O apóstrofo na frente faz o Excel tratá-lo como texto.
const INICIO_PERIGOSO = /^[=+\-@\t\r]/;

export type ValorCsv = string | number | null | undefined;

export function celulaCsv(valor: ValorCsv): string {
  let texto = valor == null ? "" : String(valor);
  if (INICIO_PERIGOSO.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function gerarCsv(cabecalho: string[], linhas: ValorCsv[][]): string {
  const todas = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";"));
  return "﻿" + todas.join("\r\n") + "\r\n";
}

// Número no formato que o Excel em pt-BR reconhece: vírgula decimal, sem milhar.
export function numeroCsv(n: number | null | undefined, casas = 2): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toFixed(casas).replace(".", ",");
}
