"use server";

import { after } from "next/server";
import { z } from "zod";
import { MENSAGEM_PEDIDO, solicitarRedefinicao } from "@/lib/auth/recuperacao";

export type EstadoPedido = { ok?: string; erro?: string; email?: string };

export async function pedirNovaSenha(_anterior: EstadoPedido, form: FormData): Promise<EstadoPedido> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { erro: "Informe um e-mail válido.", email };
  // O envio acontece depois da resposta: o tempo de resposta é o mesmo
  // exista ou não o e-mail, e a mensagem também.
  after(() => solicitarRedefinicao(email).catch((e) => console.error("[esqueci a senha]", e instanceof Error ? e.message : e)));
  return { ok: MENSAGEM_PEDIDO };
}
