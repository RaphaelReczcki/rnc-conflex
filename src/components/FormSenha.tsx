"use client";

import { useActionState } from "react";
import { SENHA_MIN } from "@/lib/auth/senha-regras";

export type EstadoSenha = { erro?: string; ok?: string };

type Props = {
  acao: (anterior: EstadoSenha, form: FormData) => Promise<EstadoSenha>;
  pedirSenhaAtual?: boolean;
  token?: string;
  textoBotao: string;
};

export function FormSenha({ acao, pedirSenhaAtual, token, textoBotao }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoSenha, FormData>(acao, {});
  return (
    <form action={enviar} noValidate>
      {token && <input type="hidden" name="token" value={token} />}
      {pedirSenhaAtual && (
        <div className="field">
          <label htmlFor="atual">Senha atual</label>
          <input id="atual" name="atual" type="password" autoComplete="current-password" required />
        </div>
      )}
      <div className="field">
        <label htmlFor="nova">Nova senha</label>
        <input id="nova" name="nova" type="password" autoComplete="new-password" minLength={SENHA_MIN} required />
        <small>Ao menos {SENHA_MIN} caracteres. Uma frase curta é fácil de lembrar e difícil de adivinhar.</small>
      </div>
      <div className="field">
        <label htmlFor="confirmacao">Repita a nova senha</label>
        <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
      </div>
      {estado.erro && (
        <p className="err" role="alert">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="notice ok" role="status">
          {estado.ok}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={enviando}>
          {enviando ? "Salvando…" : textoBotao}
        </button>
      </div>
    </form>
  );
}
