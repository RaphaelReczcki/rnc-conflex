import { createHash, randomBytes } from "node:crypto";

// Token aleatório de 256 bits. Só o hash vai para o banco.
export function gerarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const BLOQUEIO_TENTATIVAS = 5;
export const BLOQUEIO_MINUTOS = 15;

// Após 5 senhas erradas seguidas, bloqueia por 15 minutos.
export function registrarFalha(tentativas: number, agora = new Date()): { tentativasFalhas: number; bloqueadoAte: Date | null } {
  const total = tentativas + 1;
  if (total >= BLOQUEIO_TENTATIVAS) {
    return { tentativasFalhas: 0, bloqueadoAte: new Date(agora.getTime() + BLOQUEIO_MINUTOS * 60_000) };
  }
  return { tentativasFalhas: total, bloqueadoAte: null };
}
