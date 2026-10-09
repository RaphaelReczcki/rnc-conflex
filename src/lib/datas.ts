// Datas "AAAA-MM-DD" (colunas DATE), sem deslocamento de fuso.
export { hojeEmBrasilia } from "./rnc/codigo";

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaIso(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function paraDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
