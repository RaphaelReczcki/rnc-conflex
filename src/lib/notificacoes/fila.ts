import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, TipoNotificacao } from "@/generated/prisma/client";
import type { Email } from "@/lib/email/modelos";
import { ErroEnvio, transportePadrao, type Transporte } from "@/lib/email/transporte";
import { esperaAposFalha, MAX_TENTATIVAS } from "./regras";

type Db = Prisma.TransactionClient | typeof prisma;

export function urlSistema(caminho = "/"): string {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}${caminho}`;
}

// Grava o e-mail na fila. Se já existe um com a mesma chave, não faz nada.
export async function enfileirar(
  db: Db,
  n: { chave: string; tipo: TipoNotificacao; rncId?: string | null; destinatarios: { id: string; email: string }[]; email: Email },
): Promise<boolean> {
  if (!n.destinatarios.length) return false;
  if (await db.notificacao.findUnique({ where: { chave: n.chave }, select: { id: true } })) return false;
  await db.notificacao.create({
    data: {
      chave: n.chave,
      tipo: n.tipo,
      rncId: n.rncId ?? null,
      assunto: n.email.assunto,
      html: n.email.html,
      texto: n.email.texto,
      destinatarios: { create: n.destinatarios.map((d) => ({ usuarioId: d.id, email: d.email })) },
    },
  });
  return true;
}

// Envia o que está na fila. Cada item é "reservado" antes do envio, então
// duas execuções ao mesmo tempo não mandam o mesmo e-mail duas vezes.
export async function processarFila({ transporte, agora = new Date(), limite = 25 }: { transporte?: Transporte | null; agora?: Date; limite?: number } = {}) {
  const resultado = { enviadas: 0, falhas: 0, erroConfiguracao: null as string | null };
  let t: Transporte | null;
  try {
    t = transporte === undefined ? transportePadrao() : transporte;
  } catch (e) {
    resultado.erroConfiguracao = e instanceof Error ? e.message : String(e);
    return resultado;
  }
  if (!t) return resultado;

  const candidatas = await prisma.notificacao.findMany({
    where: { status: { in: ["pendente", "falhou"] }, tentativas: { lt: MAX_TENTATIVAS }, proximaTentativaEm: { lte: agora } },
    orderBy: { criadaEm: "asc" },
    take: limite,
    include: { destinatarios: { select: { email: true } } },
  });

  for (const n of candidatas) {
    const reserva = await prisma.notificacao.updateMany({
      where: { id: n.id, status: { in: ["pendente", "falhou"] }, proximaTentativaEm: { lte: agora } },
      data: { proximaTentativaEm: new Date(+agora + 10 * 60_000) },
    });
    if (!reserva.count) continue; // outra execução pegou este item

    try {
      await t.enviar({ para: n.destinatarios.map((d) => d.email), assunto: n.assunto, html: n.html, texto: n.texto, referencia: `${n.tipo}_${n.chave}` });
      await prisma.notificacao.update({ where: { id: n.id }, data: { status: "enviada", enviadaEm: new Date(), ultimoErro: null } });
      resultado.enviadas++;
    } catch (e) {
      const tentativas = n.tentativas + 1;
      const temporario = !(e instanceof ErroEnvio) || e.temporario;
      await prisma.notificacao.update({
        where: { id: n.id },
        data: {
          status: "falhou",
          tentativas: temporario ? tentativas : MAX_TENTATIVAS,
          ultimoErro: (e instanceof Error ? e.message : String(e)).slice(0, 500),
          proximaTentativaEm: new Date(+agora + esperaAposFalha(tentativas)),
        },
      });
      resultado.falhas++;
    }
  }
  return resultado;
}
