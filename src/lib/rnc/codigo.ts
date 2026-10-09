// Código legível RNC-AAMM-XXXX. O mês é o do registro, no horário de Brasília.

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

export function anoMes(agora = new Date()): string {
  const [ano, mes] = hojeEmBrasilia(agora).split("-");
  return ano.slice(2) + mes;
}

export function formatarCodigo(anoMesAtual: string, numero: number): string {
  if (!/^\d{2}(0[1-9]|1[0-2])$/.test(anoMesAtual)) throw new Error(`Ano/mês inválido: ${anoMesAtual}`);
  if (!Number.isInteger(numero) || numero < 1 || numero > 9999) {
    throw new Error("Limite de 9.999 RNCs no mês atingido.");
  }
  return `RNC-${anoMesAtual}-${String(numero).padStart(4, "0")}`;
}

export const PADRAO_CODIGO = /^RNC-\d{2}(0[1-9]|1[0-2])-\d{4}$/;
