import { randomInt } from "node:crypto";

// Senha provisória para a gestão repassar (padrão do e-LALUR): letras
// minúsculas sem as que se confundem (i, l, o) + 2 dígitos. A pessoa troca
// no primeiro acesso. 10 caracteres, o mínimo de senha do sistema.
const LETRAS = "abcdefghjkmnpqrstuvwxyz";

export function gerarSenhaProvisoria(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += LETRAS[randomInt(LETRAS.length)];
  return s + String(randomInt(10, 100));
}
