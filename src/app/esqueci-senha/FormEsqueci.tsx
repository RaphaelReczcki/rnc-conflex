"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pedirNovaSenha, type EstadoPedido } from "./actions";

export function FormEsqueci() {
  const [estado, acao, enviando] = useActionState<EstadoPedido, FormData>(pedirNovaSenha, {});
  if (estado.ok) {
    return (
      <>
        <p className="notice ok" role="status">
          {estado.ok}
        </p>
        <p className="ajuda">
          O link vale por 1 hora e só pode ser usado uma vez. Pedir de novo cancela o link anterior. Se não chegar em alguns minutos, peça um link à
          gestão da qualidade.
        </p>
        <p className="ajuda">
          <Link href="/login">← Voltar para a entrada</Link>
        </p>
      </>
    );
  }
  return (
    <form action={acao} noValidate>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={estado.email} autoFocus />
      </div>
      {estado.erro && (
        <p className="err" role="alert">
          {estado.erro}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar link por e-mail"}
        </button>
      </div>
      <p className="ajuda">
        <Link href="/login">← Voltar para a entrada</Link>
      </p>
    </form>
  );
}
