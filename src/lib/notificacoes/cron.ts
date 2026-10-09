import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// O Vercel Cron chama as rotas com "Authorization: Bearer <CRON_SECRET>".
// Sem o segredo certo, ninguém de fora dispara envios.
export function cronAutorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export function naoAutorizado() {
  return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
}
