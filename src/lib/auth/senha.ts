import { hash, verify } from "@node-rs/argon2";

export { SENHA_MIN, SENHA_MAX, validarSenha } from "./senha-regras";

export function gerarHashSenha(senha: string): Promise<string> {
  return hash(senha);
}

// Hash de uma senha qualquer, usado quando o e-mail não existe para que a
// resposta demore o mesmo tempo e não revele quais e-mails estão cadastrados.
let hashFicticio: Promise<string> | null = null;

export async function verificarSenha(senhaHash: string | null, senha: string): Promise<boolean> {
  if (!senhaHash) {
    hashFicticio ??= hash("senha-ficticia-para-tempo-constante");
    await verify(await hashFicticio, senha).catch(() => false);
    return false;
  }
  return verify(senhaHash, senha).catch(() => false);
}
