import { NextResponse, type NextRequest } from "next/server";
import { cronAutorizado, naoAutorizado } from "@/lib/notificacoes/cron";
import { rotinaDiaria } from "@/lib/notificacoes/agendadas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Todo dia às 7h (Brasília): lembretes de prazo, verificações liberadas e reenvios.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();
  return NextResponse.json(await rotinaDiaria());
}
