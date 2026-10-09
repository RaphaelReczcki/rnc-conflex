"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encerrarSessoesDoUsuario, exigirUsuario } from "@/lib/auth/sessao";
import { gerarHashSenha, validarSenha, verificarSenha } from "@/lib/auth/senha";
import type { EstadoSenha } from "@/components/FormSenha";

export async function trocarSenha(_anterior: EstadoSenha, form: FormData): Promise<EstadoSenha> {
  const usuario = await exigirUsuario({ permitirTrocaPendente: true });
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");

  if (!(await verificarSenha(usuario.senhaHash, atual))) return { erro: "A senha atual não confere." };
  if (nova !== confirmacao) return { erro: "As duas senhas novas estão diferentes." };
  if (nova === atual) return { erro: "Escolha uma senha diferente da atual." };
  const problema = validarSenha(nova, usuario.email);
  if (problema) return { erro: problema };

  const estavaPendente = usuario.deveTrocarSenha;
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await gerarHashSenha(nova), deveTrocarSenha: false },
  });
  // Sessões abertas em outros aparelhos deixam de valer
  await encerrarSessoesDoUsuario(usuario.id, true);

  if (estavaPendente) redirect("/");
  return { ok: "Senha trocada. As sessões abertas em outros aparelhos foram encerradas." };
}
