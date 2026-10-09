import "server-only";
import { prisma } from "@/lib/db";
import { gerarToken, hashToken } from "./tokens";

export const VALIDADE_HORAS = { convite: 7 * 24, redefinicao: 48 } as const;

export async function buscarTokenValido(token: string) {
  if (!token || token.length > 100) return null;
  const registro = await prisma.tokenSenha.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, nome: true, email: true, ativo: true } } },
  });
  if (!registro || registro.usadoEm || registro.expiraEm <= new Date() || !registro.usuario.ativo) return null;
  return registro;
}

// Cria um link de uso único e invalida os anteriores da mesma pessoa.
export async function criarLinkSenha(
  usuarioId: string,
  tipo: "convite" | "redefinicao",
  criadoPorId: string,
): Promise<{ token: string; expiraEm: Date }> {
  const { token, tokenHash } = gerarToken();
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + VALIDADE_HORAS[tipo] * 3_600_000);
  await prisma.$transaction([
    prisma.tokenSenha.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: agora } }),
    prisma.tokenSenha.create({ data: { tokenHash, tipo, usuarioId, criadoPorId, expiraEm } }),
  ]);
  return { token, expiraEm };
}
