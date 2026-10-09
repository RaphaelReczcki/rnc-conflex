// Regras das notificações, sem banco: quem recebe o quê e quando.
import { somarDias } from "@/lib/datas";

export const MAX_TENTATIVAS = 6;

// Espera antes de tentar de novo: 5 min, 10, 20, 40… até 6 horas.
export function esperaAposFalha(tentativas: number): number {
  return Math.min(5 * 2 ** Math.max(0, tentativas - 1), 360) * 60_000;
}

// Semana ISO (segunda a domingo) de uma data AAAA-MM-DD: "2026-W41"
export function semanaIso(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dia + 3); // quinta-feira da mesma semana
  const ano = d.getUTCFullYear();
  const primeiraQuinta = new Date(Date.UTC(ano, 0, 4));
  const semana = 1 + Math.round(((+d - +primeiraQuinta) / 86_400_000 - 3 + ((primeiraQuinta.getUTCDay() + 6) % 7)) / 7);
  return `${ano}-W${String(semana).padStart(2, "0")}`;
}

export type AcaoAberta = {
  acaoId: string;
  ciclo: number;
  cicloAtual: number;
  statusRnc: string;
  prazo: string | null;
  concluida: boolean;
  responsavelAtivo: boolean;
};

export type Lembrete = { acaoId: string; emDias: 0 | 3; chave: string };

// Lembretes do dia: 3 dias antes e no dia do prazo, só para ações em andamento.
export function lembretesDoDia(acoes: AcaoAberta[], hoje: string): Lembrete[] {
  const em3 = somarDias(hoje, 3);
  const r: Lembrete[] = [];
  for (const a of acoes) {
    if (a.concluida || a.statusRnc !== "acao" || a.ciclo !== a.cicloAtual || !a.prazo || !a.responsavelAtivo) continue;
    // O prazo entra na chave: se for alterado, o lembrete do novo prazo também sai
    if (a.prazo === hoje) r.push({ acaoId: a.acaoId, emDias: 0, chave: `lembrete_prazo_dia:${a.acaoId}:${a.prazo}` });
    else if (a.prazo === em3) r.push({ acaoId: a.acaoId, emDias: 3, chave: `lembrete_prazo_3d:${a.acaoId}:${a.prazo}` });
  }
  return r;
}

export type VerificacaoPendente = {
  acaoId: string;
  ciclo: number;
  cicloAtual: number;
  statusRnc: string;
  verificarEm: string | null;
};

// Verificação liberada: RNC aguardando verificação e a data prevista chegou.
export function verificacoesLiberadas(itens: VerificacaoPendente[], hoje: string): { acaoId: string; chave: string }[] {
  return itens
    .filter((v) => v.statusRnc === "verificacao" && v.ciclo === v.cicloAtual && v.verificarEm && v.verificarEm <= hoje)
    .map((v) => ({ acaoId: v.acaoId, chave: `verificacao_liberada:${v.acaoId}` }));
}

// Quem recebe o aviso de verificação: os líderes ativos do setor; sem líder, a gestão.
export function destinatariosVerificacao<T extends { perfil: string; setorId: string | null; ativo: boolean }>(usuarios: T[], setorId: string): T[] {
  const lideres = usuarios.filter((u) => u.ativo && u.perfil === "lider_setor" && u.setorId === setorId);
  return lideres.length ? lideres : usuarios.filter((u) => u.ativo && u.perfil === "gestao");
}
