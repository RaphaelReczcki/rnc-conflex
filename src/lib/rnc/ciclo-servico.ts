import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatarMoeda } from "@/lib/formato";
import { diaIso, hojeEmBrasilia, paraDate } from "@/lib/datas";
import {
  podeConcluirAcao,
  podeConcluirAnalise,
  podeEditarAcao,
  podeEditarAnalise,
  podeEditarImpacto,
  podeVerificar,
  type RncAcesso,
  type UsuarioAcesso,
} from "@/lib/auth/permissoes";
import { lerDecimal } from "./validacao";
import { emailAcaoAtribuida } from "@/lib/email/modelos";
import { enfileirar, urlSistema } from "@/lib/notificacoes/fila";
import { aplicarEvento, cicloAtual, ErroCiclo, etapaPermite, validarAcao, validarAnalise, validarVerificacao, type TipoEventoHistorico } from "./ciclo";
import type { Status } from "./dominio";

export type Ator = UsuarioAcesso;
// Mensagem para rascunhos; evento quando a RNC mudou de etapa.
export type Resultado = { mensagem: string; evento?: TipoEventoHistorico };
type Tx = Prisma.TransactionClient;

const SEM_PERMISSAO = "Seu perfil não permite esta etapa nesta RNC. O líder do setor ou a gestão da qualidade podem ajudar.";

// Trava a linha da RNC até o fim da transação: duas pessoas não movem a
// mesma RNC ao mesmo tempo, e a segunda vê a etapa já atualizada.
async function travar(tx: Tx, codigo: string) {
  const [r] = await tx.$queryRaw<
    { id: string; status: Status; reaberturas: number; setor_id: string; autor_id: string; data_ocorrencia: Date }[]
  >`SELECT id, status::text AS status, reaberturas, setor_id, autor_id, data_ocorrencia
    FROM rncs WHERE codigo = ${codigo} FOR UPDATE`;
  if (!r) throw new ErroCiclo("Não encontramos esta RNC.");
  const ciclo = cicloAtual(r.reaberturas);
  const acao = await tx.acaoCorretiva.findUnique({ where: { rncId_ciclo: { rncId: r.id, ciclo } } });
  const acesso: RncAcesso = { setorId: r.setor_id, autorId: r.autor_id, responsavelAcaoId: acao?.responsavelId ?? null };
  return { rnc: r, ciclo, acao, acesso };
}

async function transicionar(tx: Tx, rncId: string, estado: { status: Status; reaberturas: number }, evento: Parameters<typeof aplicarEvento>[1], usuarioId: string, dados?: Prisma.InputJsonValue) {
  const r = aplicarEvento({ ...estado, encerradaEm: null }, evento);
  await tx.rnc.update({ where: { id: rncId }, data: { status: r.status, reaberturas: r.reaberturas, encerradaEm: r.encerradaEm } });
  await tx.historico.create({ data: { rncId, ...r.historico, usuarioId, dados } });
  return r;
}

export async function salvarAnalise(ator: Ator, codigo: string, valores: Record<string, string>, concluir: boolean): Promise<Resultado> {
  const v = validarAnalise(valores, concluir);
  if ("erro" in v) throw new ErroCiclo(v.erro);

  return prisma.$transaction(async (tx) => {
    const { rnc, ciclo, acesso } = await travar(tx, codigo);
    if (!etapaPermite(rnc.status, "concluir_analise")) throw new ErroCiclo("A análise desta RNC já foi concluída. Recarregue a página.");
    if (!(concluir ? podeConcluirAnalise(ator, acesso) : podeEditarAnalise(ator, acesso))) {
      throw new ErroCiclo(concluir ? "Quem conclui a análise é o líder do setor ou a gestão da qualidade. Salve o rascunho e avise-os." : SEM_PERMISSAO);
    }
    const conclusao = concluir ? { concluidaEm: new Date(), concluidaPorId: ator.id } : {};
    await tx.analise.upsert({
      where: { rncId_ciclo: { rncId: rnc.id, ciclo } },
      create: { rncId: rnc.id, ciclo, ...v.dados, ...conclusao },
      update: { ...v.dados, ...conclusao },
    });
    if (!concluir) return { mensagem: "Rascunho salvo." };
    await transicionar(tx, rnc.id, rnc, "concluir_analise", ator.id);
    return { mensagem: "Análise concluída.", evento: "analise_concluida" };
  });
}

