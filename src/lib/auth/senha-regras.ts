// Regras de senha sem dependências de servidor (usadas também no navegador).
export const SENHA_MIN = 10;
export const SENHA_MAX = 200;

// Devolve a mensagem de erro, ou null se a senha serve.
export function validarSenha(senha: string, email?: string): string | null {
  if (senha.length < SENHA_MIN) return `A senha precisa ter ao menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (/^(.)\1*$/.test(senha)) return "Evite repetir o mesmo caractere. Uma frase curta funciona bem.";
  const usuarioEmail = email?.toLowerCase().split("@")[0];
  if (usuarioEmail && usuarioEmail.length >= 3 && senha.toLowerCase().includes(usuarioEmail)) {
    return "A senha não pode conter o seu e-mail.";
  }
  return null;
}
