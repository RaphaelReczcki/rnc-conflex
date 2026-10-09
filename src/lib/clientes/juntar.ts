import "server-only";
import { prisma } from "@/lib/db";

export type ResultadoJuncao = { ok: true; origem: string; destino: string; rncs: number } | { ok: false; erro: string };

// Junta um cadastro duplicado no certo: as RNCs passam para o destino, cada
// uma ganha um registro no histórico, e o duplicado é removido.
export async function juntarClientes(usuarioId: string, origemId: string, destinoId: string): Promise<ResultadoJuncao> {
  if (origemId === destinoId) return { ok: false, erro: "Escolha um cliente diferente." };
  return prisma.$transaction(async (tx) => {
    const [origem, destino] = await Promise.all([tx.cliente.findUnique({ where: { id: origemId } }), tx.cliente.findUnique({ where: { id: destinoId } })]);
    if (!origem || !destino) return { ok: false as const, erro: "Cliente não encontrado." };
    const rncs = await tx.rnc.findMany({ where: { clienteId: origemId }, select: { id: true, reaberturas: true } });
    for (const r of rncs) {
      await tx.historico.create({
        data: {
          rncId: r.id,
          tipo: "edicao",
          texto: `Cliente corrigido de "${origem.nome}" para "${destino.nome}"`,
          ciclo: r.reaberturas + 1,
          usuarioId,
          dados: { clienteAnterior: { id: origem.id, nome: origem.nome }, clienteNovo: { id: destino.id, nome: destino.nome } },
        },
      });
    }
    await tx.rnc.updateMany({ where: { clienteId: origemId }, data: { clienteId: destinoId } });
    // Leva o código interno e o CNPJ, se só o duplicado tinha
    const levar = {
      ...(!destino.codigoInterno && origem.codigoInterno ? { codigoInterno: origem.codigoInterno } : {}),
      ...(!destino.cnpj && origem.cnpj ? { cnpj: origem.cnpj } : {}),
    };
    if (Object.keys(levar).length) {
      // Libera os valores únicos no duplicado antes de passar para o certo
      await tx.cliente.update({ where: { id: origemId }, data: Object.fromEntries(Object.keys(levar).map((k) => [k, null])) });
      await tx.cliente.update({ where: { id: destinoId }, data: levar });
    }
    await tx.cliente.delete({ where: { id: origemId } });
    return { ok: true as const, origem: origem.nome, destino: destino.nome, rncs: rncs.length };
  });
}
