// Código legível RNC-AAAA-NNNN: ano do registro (horário de Brasília) e
// número sequencial dentro do ano, que recomeça em 1º de janeiro.

const partes = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "AAAA-MM-DD" de hoje (ou da data informada) em Brasília
export function hojeEmBrasilia(agora = new Date()): string {
  return partes.format(agora);
}

export function anoAtual(agora = new Date()): string {
  return hojeEmBrasilia(agora).slice(0, 4);
}

export function formatarCodigo(ano: string, numero: number): string {
  if (!/^20\d{2}$/.test(ano)) throw new Error(`Ano inválido: ${ano}`);
  if (!Number.isInteger(numero) || numero < 1 || numero > 9999) {
    throw new Error("Limite de 9.999 RNCs no ano atingido.");
  }
  return `RNC-${ano}-${String(numero).padStart(4, "0")}`;
}

// Anos 2000 a 2099: impede confundir com o formato antigo RNC-AAMM-XXXX
export const PADRAO_CODIGO = /^RNC-20\d{2}-\d{4}$/;
