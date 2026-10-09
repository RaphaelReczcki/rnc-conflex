"use client";

import { useActionState } from "react";
import { enviarTeste, reenviarFalhas, rodarRotinaAgora, type EstadoNotificacoes } from "./actions";

function Botao({ acao, rotulo, classe = "btn small" }: { acao: () => Promise<EstadoNotificacoes>; rotulo: string; classe?: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoNotificacoes>(acao, {});
  return (
    <form action={enviar} className="botao-notificacao">
      <button type="submit" className={classe} disabled={enviando}>
        {enviando ? "Aguarde…" : rotulo}
      </button>
      {estado.ok && (
        <span className="salvo" role="status">
          {estado.ok}
        </span>
      )}
      {estado.erro && (
        <span className="err" role="alert">
          {estado.erro}
        </span>
      )}
    </form>
  );
}

export function BotoesNotificacoes({ falhas }: { falhas: number }) {
  return (
    <div className="linha-acoes" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <Botao acao={enviarTeste} rotulo="Enviar um e-mail de teste para mim" classe="btn small primary" />
      <Botao acao={rodarRotinaAgora} rotulo="Rodar a rotina diária agora" />
      {falhas > 0 && <Botao acao={reenviarFalhas} rotulo={`Tentar de novo as ${falhas} com falha`} />}
    </div>
  );
}
