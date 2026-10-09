// CNPJ numérico e alfanumérico (IN RFB 2.229/2024, vigente desde julho/2026).
// Mesma regra do sistema e-LALUR: as 12 primeiras posições podem ser [0-9A-Z];
// os dois dígitos verificadores são sempre numéricos. O valor de cada
// caractere é o código ASCII menos 48 (dígitos mantêm o valor; 'A' = 17...).

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizarCnpj(valor: string | null | undefined): string {
  return (valor ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function digito(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += (base.charCodeAt(i) - 48) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCnpj(valor: string | null | undefined): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const dv1 = digito(cnpj.slice(0, 12), PESOS_DV1);
  const dv2 = digito(cnpj.slice(0, 12) + dv1, PESOS_DV2);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

export function formatarCnpj(valor: string | null | undefined): string {
  const c = normalizarCnpj(valor);
  if (c.length !== 14) return valor ?? "";
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

// Máscara progressiva enquanto a pessoa digita.
export function mascararCnpj(valor: string): string {
  const c = normalizarCnpj(valor).slice(0, 14);
  let out = "";
  for (let i = 0; i < c.length; i++) {
    if (i === 2 || i === 5) out += ".";
    if (i === 8) out += "/";
    if (i === 12) out += "-";
    out += c[i];
  }
  return out;
}
