// Quais RNCs cada pessoa vê.
// - Gestão: todas.
// - Líder de setor: as do seu setor, as das pessoas das equipes que lidera
//   (registradas por elas ou com ação delas, em qualquer setor) e as próprias.
// - Colaborador: só as próprias (registradas por ele ou com ação dele).
// Quem pode preencher e concluir cada etapa continua em permissoes.ts.
import type { Prisma } from "@/generated/prisma/client";
import type { UsuarioAcesso } from "@/lib/auth/permissoes";

// Filtro que nenhuma RNC atende (pessoa desativada)
const NENHUMA: Prisma.RncWhereInput = { id: { in: [] } };

const daPessoa = (ids: string[]): Prisma.RncWhereInput[] => [{ autorId: { in: ids } }, { acoes: { some: { responsavelId: { in: ids } } } }];

export function escopoRncs(u: UsuarioAcesso | null | undefined, membrosDaEquipe: string[] = []): Prisma.RncWhereInput {
  if (!u || !u.ativo) return NENHUMA;
  if (u.perfil === "gestao") return {};
  if (u.perfil === "lider_setor") {
    const pessoas = [u.id, ...membrosDaEquipe.filter((id) => id !== u.id)];
    return { OR: [...(u.setorId ? [{ setorId: u.setorId }] : []), ...daPessoa(pessoas)] };
  }
  return { OR: daPessoa([u.id]) };
}

// Mesma regra, para uma RNC já carregada (ex.: página de detalhe).
export function podeVerRnc(
  u: UsuarioAcesso | null | undefined,
  rnc: { setorId: string; autorId: string; responsaveis: (string | null)[] },
  membrosDaEquipe: string[] = [],
): boolean {
  if (!u || !u.ativo) return false;
  if (u.perfil === "gestao") return true;
  const pessoas = new Set([u.id, ...(u.perfil === "lider_setor" ? membrosDaEquipe : [])]);
  if (u.perfil === "lider_setor" && u.setorId === rnc.setorId) return true;
  return pessoas.has(rnc.autorId) || rnc.responsaveis.some((r) => r !== null && pessoas.has(r));
}
