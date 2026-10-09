import "server-only";
import { prisma } from "@/lib/db";
import { normalizar } from "@/lib/normalizar";
import { anoMes, formatarCodigo } from "./codigo";
import type { DadosRegistro } from "./validacao";

export type ResultadoRegistro = { codigo: string; clienteNovo: string | null };

// Grava a RNC numa transação: número do mês, cliente, categoria, RNC e histórico.
export async function registrarRnc(dados: DadosRegistro, autorId: string): Promise<ResultadoRegistro> {
  return prisma.$transaction(async (tx) => {
    const setor = await tx.setor.findFirst({ where: { id: dados.setorId, ativo: true } });
    if (!setor) throw new ErroRegistro("Escolha um setor da lista.");

    // Número sequencial do mês. O UPSERT trava a linha do mês até o fim da
    // transação, então dois registros simultâneos nunca pegam o mesmo número.
    const am = anoMes();
    const [{ ultimo }] = await tx.$queryRaw<{ ultimo: number }[]>`
      INSERT INTO rnc_contadores (ano_mes, ultimo) VALUES (${am}, 1)
      ON CONFLICT (ano_mes) DO UPDATE SET ultimo = rnc_contadores.ultimo + 1
      RETURNING ultimo`;
    const codigo = formatarCodigo(am, ultimo);

    // Cliente: reaproveita o cadastro pelo nome normalizado ou cadastra um novo
    let clienteId: string | null = null;
    let clienteNovo: string | null = null;
    if (dados.cliente) {
      const nomeNormalizado = normalizar(dados.cliente);
      const existente = await tx.cliente.findFirst({ where: { nomeNormalizado }, orderBy: { ativo: "desc" } });
      if (existente) clienteId = existente.id;
      else {
        const criado = await tx.cliente.create({ data: { nome: dados.cliente, nomeNormalizado } });
        clienteId = criado.id;
        clienteNovo = criado.nome;
      }
    }

    // Tipo de problema: texto livre, vinculado à categoria quando coincide
    const tipoProblemaNorm = normalizar(dados.tipoProblema);
    const categoria = await tx.categoria.findUnique({ where: { nomeNormalizado: tipoProblemaNorm } });

    const rnc = await tx.rnc.create({
      data: {
        codigo,
        dataOcorrencia: new Date(`${dados.dataOcorrencia}T00:00:00Z`),
        setorId: setor.id,
        clienteId,
        categoriaId: categoria?.id ?? null,
        // Usa a grafia oficial quando é uma categoria cadastrada
        tipoProblema: categoria?.nome ?? dados.tipoProblema,
        tipoProblemaNorm,
        origem: dados.origem,
        severidade: dados.severidade,
        descricao: dados.descricao,
        correcaoImediata: dados.correcaoImediata || null,
        multasJuros: dados.multasJuros,
        horasRetrabalho: dados.horasRetrabalho,
        status: "analise",
        autorId,
      },
    });

    await tx.historico.create({
      data: {
        rncId: rnc.id,
        tipo: "registro",
        texto: "RNC registrada",
        statusNovo: "analise",
        ciclo: 1,
        usuarioId: autorId,
      },
    });

    return { codigo, clienteNovo };
  });
}

export class ErroRegistro extends Error {}
