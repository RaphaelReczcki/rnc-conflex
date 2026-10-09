// Formatação para a interface: datas dd/mm/aaaa (horário de Brasília) e R$.
const FUSO = "America/Sao_Paulo";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarData(d: Date | string | null | undefined): string {
  if (!d) return "";
  const data = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  return Number.isNaN(data.getTime()) ? "" : fmtData.format(data);
}

export function formatarDataHora(d: Date | null | undefined): string {
  return d && !Number.isNaN(d.getTime()) ? fmtDataHora.format(d).replace(",", " às") : "";
}

export function formatarMoeda(valor: number | string | { toString(): string } | null | undefined): string {
  const n = Number(valor?.toString() ?? 0);
  return fmtMoeda.format(Number.isFinite(n) ? n : 0);
}
