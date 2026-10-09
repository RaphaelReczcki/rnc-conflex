// O banco precisa trabalhar em UTC, como o Neon. Se o fuso do servidor for
// outro, as datas gravadas pelo Prisma e as geradas pelo banco divergem.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

describe("fuso do banco", () => {
  it("o servidor está em UTC", async () => {
    const [{ tz }] = await prisma.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`;
    expect(["UTC", "Etc/UTC"]).toContain(tz);
  });

  it("data gravada pelo sistema e pelo banco batem (sem desvio de horas)", async () => {
    const [{ agora }] = await prisma.$queryRaw<{ agora: Date }[]>`SELECT now() AS agora`;
    const setor = await prisma.setor.create({ data: { nome: `Fuso ${Date.now()}` } });
    // criado_em vem do default do banco; atualizado_em é enviado pelo Prisma
    const lido = await prisma.setor.findUniqueOrThrow({ where: { id: setor.id } });
    expect(Math.abs(+lido.criadoEm - +agora)).toBeLessThan(60_000);
    expect(Math.abs(+lido.atualizadoEm - Date.now())).toBeLessThan(60_000);
    expect(Math.abs(+lido.criadoEm - +lido.atualizadoEm)).toBeLessThan(60_000);
  });
});
