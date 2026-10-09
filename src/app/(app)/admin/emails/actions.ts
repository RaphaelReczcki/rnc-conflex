"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";
import { emailTeste } from "@/lib/email/modelos";
import { enfileirar, processarFila, urlSistema } from "@/lib/notificacoes/fila";
import { rotinaDiaria } from "@/lib/notificacoes/agendadas";

export type EstadoNotificacoes = { ok?: string; erro?: string };

function descrever(r: { enviadas: number; falhas: number; erroConfiguracao: string | null }) {
  if (r.erroConfiguracao) return { erro: r.erroConfiguracao };
  if (r.falhas) return { erro: `${r.enviadas} enviado(s), ${r.falhas} com falha. Veja o motivo na lista abaixo.` };
  return { ok: r.enviadas ? `${r.enviadas} e-mail(s) enviado(s).` : "Nada pendente para enviar." };
}

export async function enviarTeste(): Promise<EstadoNotificacoes> {
  const gestor = await exigirGestao();
  await enfileirar(prisma, {
    chave: `teste:${gestor.id}:${Date.now()}`,
    tipo: "teste",
    destinatarios: [gestor],
    email: emailTeste({ para: gestor.nome, link: urlSistema("/") }),
  });
  const r = await processarFila();
  revalidatePath("/admin/emails");
  const d = descrever(r);
  return d.ok && r.enviadas ? { ok: `Teste enviado para ${gestor.email}.` } : d;
}

export async function reenviarFalhas(): Promise<EstadoNotificacoes> {
  await exigirGestao();
  // Volta as falhas para a fila, zerando a contagem de tentativas
  await prisma.notificacao.updateMany({ where: { status: "falhou" }, data: { status: "pendente", tentativas: 0, proximaTentativaEm: new Date() } });
  const r = await processarFila({ limite: 100 });
  revalidatePath("/admin/emails");
  return descrever(r);
}

export async function rodarRotinaAgora(): Promise<EstadoNotificacoes> {
  await exigirGestao();
  const r = await rotinaDiaria();
  revalidatePath("/admin/emails");
  const d = descrever(r);
  return d.erro ? d : { ok: `Rotina executada: ${r.enfileiradas} aviso(s) novo(s), ${r.enviadas} enviado(s).` };
}
