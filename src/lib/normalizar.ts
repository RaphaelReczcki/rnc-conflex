// Normalização usada para detectar repetições (reincidência e problemas
// recorrentes): minúsculas, sem acentos, sem espaços nas pontas.
export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
