import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";
import { formatarDataHora } from "@/lib/formato";
import { Usuarios } from "./Usuarios";

export const metadata: Metadata = { title: "Usuários" };

async function endereco(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

export default async function PaginaUsuarios() {
  const gestor = await exigirGestao();
  const [usuarios, setores] = await Promise.all([
    prisma.usuario.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }], include: { setor: { select: { nome: true } } } }),
    prisma.setor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <Usuarios
      meuId={gestor.id}
      endereco={await endereco()}
      setores={setores}
      lista={usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        setorId: u.setorId,
        setor: u.setor?.nome ?? null,
        ativo: u.ativo,
        deveTrocarSenha: u.deveTrocarSenha,
        ultimoAcesso: u.ultimoAcessoEm ? formatarDataHora(u.ultimoAcessoEm) : null,
      }))}
    />
  );
}
