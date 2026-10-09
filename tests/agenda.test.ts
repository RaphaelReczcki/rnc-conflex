import { describe, expect, it } from "vitest";
import { oQueRodar } from "@/lib/notificacoes/agenda";

// Horários em Brasília (UTC-3)
const em = (iso: string) => new Date(`${iso}-03:00`);
const nada = { ultimaDiaria: null, ultimoResumo: null };

describe("agenda das rotinas de e-mail", () => {
  it("rotina diária a partir das 7h, uma vez por dia", () => {
    expect(oQueRodar(em("2026-10-08T06:59:00"), nada).diaria).toBeNull();
    expect(oQueRodar(em("2026-10-08T07:00:00"), nada).diaria).toBe("2026-10-08");
    expect(oQueRodar(em("2026-10-08T15:00:00"), { ...nada, ultimaDiaria: "2026-10-08" }).diaria).toBeNull();
    expect(oQueRodar(em("2026-10-09T07:01:00"), { ...nada, ultimaDiaria: "2026-10-08" }).diaria).toBe("2026-10-09");
  });
  it("servidor que reiniciou depois das 7h roda a rotina ao voltar", () => {
    expect(oQueRodar(em("2026-10-08T14:30:00"), nada).diaria).toBe("2026-10-08");
  });
  it("resumo só na segunda, a partir das 8h, uma vez por semana", () => {
    expect(oQueRodar(em("2026-10-12T07:59:00"), nada).resumo).toBeNull(); // segunda, antes das 8h
    expect(oQueRodar(em("2026-10-12T08:00:00"), nada).resumo).toBe("2026-W42");
    expect(oQueRodar(em("2026-10-12T10:00:00"), { ...nada, ultimoResumo: "2026-W42" }).resumo).toBeNull();
    expect(oQueRodar(em("2026-10-13T09:00:00"), nada).resumo).toBeNull(); // terça
  });
  it("usa o horário de Brasília mesmo com o servidor em UTC", () => {
    // 10:30 UTC = 07:30 em Brasília
    expect(oQueRodar(new Date("2026-10-08T10:30:00Z"), nada).diaria).toBe("2026-10-08");
    // 09:30 UTC = 06:30 em Brasília: ainda não
    expect(oQueRodar(new Date("2026-10-08T09:30:00Z"), nada).diaria).toBeNull();
  });
});
