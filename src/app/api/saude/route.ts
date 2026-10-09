import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Para o Railway (e quem monitora) saber se o sistema e o banco estão no ar.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, erro: "banco indisponível" }, { status: 503 });
  }
}
