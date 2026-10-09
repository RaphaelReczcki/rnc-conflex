// Regras do ciclo da RNC, sem banco: análise → ação → verificação → encerrada,
// com retorno para a análise quando a verificação é ineficaz.
import { z } from "zod";
import { dataValida, somarDias } from "@/lib/datas";
import { contemCpf } from "./validacao";
import type { Status } from "./dominio";

export class ErroCiclo extends Error {}

export type Evento = "concluir_analise" | "concluir_acao" | "verificar_eficaz" | "verificar_ineficaz";
export type TipoEventoHistorico = "analise_concluida" | "acao_concluida" | "verificacao_eficaz" | "verificacao_ineficaz";

const TRANSICOES: Record<Evento, { de: Status; para: Status; tipo: TipoEventoHistorico; texto: string }> = {
  concluir_analise: { de: "analise", para: "acao", tipo: "analise_concluida", texto: "Análise de causa concluída" },
  concluir_acao: { de: "acao", para: "verificacao", tipo: "acao_concluida", texto: "Ação corretiva concluída" },
  verificar_eficaz: { de: "verificacao", para: "encerrada", tipo: "verificacao_eficaz", texto: "Verificada como eficaz e encerrada" },
  verificar_ineficaz: {
    de: "verificacao",
    para: "analise",
    tipo: "verificacao_ineficaz",
    texto: "Verificada como ineficaz, voltou para a análise de causa",
  },
};

const MENSAGEM_ETAPA: Record<Status, string> = {
  analise: "Esta RNC está na análise de causa.",
  acao: "Esta RNC está na ação corretiva.",
  verificacao: "Esta RNC está aguardando a verificação de eficácia.",
  encerrada: "Esta RNC já foi encerrada.",
};

export type EstadoCiclo = { status: Status; reaberturas: number; encerradaEm: Date | null };

export type ResultadoTransicao = EstadoCiclo & {
  historico: { tipo: TipoEventoHistorico; texto: string; statusAnterior: Status; statusNovo: Status; ciclo: number };
};

// Ciclo atual: 1 no registro, +1 a cada verificação ineficaz.
export const cicloAtual = (reaberturas: number) => reaberturas + 1;

export function etapaPermite(status: Status, evento: Evento): boolean {
  return TRANSICOES[evento].de === status;
}

export function aplicarEvento(estado: EstadoCiclo, evento: Evento, agora = new Date()): ResultadoTransicao {
  const t = TRANSICOES[evento];
  if (estado.status !== t.de) throw new ErroCiclo(`${MENSAGEM_ETAPA[estado.status]} Recarregue a página para ver a etapa atual.`);
  const ciclo = cicloAtual(estado.reaberturas);
  return {
    status: t.para,
    reaberturas: evento === "verificar_ineficaz" ? estado.reaberturas + 1 : estado.reaberturas,
    encerradaEm: t.para === "encerrada" ? agora : null,
    historico: { tipo: t.tipo, texto: t.texto, statusAnterior: t.de, statusNovo: t.para, ciclo },
  };
}

// ---------- Validação dos formulários de cada etapa ----------

// Campo ausente vale como vazio
const texto = (max: number) =>
  z.preprocess(
    (v) => v ?? "",
    z
      .string({ message: "Confira o texto informado." })
      .trim()
      .max(max, `Use no máximo ${max} caracteres.`)
      .refine((t) => !contemCpf(t), "Parece haver um CPF no texto. Para proteger os dados pessoais (LGPD), retire-o."),
  );

export const CAMPOS_ISHIKAWA = {
  ishMetodo: { rotulo: "Método/processo", dica: "Passos, checklist, POP" },
  ishPessoas: { rotulo: "Pessoas", dica: "Treinamento, carga de trabalho, comunicação" },
  ishSistema: { rotulo: "Sistema/software", dica: "Falhas, parametrização, integrações" },
  ishCliente: { rotulo: "Cliente", dica: "Envio de documentos, informações" },
  ishDocumentacao: { rotulo: "Documentação", dica: "Modelos, registros, arquivos" },
  ishPrazo: { rotulo: "Prazo/ambiente", dica: "Calendário, feriados, interrupções" },
} as const;
export type CampoIshikawa = keyof typeof CAMPOS_ISHIKAWA;
export const CAMPOS_PORQUE = ["porque1", "porque2", "porque3", "porque4", "porque5"] as const;

