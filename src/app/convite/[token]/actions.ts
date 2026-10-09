"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { criarSessao, encerrarSessoesDoUsuario } from "@/lib/auth/sessao";
import { gerarHashSenha, validarSenha } from "@/lib/auth/senha";
import { buscarTokenValido } from "@/lib/auth/convites";
import type { EstadoSenha } from "@/components/FormSenha";

export async function definirSenha(_anterior: EstadoSenha, form: FormData): Promise<EstadoSenha> {
  const token = String(form.get("token") ?? "");
  const nova = String(form.get("nova") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");

  const registro = await buscarTokenValido(token);
  if (!registro) return { erro: "Este link não vale mais. Peça um novo à gestão da qualidade." };
  if (nova !== confirmacao) return { erro: "As duas senhas estão diferentes." };
  const problema = validarSenha(nova, registro.usuario.email);
  if (problema) return { erro: problema };

  const agora = new Date();
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: {
        senhaHash: await gerarHashSenha(nova),
        deveTrocarSenha: false,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ultimoAcessoEm: agora,
      },
    }),
    // Este link e qualquer outro pendente da mesma pessoa deixam de valer
    prisma.tokenSenha.updateMany({
      where: { usuarioId: registro.usuarioId, usadoEm: null },
      data: { usadoEm: agora },
    }),
  ]);
  await encerrarSessoesDoUsuario(registro.usuarioId);
  await criarSessao(registro.usuarioId);
  redirect("/");
}
