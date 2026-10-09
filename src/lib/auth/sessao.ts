import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { gerarToken, hashToken } from "./tokens";
import { ehGestao } from "./permissoes";

const COOKIE = "rnc_sessao";

function horasSessao(): number {
  const h = Number(process.env.SESSAO_HORAS);
  return Number.isFinite(h) && h > 0 ? h : 12;
}

// Só pode ser chamada em Server Actions ou Route Handlers (grava cookie).
export async function criarSessao(usuarioId: string): Promise<void> {
  const { token, tokenHash } = gerarToken();
  const expiraEm = new Date(Date.now() + horasSessao() * 3_600_000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 400) ?? null;
  await prisma.sessao.create({ data: { tokenHash, usuarioId, expiraEm, userAgent } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.sessao.updateMany({
      where: { tokenHash: hashToken(token), encerradaEm: null },
      data: { encerradaEm: new Date() },
    });
  }
  jar.delete(COOKIE);
}

// Encerra todas as sessões da pessoa (troca de senha, desativação).
export async function encerrarSessoesDoUsuario(usuarioId: string, excetoAtual = false): Promise<void> {
  let exceto: string | undefined;
  if (excetoAtual) {
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) exceto = hashToken(token);
  }
  await prisma.sessao.updateMany({
    where: { usuarioId, encerradaEm: null, ...(exceto ? { tokenHash: { not: exceto } } : {}) },
    data: { encerradaEm: new Date() },
  });
}

export const obterUsuarioAtual = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { include: { setor: true } } },
  });
  if (!sessao || sessao.encerradaEm || sessao.expiraEm <= new Date() || !sessao.usuario.ativo) return null;
  return sessao.usuario;
});

export type UsuarioLogado = NonNullable<Awaited<ReturnType<typeof obterUsuarioAtual>>>;

export async function exigirUsuario(opcoes: { permitirTrocaPendente?: boolean } = {}): Promise<UsuarioLogado> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.deveTrocarSenha && !opcoes.permitirTrocaPendente) redirect("/conta/senha");
  return usuario;
}

export async function exigirGestao(): Promise<UsuarioLogado> {
  const usuario = await exigirUsuario();
  if (!ehGestao(usuario)) redirect("/");
  return usuario;
}
