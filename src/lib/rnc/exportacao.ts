import "server-only";
import { prisma } from "@/lib/db";
import { gerarCsv, numeroCsv } from "@/lib/csv";
import { formatarCnpj } from "@/lib/cnpj";
import { formatarData } from "@/lib/formato";
import { diaIso } from "@/lib/datas";
import { ETAPAS, ORIGENS, SEVERIDADES } from "./dominio";
import { condicaoLista, type Filtros } from "./filtros";

const CABECALHO = [
  "Código",
  "Registrada em",
  "Data da ocorrência",
  "Setor",
  "Cliente",
  "CNPJ do cliente",
  "Tipo de problema",
  "Origem",
  "Severidade",
  "Etapa",
  "O que aconteceu",
  "Correção imediata",
  "Causa raiz",
  "Ação corretiva",
  "Responsável",
  "Prazo",
  "Verificar em",
  "Encerrada em",
  "Multas e juros (R$)",
  "Horas de retrabalho",
  "Reaberturas",
  "Aprendizado",
];

// Gera o CSV com as mesmas regras de filtro e busca da lista de registros.
export async function exportarRegistros(filtros: Filtros): Promise<{ csv: string; total: number }> {
  const rncs = await prisma.rnc.findMany({
    where: condicaoLista(filtros),
    orderBy: { criadaEm: "desc" },
    include: {
      setor: { select: { nome: true } },
      cliente: { select: { nome: true, cnpj: true } },
      analises: { orderBy: { ciclo: "desc" }, take: 1, select: { ciclo: true, causaRaiz: true } },
      acoes: { orderBy: { ciclo: "desc" }, take: 1, select: { ciclo: true, descricao: true, prazo: true, verificarEm: true, responsavel: { select: { nome: true } } } },
      verificacoes: { where: { resultado: "eficaz" }, take: 1, select: { evidencia: true } },
    },
  });

  const linhas = rncs.map((r) => {
    // Causa e ação do ciclo atual; depois de uma reabertura, o ciclo novo começa vazio
    const ciclo = r.reaberturas + 1;
    const analise = r.analises[0]?.ciclo === ciclo ? r.analises[0] : null;
    const acao = r.acoes[0]?.ciclo === ciclo ? r.acoes[0] : null;
    return [
      r.codigo,
      formatarData(r.criadaEm),
      formatarData(diaIso(r.dataOcorrencia)),
      r.setor.nome,
      r.cliente?.nome ?? "",
      r.cliente?.cnpj ? formatarCnpj(r.cliente.cnpj) : "",
      r.tipoProblema,
      ORIGENS[r.origem],
      SEVERIDADES[r.severidade].rotulo,
      ETAPAS[r.status].curto,
      r.descricao,
      r.correcaoImediata ?? "",
      analise?.causaRaiz ?? "",
      acao?.descricao ?? "",
      acao?.responsavel?.nome ?? "",
      formatarData(diaIso(acao?.prazo)),
      formatarData(diaIso(acao?.verificarEm)),
      formatarData(r.encerradaEm),
      numeroCsv(Number(r.multasJuros)),
      numeroCsv(Number(r.horasRetrabalho), 1),
      r.reaberturas,
      r.verificacoes[0]?.evidencia ?? "",
    ];
  });

  return { csv: gerarCsv(CABECALHO, linhas), total: rncs.length };
}
