import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth/sessao";
import { hojeEmBrasilia } from "@/lib/rnc/codigo";
import { FormRegistro } from "./FormRegistro";

export const metadata: Metadata = { title: "Registrar RNC" };

export default async function Registrar() {
  const usuario = await exigirUsuario();
  const [setores, categorias, tiposUsados, clientes] = await Promise.all([
    prisma.setor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    prisma.categoria.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { nome: true, nomeNormalizado: true } }),
    // Tipos digitados antes que não são categorias: também viram sugestão
    prisma.rnc.findMany({ where: { categoriaId: null }, distinct: ["tipoProblemaNorm"], select: { tipoProblema: true }, take: 200 }),
    prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { nome: true }, take: 2000 }),
  ]);

  const sugestoes = [...categorias.map((c) => c.nome), ...tiposUsados.map((t) => t.tipoProblema)];

  return (
    <FormRegistro
      setores={setores}
      categorias={[...new Set(sugestoes)]}
      clientes={clientes.map((c) => c.nome)}
      setorPadrao={usuario.setor?.ativo ? usuario.setor.id : ""}
      hoje={hojeEmBrasilia()}
    />
  );
}