export const esquemaAnalise = z.object({
  metodo: z.enum(["cinco_porques", "ishikawa"], { message: "Escolha o método." }),
  porque1: texto(2000),
  porque2: texto(2000),
  porque3: texto(2000),
  porque4: texto(2000),
  porque5: texto(2000),
  ishMetodo: texto(2000),
  ishPessoas: texto(2000),
  ishSistema: texto(2000),
  ishCliente: texto(2000),
  ishDocumentacao: texto(2000),
  ishPrazo: texto(2000),
  causaRaiz: texto(3000),
});
export type DadosAnalise = z.output<typeof esquemaAnalise>;

export function validarAnalise(valores: Record<string, string>, concluir: boolean): { dados: DadosAnalise } | { erro: string; campo?: string } {
  const r = esquemaAnalise.safeParse(valores);
  if (!r.success) return { erro: r.error.issues[0].message, campo: String(r.error.issues[0].path[0] ?? "") };
  if (concluir && !r.data.causaRaiz) return { erro: "Escreva a causa raiz antes de concluir a análise.", campo: "causaRaiz" };
  return { dados: r.data };
}

export type DadosAcao = {
  descricao: string;
  responsavelId: string | null;
  prazo: string | null;
  exigeAtualizarDocumento: boolean;
  verificarEm: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarAcao(
  valores: Record<string, string>,
  concluir: boolean,
  ctx: { hoje: string; dataOcorrencia: string },
): { dados: DadosAcao } | { erro: string; campo?: string } {
  const desc = texto(3000).safeParse(valores.descricao ?? "");
  if (!desc.success) return { erro: desc.error.issues[0].message, campo: "descricao" };
  const responsavelId = (valores.responsavelId ?? "").trim() || null;
  if (responsavelId && !UUID.test(responsavelId)) return { erro: "Escolha o responsável na lista.", campo: "responsavelId" };

  const data = (campo: "prazo" | "verificarEm", nome: string) => {
    const v = (valores[campo] ?? "").trim();
    if (!v) return { valor: null };
    if (!dataValida(v)) return { erro: `Confira a data de ${nome}.` };
    if (v < ctx.dataOcorrencia) return { erro: `A data de ${nome} não pode ser anterior à ocorrência.` };
    return { valor: v };
  };
  const prazo = data("prazo", "prazo");
  if ("erro" in prazo) return { erro: prazo.erro!, campo: "prazo" };
  const verificar = data("verificarEm", "verificação");
  if ("erro" in verificar) return { erro: verificar.erro!, campo: "verificarEm" };

  const dados: DadosAcao = {
    descricao: desc.data,
    responsavelId,
    prazo: prazo.valor,
    exigeAtualizarDocumento: valores.exigeAtualizarDocumento === "on" || valores.exigeAtualizarDocumento === "true",
    verificarEm: verificar.valor,
  };
  if (concluir) {
    if (!dados.descricao) return { erro: "Descreva a ação antes de concluir.", campo: "descricao" };
    if (!dados.responsavelId) return { erro: "Escolha quem é responsável pela ação antes de concluir.", campo: "responsavelId" };
    // Padrão: verificar a eficácia daqui a 30 dias
    dados.verificarEm ??= somarDias(ctx.hoje, 30);
  }
  return { dados };
}

export function validarVerificacao(
  valores: Record<string, string>,
): { resultado: "eficaz" | "ineficaz"; evidencia: string } | { erro: string; campo?: string } {
  const resultado = valores.resultado;
  if (resultado !== "eficaz" && resultado !== "ineficaz") return { erro: "Escolha se a ação foi eficaz ou não.", campo: "resultado" };
  const ev = texto(3000).safeParse(valores.evidencia ?? "");
  if (!ev.success) return { erro: ev.error.issues[0].message, campo: "evidencia" };
  if (resultado === "eficaz" && !ev.data) {
    return { erro: "Conte o que mostrou que o problema não voltou. Essa evidência é o aprendizado que fica registrado.", campo: "evidencia" };
  }
  return { resultado, evidencia: ev.data };
}
