import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";
import { Equipes } from "./Equipes";

export const metadata: Metadata = { title: "Equipes" };

export default async function PaginaEquipes() {
  await exigirGestao();
  const [equipes, lideres] = await Promise.all([
    prisma.equipe.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { lider: { select: { nome: true } }, membros: { where: { ativo: true }, orderBy: { nome: "asc" }, select: { nome: true } } },
    }),
    prisma.usuario.findMany({
      where: { ativo: true, perfil: { in: ["lider_setor", "gestao"] } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, perfil: true, setor: { select: { nome: true } } },
    }),
  ]);
  return (
    <Equipes
      lista={equipes.map((e) => ({ id: e.id, nome: e.nome, liderId: e.liderId, lider: e.lider.nome, ativo: e.ativo, membros: e.membros.map((m) => m.nome) }))}
      lideres={lideres.map((l) => ({ id: l.id, nome: l.nome, perfil: l.perfil, setor: l.setor?.nome ?? null }))}
    />
  );
}
