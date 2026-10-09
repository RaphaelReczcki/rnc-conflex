// Quando rodar as rotinas de e-mail (horário de Brasília). Função pura.
// Rotina diária: a partir das 7h, uma vez por dia. Resumo: segunda, a partir das 8h,
// uma vez por semana. Se o servidor reiniciar depois do horário, roda ao voltar
// (as chaves únicas da fila impedem e-mail repetido).
import { hojeEmBrasilia } from "@/lib/rnc/codigo";
import { semanaIso } from "./regras";

const horaBrasilia = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
const diaSemanaBrasilia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });

export const HORA_DIARIA = 7;
export const HORA_RESUMO = 8;

export type Estado = { ultimaDiaria: string | null; ultimoResumo: string | null };

export function oQueRodar(agora: Date, estado: Estado): { diaria: string | null; resumo: string | null } {
  const hoje = hojeEmBrasilia(agora);
  const hora = Number(horaBrasilia.format(agora));
  const segunda = diaSemanaBrasilia.format(agora) === "Mon";
  const semana = semanaIso(hoje);
  return {
    diaria: hora >= HORA_DIARIA && estado.ultimaDiaria !== hoje ? hoje : null,
    resumo: segunda && hora >= HORA_RESUMO && estado.ultimoResumo !== semana ? semana : null,
  };
}
