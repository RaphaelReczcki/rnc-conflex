"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";

export type ResultadoEquipe = { ok?: string; erro?: string; campo?: string };

const esquema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da equipe.").max(80, "Nome muito longo."),
  liderId: z.uuid({ message: "Escolha o líder da equipe." }),
});

async function conferir(nome: string, liderId: string, ignorarId?: string): Promise<ResultadoEquipe | null> {
  const lider = await prisma.usuario.findUnique({ where: { id: liderId } });
  if (!lider || !lider.ativo) return { erro: "Escolha como líder alguém ativo.", campo: "liderId" };
  if (lider.perfil !== "lider_setor" && lider.perfil !== "gestao") {
    return { erro: `${lider.nome} tem perfil Colaborador. Mude o perfil para Líder de setor em Usuários antes de torná-lo líder de equipe.`, campo: "liderId" };
  }
  const mesmoNome = await prisma.equipe.findFirst({ where: { nome: { equals: nome, mode: "insensitive" }, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (mesmoNome) return { erro: `Já existe a equipe "${mesmoNome.nome}".`, campo: "nome" };
  return null;
}

export async function criarEquipe(form: FormData): Promise<ResultadoEquipe> {
  await exigirGestao();
  const d = esquema.safeParse({ nome: form.get("nome") ?? "", liderId: form.get("liderId") ?? "" });
  if (!d.success) return { erro: d.error.issues[0].message, campo: String(d.error.issues[0].path[0]) };
  const problema = await conferir(d.data.nome, d.data.liderId);
  if (problema) return problema;
  await prisma.equipe.create({ data: d.data });
  revalidatePath("/admin/equipes");
  return { ok: `Equipe ${d.data.nome} criada. Agora coloque as pessoas nela em Usuários → Editar.` };
}

export async function editarEquipe(form: FormData): Promise<ResultadoEquipe> {
  await exigirGestao();
  const id = String(form.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return { erro: "Equipe não encontrada." };
  const d = esquema.safeParse({ nome: form.get("nome") ?? "", liderId: form.get("liderId") ?? "" });
  if (!d.success) return { erro: d.error.issues[0].message, campo: String(d.error.issues[0].path[0]) };
  const problema = await conferir(d.data.nome, d.data.liderId, id);
  if (problema) return problema;
  const ativo = form.get("ativo") === "on";
  await prisma.equipe.update({ where: { id }, data: { ...d.data, ativo } });
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/usuarios");
  return { ok: `Equipe ${d.data.nome} atualizada.${ativo ? "" : " Inativa: o líder deixa de ver as RNCs dessas pessoas pela equipe."}` };
}
