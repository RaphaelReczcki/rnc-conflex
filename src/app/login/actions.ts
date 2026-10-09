"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { criarSessao, encerrarSessao } from "@/lib/auth/sessao";
import { verificarSenha } from "@/lib/auth/senha";
import { registrarFalha } from "@/lib/auth/tokens";

export type EstadoLogin = { erro?: string; email?: string };

const esquema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  senha: z.string().min(1).max(200),
});

const ERRO_GENERICO = "E-mail ou senha não conferem. Confira e tente de novo.";

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const dados = esquema.safeParse({ email: form.get("email"), senha: form.get("senha") });
  if (!dados.success) return { erro: "Informe o e-mail e a senha." };
  const { email, senha } = dados.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const agora = new Date();

  if (usuario?.bloqueadoAte && usuario.bloqueadoAte > agora) {
    return { email, erro: "Por segurança, o acesso foi pausado após várias tentativas. Tente de novo em 15 minutos." };
  }

  const ok = await verificarSenha(usuario?.ativo ? usuario.senhaHash : null, senha);
  if (!usuario || !usuario.ativo || !ok) {
    if (usuario?.ativo && usuario.senhaHash) {
      await prisma.usuario.update({ where: { id: usuario.id }, data: registrarFalha(usuario.tentativasFalhas, agora) });
    }
    return { email, erro: ERRO_GENERICO };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoAcessoEm: agora },
  });
  await criarSessao(usuario.id);

  redirect(usuario.deveTrocarSenha ? "/conta/senha" : "/");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
