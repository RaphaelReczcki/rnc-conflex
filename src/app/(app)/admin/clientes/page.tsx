import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";
import { Clientes } from "./Clientes";

export const metadata: Metadata = { title: "Clientes" };

export default async function PaginaClientes() {
  await exigirGestao();
  const clientes = await prisma.cliente.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { rncs: true } } },
  });
  return (
    <Clientes
      lista={clientes.map((c) => ({
        id: c.id,
        nome: c.nome,
        nomeNormalizado: c.nomeNormalizado,
        codigoInterno: c.codigoInterno,
        cnpj: c.cnpj,
        ativo: c.ativo,
        rncs: c._count.rncs,
      }))}
    />
  );
}