export async function salvarAcao(ator: Ator, codigo: string, valores: Record<string, string>, concluir: boolean): Promise<Resultado> {
  return prisma.$transaction(async (tx) => {
    const { rnc, ciclo, acao, acesso } = await travar(tx, codigo);
    if (!etapaPermite(rnc.status, "concluir_acao")) {
      throw new ErroCiclo(rnc.status === "analise" ? "A ação é liberada depois da análise de causa." : "A ação desta RNC já foi concluída. Recarregue a página.");
    }
    const v = validarAcao(valores, concluir, { hoje: hojeEmBrasilia(), dataOcorrencia: diaIso(rnc.data_ocorrencia) });
    if ("erro" in v) throw new ErroCiclo(v.erro);
    const d = v.dados;

    // Editar: vale o vínculo já gravado (ninguém ganha acesso se nomeando
    // responsável). Concluir: vale o responsável escolhido agora.
    const acessoNovo = { ...acesso, responsavelAcaoId: d.responsavelId };
    if (!podeEditarAcao(ator, acesso)) throw new ErroCiclo(SEM_PERMISSAO);
    if (concluir && !podeConcluirAcao(ator, acessoNovo)) {
      throw new ErroCiclo("Quem conclui a ação é o responsável por ela, o líder do setor ou a gestão da qualidade.");
    }

    let responsavel: { id: string; nome: string; email: string } | null = null;
    if (d.responsavelId) {
      responsavel = await tx.usuario.findFirst({ where: { id: d.responsavelId, ativo: true }, select: { id: true, nome: true, email: true } });
      if (!responsavel) throw new ErroCiclo("Escolha como responsável alguém ativo na equipe.");
    }

    const campos = {
      descricao: d.descricao || null,
      responsavelId: d.responsavelId,
      prazo: d.prazo ? paraDate(d.prazo) : null,
      exigeAtualizarDocumento: d.exigeAtualizarDocumento,
      verificarEm: d.verificarEm ? paraDate(d.verificarEm) : null,
      ...(concluir ? { concluidaEm: new Date(), concluidaPorId: ator.id } : {}),
    };
    const salva = await tx.acaoCorretiva.upsert({
      where: { rncId_ciclo: { rncId: rnc.id, ciclo } },
      create: { rncId: rnc.id, ciclo, ...campos },
      update: campos,
    });

    if ((acao?.responsavelId ?? null) !== d.responsavelId) {
      const evento = await tx.historico.create({
        data: {
          rncId: rnc.id,
          tipo: "responsavel_alterado",
          texto: responsavel ? `Responsável pela ação: ${responsavel.nome}` : "Responsável pela ação retirado",
          ciclo,
          usuarioId: ator.id,
          dados: { anterior: acao?.responsavelId ?? null, novo: d.responsavelId },
        },
      });
      // Avisa quem recebeu a ação (não precisa avisar quem nomeou a si mesmo)
      if (responsavel && responsavel.id !== ator.id) {
        const dadosRnc = await tx.rnc.findUniqueOrThrow({ where: { id: rnc.id }, select: { codigo: true, tipoProblema: true, setor: { select: { nome: true } } } });
        const quem = await tx.usuario.findUniqueOrThrow({ where: { id: ator.id }, select: { nome: true } });
        await enfileirar(tx, {
          chave: `acao_atribuida:${salva.id}:${responsavel.id}:${evento.id}`,
          tipo: "acao_atribuida",
          rncId: rnc.id,
          destinatarios: [responsavel],
          email: emailAcaoAtribuida({
            codigo: dadosRnc.codigo,
            setor: dadosRnc.setor.nome,
            tipoProblema: dadosRnc.tipoProblema,
            link: urlSistema(`/rncs/${dadosRnc.codigo}`),
            para: responsavel.nome,
            quem: quem.nome,
            acao: d.descricao || null,
            prazo: d.prazo,
          }),
        });
      }
    }

    if (!concluir) return { mensagem: "Rascunho salvo." };
    await transicionar(tx, rnc.id, rnc, "concluir_acao", ator.id);
    return { mensagem: "Ação concluída.", evento: "acao_concluida" };
  });
}

