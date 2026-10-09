import "server-only";
import { oQueRodar, type Estado } from "./agenda";
import { resumoSemanal, rotinaDiaria } from "./agendadas";
import { processarFila } from "./fila";

// Agendador dentro do próprio servidor (Railway roda um processo contínuo):
// a cada minuto confere se é hora das rotinas; a cada 10 minutos reenvia o
// que ficou na fila por falha temporária.
const estado: Estado = { ultimaDiaria: null, ultimoResumo: null };
let rodando = false;
let minutos = 0;

async function tique() {
  if (rodando) return;
  rodando = true;
  try {
    const agora = new Date();
    const r = oQueRodar(agora, estado);
    if (r.diaria) {
      const res = await rotinaDiaria({ agora });
      estado.ultimaDiaria = r.diaria;
      console.log(`[agendador] rotina diária ${r.diaria}:`, JSON.stringify(res));
    }
    if (r.resumo) {
      const res = await resumoSemanal({ agora });
      estado.ultimoResumo = r.resumo;
      console.log(`[agendador] resumo semanal ${r.resumo}:`, JSON.stringify(res));
    }
    if (++minutos % 10 === 0) await processarFila();
  } catch (e) {
    // Tenta de novo no próximo minuto
    console.error("[agendador] falha:", e instanceof Error ? e.message : e);
  } finally {
    rodando = false;
  }
}

export function iniciarAgendador() {
  const g = globalThis as unknown as { agendadorRnc?: NodeJS.Timeout };
  if (g.agendadorRnc) return;
  g.agendadorRnc = setInterval(tique, 60_000);
  g.agendadorRnc.unref?.();
  setTimeout(tique, 15_000); // primeira conferência logo depois de subir
  console.log("[agendador] rotinas de e-mail ativas (diária 7h, resumo segunda 8h, horário de Brasília)");
}
