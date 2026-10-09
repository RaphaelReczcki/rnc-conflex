import "server-only";
import { prisma } from "@/lib/db";
import { diaIso, hojeEmBrasilia, somarDias, paraDate } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { emailLembretePrazo, emailResumoSemanal, emailVerificacaoLiberada } from "@/lib/email/modelos";
import { calcularIndicadores, type Periodo } from "@/lib/painel/indicadores";
import { carregarLinhasPainel } from "@/lib/painel/carregar";
import type { Transporte } from "@/lib/email/transporte";
import { enfileirar, processarFila, urlSistema } from "./fila";
import { destinatariosVerificacao, lembretesDoDia, semanaIso, verificacoesLiberadas } from "./regras";

const linkRnc = (codigo: string) => urlSistema(`/rncs/${codigo}`);

// Rotina diária (7h): lembretes de prazo e avisos de verificação liberada.
export async function rotinaDiaria({ agora = new Date(), transporte }: { agora?: Date; transporte?: Transporte | null } = {}) {
  const hoje = hojeEmBrasilia(agora);
  let enfileiradas = 0;

  // Lembretes: ações em aberto com prazo hoje ou daqui a 3 dias
  const acoes = await prisma.acaoCorretiva.findMany({
    where: { concluidaEm: null, prazo: { in: [paraDate(hoje), paraDate(somarDias(hoje, 3))] }, rnc: { status: "acao" } },
    include: { rnc: { include: { setor: true } }, responsavel: true },
  });
  const porId = new Map(acoes.map((a) => [a.id, a]));
  for (const l of lembretesDoDia(
    acoes.map((a) => ({
      acaoId: a.id,
      ciclo: a.ciclo,
      cicloAtual: a.rnc.reaberturas + 1,
      statusRnc: a.rnc.status,
      prazo: diaIso(a.prazo),
      concluida: !!a.concluidaEm,
      responsavelAtivo: !!a.responsavel?.ativo,
    })),
    hoje,
  )) {
    const a = porId.get(l.acaoId)!;
    const r = a.responsavel!;
    const email = emailLembretePrazo({
      codigo: a.rnc.codigo,
      setor: a.rnc.setor.nome,
      tipoProblema: a.rnc.tipoProblema,
      link: linkRnc(a.rnc.codigo),
      para: r.nome,
      acao: a.descricao,
      prazo: diaIso(a.prazo),
      emDias: l.emDias,
    });
    if (await enfileirar(prisma, { chave: l.chave, tipo: l.emDias === 0 ? "lembrete_prazo_dia" : "lembrete_prazo_3d", rncId: a.rncId, destinatarios: [r], email })) enfileiradas++;
  }

  // Verificação liberada: avisa os líderes do setor (sem líder, a gestão)
  const aVerificar = await prisma.acaoCorretiva.findMany({
    where: { concluidaEm: { not: null }, verificarEm: { lte: paraDate(hoje) }, rnc: { status: "verificacao" } },
    include: { rnc: { include: { setor: true } }, concluidaPor: { select: { nome: true } } },
  });
  const usuarios = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, email: true, perfil: true, setorId: true, ativo: true } });
  const acaoPorId = new Map(aVerificar.map((a) => [a.id, a]));
  for (const v of verificacoesLiberadas(
    aVerificar.map((a) => ({ acaoId: a.id, ciclo: a.ciclo, cicloAtual: a.rnc.reaberturas + 1, statusRnc: a.rnc.status, verificarEm: diaIso(a.verificarEm) })),
    hoje,
  )) {
    const a = acaoPorId.get(v.acaoId)!;
    for (const pessoa of destinatariosVerificacao(usuarios, a.rnc.setorId)) {
      const email = emailVerificacaoLiberada({
        codigo: a.rnc.codigo,
        setor: a.rnc.setor.nome,
        tipoProblema: a.rnc.tipoProblema,
        link: linkRnc(a.rnc.codigo),
        para: pessoa.nome,
        acao: a.descricao,
        verificarEm: diaIso(a.verificarEm),
        concluidaPor: a.concluidaPor?.nome ?? null,
      });
      // Um e-mail por pessoa, para cada um ver só a própria saudação
      if (await enfileirar(prisma, { chave: `${v.chave}:${pessoa.id}`, tipo: "verificacao_liberada", rncId: a.rncId, destinatarios: [pessoa], email })) enfileiradas++;
    }
  }

  // Envia com a hora real: o que acabou de entrar na fila já pode sair
  const envio = await processarFila({ transporte });
  return { hoje, enfileiradas, ...envio };
}

const MOTIVO = { prazo: "prazo era", verificacao: "verificar desde", critica: "crítica sem análise" } as const;

// Resumo semanal para a gestão (segunda, 8h): os últimos 7 dias.
export async function resumoSemanal({ agora = new Date(), transporte }: { agora?: Date; transporte?: Transporte | null } = {}) {
  const hoje = hojeEmBrasilia(agora);
  const semana = semanaIso(hoje);
  const periodo: Periodo = { chave: "12m", rotulo: "Últimos 7 dias", inicio: new Date(+agora - 7 * 86_400_000), fim: agora };
  const [linhas, setores, gestao] = await Promise.all([
    carregarLinhasPainel(periodo),
    prisma.setor.findMany({ select: { id: true, nome: true } }),
    prisma.usuario.findMany({ where: { ativo: true, perfil: "gestao" }, select: { id: true, nome: true, email: true } }),
  ]);
  const I = calcularIndicadores(linhas, { agora, periodo, setores });

  let enfileiradas = 0;
  for (const pessoa of gestao) {
    const email = emailResumoSemanal({
      para: pessoa.nome,
      inicio: somarDias(hoje, -7),
      fim: somarDias(hoje, -1),
      registradas: I.totalNoPeriodo,
      encerradas: I.porEtapa.encerrada,
      abertas: { analise: I.porEtapa.analise, acao: I.porEtapa.acao, verificacao: I.porEtapa.verificacao },
      atencao: I.atencao.map((a) => ({ codigo: a.codigo, tipoProblema: a.tipoProblema, motivo: a.data ? `${MOTIVO[a.motivo]} ${formatarData(a.data)}` : MOTIVO[a.motivo] })),
      recorrentes: I.recorrentes,
      link: urlSistema("/"),
    });
    if (await enfileirar(prisma, { chave: `resumo_semanal:${semana}:${pessoa.id}`, tipo: "resumo_semanal", destinatarios: [pessoa], email })) enfileiradas++;
  }
  // Envia com a hora real: o que acabou de entrar na fila já pode sair
  const envio = await processarFila({ transporte });
  return { semana, enfileiradas, ...envio };
}