export async function registrarVerificacao(ator: Ator, codigo: string, valores: Record<string, string>): Promise<Resultado> {
  const v = validarVerificacao(valores);
  if ("erro" in v) throw new ErroCiclo(v.erro);

  return prisma.$transaction(async (tx) => {
    const { rnc, ciclo, acao, acesso } = await travar(tx, codigo);
    if (!etapaPermite(rnc.status, "verificar_eficaz")) {
      throw new ErroCiclo(rnc.status === "encerrada" ? "Esta RNC já foi encerrada." : "A verificação é liberada depois que a ação corretiva for concluída.");
    }
    if (!podeVerificar(ator, acesso)) throw new ErroCiclo("Quem verifica a eficácia é o líder do setor ou a gestão da qualidade.");
    if (!acao?.concluidaEm) throw new ErroCiclo("A ação corretiva deste ciclo ainda não foi concluída.");

    await tx.verificacao.create({
      data: { rncId: rnc.id, ciclo, acaoId: acao.id, resultado: v.resultado, evidencia: v.evidencia || null, verificadoPorId: ator.id },
    });

    if (v.resultado === "eficaz") {
      await transicionar(tx, rnc.id, rnc, "verificar_eficaz", ator.id, { evidencia: v.evidencia });
      return { mensagem: "RNC encerrada.", evento: "verificacao_eficaz" };
    }
    // Ineficaz: guarda no histórico a causa e a ação deste ciclo; o próximo
    // ciclo começa com a análise em branco.
    const analise = await tx.analise.findUnique({ where: { rncId_ciclo: { rncId: rnc.id, ciclo } } });
    await transicionar(tx, rnc.id, rnc, "verificar_ineficaz", ator.id, {
      cicloEncerrado: ciclo,
      causaRaizAnterior: analise?.causaRaiz ?? null,
      acaoAnterior: acao.descricao,
      evidencia: v.evidencia || null,
    });
    return { mensagem: "A RNC voltou para a análise de causa.", evento: "verificacao_ineficaz" };
  });
}

export async function atualizarImpacto(ator: Ator, codigo: string, valores: Record<string, string>): Promise<Resultado> {
  const multas = lerDecimal(valores.multasJuros);
  const horas = lerDecimal(valores.horasRetrabalho);
  if (multas === null || multas >= 10_000_000_000) throw new ErroCiclo("Informe multas e juros em reais, ex.: 1.234,56.");
  if (horas === null || horas > 99_999) throw new ErroCiclo("Informe as horas de retrabalho, ex.: 2,5.");

  return prisma.$transaction(async (tx) => {
    const { rnc, ciclo, acesso } = await travar(tx, codigo);
    if (!podeEditarImpacto(ator, acesso)) throw new ErroCiclo(SEM_PERMISSAO);
    const atual = await tx.rnc.findUniqueOrThrow({ where: { id: rnc.id }, select: { multasJuros: true, horasRetrabalho: true } });
    const antes = { multas: Number(atual.multasJuros), horas: Number(atual.horasRetrabalho) };
    const novo = { multas: Math.round(multas * 100) / 100, horas: Math.round(horas * 100) / 100 };
    if (antes.multas === novo.multas && antes.horas === novo.horas) return { mensagem: "Nada mudou no impacto." };

    await tx.rnc.update({ where: { id: rnc.id }, data: { multasJuros: novo.multas, horasRetrabalho: novo.horas } });
    const partes = [
      antes.multas !== novo.multas && `multas e juros de ${formatarMoeda(antes.multas)} para ${formatarMoeda(novo.multas)}`,
      antes.horas !== novo.horas && `retrabalho de ${antes.horas.toLocaleString("pt-BR")} h para ${novo.horas.toLocaleString("pt-BR")} h`,
    ].filter(Boolean);
    await tx.historico.create({
      data: { rncId: rnc.id, tipo: "impacto_atualizado", texto: `Impacto atualizado: ${partes.join("; ")}`, ciclo, usuarioId: ator.id, dados: { antes, depois: novo } },
    });
    return { mensagem: "Impacto atualizado." };
  });
}
