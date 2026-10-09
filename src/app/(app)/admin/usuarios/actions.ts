"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encerrarSessoesDoUsuario, exigirGestao } from "@/lib/auth/sessao";
import { gerarHashSenha } from "@/lib/auth/senha";
import { gerarSenhaProvisoria } from "@/lib/auth/senha-provisoria";
import { emailPermitido } from "@/lib/auth/tokens";
import { ErroPlanilha, lerPlanilha } from "@/lib/importacao/planilha";
import type { LinhaAnalisada } from "@/lib/importacao/usuarios";
import { analisarPlanilhaUsuarios, importarUsuarios, resumir, type ResumoImportacao } from "@/lib/importacao/importar-usuarios";

// Resultado de criar ou redefinir: a senha provisória volta uma única vez,
// para a gestão repassar. No banco fica só o hash.
export type ResultadoUsuario = { ok?: string; erro?: string; campo?: string; credencial?: { nome: string; email: string; senha: string } };

const esquema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
    email: z.string().trim().toLowerCase().pipe(z.email({ message: "Informe um e-mail válido." })),
    perfil: z.enum(["colaborador", "lider_setor", "gestao"], { message: "Escolha o perfil." }),
    setorId: z
      .string()
      .trim()
      .transform((v) => v || null)
      .pipe(z.uuid({ message: "Escolha o setor na lista." }).nullable()),
  })
  .refine((d) => d.perfil !== "lider_setor" || d.setorId, { message: "Líder de setor precisa de um setor.", path: ["setorId"] })
  .refine((d) => emailPermitido(d.email), { message: "Use o e-mail corporativo da Conflex.", path: ["email"] });

function lerForm(form: FormData) {
  return esquema.safeParse({
    nome: form.get("nome") ?? "",
    email: form.get("email") ?? "",
    perfil: form.get("perfil") ?? "",
    setorId: form.get("setorId") ?? "",
  });
}

const erroDe = (e: z.ZodError): ResultadoUsuario => ({ erro: e.issues[0]?.message ?? "Confira os campos.", campo: String(e.issues[0]?.path[0] ?? "") });

export async function criarUsuario(form: FormData): Promise<ResultadoUsuario> {
  await exigirGestao();
  const dados = lerForm(form);
  if (!dados.success) return erroDe(dados.error);
  if (await prisma.usuario.findUnique({ where: { email: dados.data.email } })) {
    return { erro: "Já existe um usuário com este e-mail.", campo: "email" };
  }
  const senha = gerarSenhaProvisoria();
  const u = await prisma.usuario.create({ data: { ...dados.data, senhaHash: await gerarHashSenha(senha), deveTrocarSenha: true } });
  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${u.nome} criado. A senha provisória está no quadro "Senhas provisórias para repassar".`, credencial: { nome: u.nome, email: u.email, senha } };
}

export async function editarUsuario(form: FormData): Promise<ResultadoUsuario> {
  const gestor = await exigirGestao();
  const id = String(form.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return { erro: "Usuário não encontrado." };
  const dados = lerForm(form);
  if (!dados.success) return erroDe(dados.error);
  const ativo = form.get("ativo") === "on";

  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) return { erro: "Usuário não encontrado." };
  if (id === gestor.id && (dados.data.perfil !== "gestao" || !ativo)) {
    return { erro: "Você não pode tirar o seu próprio acesso de gestão nem se desativar. Peça a outra pessoa da gestão." };
  }
  const outro = await prisma.usuario.findUnique({ where: { email: dados.data.email } });
  if (outro && outro.id !== id) return { erro: "Já existe um usuário com este e-mail.", campo: "email" };

  await prisma.usuario.update({ where: { id }, data: { ...dados.data, ativo } });
  const desativou = atual.ativo && !ativo;
  if (desativou) await encerrarSessoesDoUsuario(id);
  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${dados.data.nome} atualizado.${desativou ? " As sessões abertas foram encerradas." : ""}` };
}

export async function redefinirSenha(form: FormData): Promise<ResultadoUsuario> {
  const gestor = await exigirGestao();
  const id = String(form.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return { erro: "Usuário não encontrado." };
  if (id === gestor.id) return { erro: "Para a sua própria senha, use \"Alterar senha\"." };
  const u = await prisma.usuario.findUnique({ where: { id } });
  if (!u) return { erro: "Usuário não encontrado." };
  if (!u.ativo) return { erro: "Reative o usuário antes de redefinir a senha." };

  const senha = gerarSenhaProvisoria();
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id },
      data: { senhaHash: await gerarHashSenha(senha), deveTrocarSenha: true, tentativasFalhas: 0, bloqueadoAte: null },
    }),
    // Links de senha antigos deixam de valer
    prisma.tokenSenha.updateMany({ where: { usuarioId: id, usadoEm: null }, data: { usadoEm: new Date() } }),
  ]);
  await encerrarSessoesDoUsuario(id);
  revalidatePath("/admin/usuarios");
  return { ok: `Senha de ${u.nome} redefinida. A nova senha provisória está no quadro abaixo.`, credencial: { nome: u.nome, email: u.email, senha } };
}

// ---------- Importação por planilha ----------

export type ResultadoImportacao = {
  erro?: string;
  linhas?: LinhaAnalisada[];
  resumo?: ResumoImportacao;
  credenciais?: { nome: string; email: string; senha: string }[];
  importado?: boolean;
};

async function lerArquivo(form: FormData): Promise<string[][] | { erro: string }> {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return { erro: "Escolha um arquivo." };
  try {
    return await lerPlanilha(arquivo);
  } catch (e) {
    if (e instanceof ErroPlanilha) return { erro: e.message };
    throw e;
  }
}

// Prévia: valida a planilha e mostra o que vai acontecer, sem gravar nada.
export async function analisarImportacao(form: FormData): Promise<ResultadoImportacao> {
  const gestor = await exigirGestao();
  const linhas = await lerArquivo(form);
  if ("erro" in linhas) return linhas;
  const r = await analisarPlanilhaUsuarios(linhas, gestor.email, form.get("atualizar") === "on");
  if (r.erroGeral) return { erro: r.erroGeral };
  return { linhas: r.linhas, resumo: resumir(r.linhas) };
}

export async function executarImportacao(form: FormData): Promise<ResultadoImportacao> {
  const gestor = await exigirGestao();
  const linhas = await lerArquivo(form);
  if ("erro" in linhas) return linhas;
  const r = await importarUsuarios(linhas, gestor.email, form.get("atualizar") === "on");
  if (r.erroGeral) return { erro: r.erroGeral };
  revalidatePath("/admin/usuarios");
  return { linhas: r.linhas, resumo: r.resumo, credenciais: r.credenciais, importado: true };
}
