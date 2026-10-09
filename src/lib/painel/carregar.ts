import "server-only";
import { prisma } from "@/lib/db";
import { diaIso } from "@/lib/datas";
import { inicioDaCarga, type LinhaPainel, type Periodo } from "./indicadores";

// Carrega as RNCs que o período precisa, mais tudo o que ainda está em aberto.
export async function carregarLinhasPainel(periodo: Periodo, setorId?: string): Promise<LinhaPainel[]> {
  const brutas = await prisma.rnc.findMany({
    where: {
      ...(setorId ? { setorId } : {}),
      OR: [{ criadaEm: { gte: inicioDaCarga(periodo) } }, { status: { not: "encerrada" } }, { encerradaEm: { gte: periodo.inicio } }],
    },
    select: {
      codigo: true,
      setorId: true,
      tipoProblema: true,
      tipoProblemaNorm: true,
      origem: true,
      severidade: true,
      status: true,
      reaberturas: true,
      criadaEm: true,
      encerradaEm: true,
      multasJuros: true,
      horasRetrabalho: true,
      acoes: { orderBy: { ciclo: "desc" }, take: 1, select: { ciclo: true, prazo: true, verificarEm: true } },
    },
  });
  return brutas.map(({ acoes, multasJuros, horasRetrabalho, ...r }) => {
    // Só vale a ação do ciclo atual (depois de uma reabertura, a antiga não conta)
    const acao = acoes[0]?.ciclo === r.reaberturas + 1 ? acoes[0] : null;
    return {
      ...r,
      multas: Number(multasJuros),
      horas: Number(horasRetrabalho),
      prazo: diaIso(acao?.prazo) || null,
      verificarEm: diaIso(acao?.verificarEm) || null,
    };
  });
}
