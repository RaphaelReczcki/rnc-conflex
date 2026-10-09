import { NextResponse, type NextRequest } from "next/server";
import { cronAutorizado, naoAutorizado } from "@/lib/notificacoes/cron";
import { resumoSemanal } from "@/lib/notificacoes/agendadas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Segunda-feira às 8h (Brasília): resumo semanal para a gestão.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();
  return NextResponse.json(await resumoSemanal());
}
