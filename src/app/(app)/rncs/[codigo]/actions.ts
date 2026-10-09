"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { processarFila } from "@/lib/notificacoes/fila";
import { exigirUsuario } from "@/lib/auth/sessao";
import { ErroCiclo } from "@/lib/rnc/ciclo";
import { atualizarImpacto, registrarVerificacao, salvarAcao, salvarAnalise, type Resultado } from "@/lib/rnc/ciclo-servico";
import { PADRAO_CODIGO } from "@/lib/rnc/codigo";

export type EstadoEtapa = { ok?: string; erro?: string; valores?: Record<string, string>; chave?: number };

type Operacao = (
  ator: Awaited<ReturnType<typeof exigirUsuario>>,
  codigo: string,
  valores: Record<string, string>,
  concluir: boolean,
) => Promise<Resultado>;

async function executar(operacao: Operacao, anterior: EstadoEtapa, form: FormData): Promise<EstadoEtapa> {
  const usuario = await exigirUsuario();
  const chave = (anterior.chave ?? 0) + 1;
  const valores: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) valores[k] = v;
  const codigo = valores.codigo ?? "";
  if (!PADRAO_CODIGO.test(codigo)) return { erro: "Não encontramos esta RNC.", chave };

  let resultado: Resultado;
  try {
    resultado = await operacao(usuario, codigo, valores, valores.intencao === "concluir");
  } catch (e) {
    if (e instanceof ErroCiclo) return { erro: e.message, valores, chave };
    throw e;
  }
  revalidatePath(`/rncs/${codigo}`);
  revalidatePath("/registros");
  revalidatePath("/");
  // Mudou de etapa: recarrega a página com o aviso correspondente
  if (resultado.evento) redirect(`/rncs/${codigo}?feito=${resultado.evento}`);
  return { ok: resultado.mensagem, chave };
}

export async function enviarAnalise(anterior: EstadoEtapa, form: FormData) {
  return executar(salvarAnalise, anterior, form);
}
export async function enviarAcao(anterior: EstadoEtapa, form: FormData) {
  // Se o responsável mudou, o aviso já está na fila: envia logo após responder
  after(() => processarFila().catch((e) => console.error("Envio de notificações:", e)));
  return executar(salvarAcao, anterior, form);
}
export async function enviarVerificacao(anterior: EstadoEtapa, form: FormData) {
  return executar((u, c, v) => registrarVerificacao(u, c, v), anterior, form);
}
export async function enviarImpacto(anterior: EstadoEtapa, form: FormData) {
  return executar((u, c, v) => atualizarImpacto(u, c, v), anterior, form);
}
