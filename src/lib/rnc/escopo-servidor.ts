import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { UsuarioAcesso } from "@/lib/auth/permissoes";
import { escopoRncs } from "./escopo";

// Pessoas das equipes ativas lideradas por este usuário (só para líder de setor).
export const membrosDasEquipes = cache(async (u: UsuarioAcesso): Promise<string[]> => {
  if (u.perfil !== "lider_setor" || !u.ativo) return [];
  const membros = await prisma.usuario.findMany({ where: { equipe: { liderId: u.id, ativo: true } }, select: { id: true } });
  return membros.map((m) => m.id);
});

export async function escopoDoUsuario(u: UsuarioAcesso) {
  return escopoRncs(u, await membrosDasEquipes(u));
}
