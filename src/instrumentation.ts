// Roda uma vez quando o servidor sobe. Em produção, liga o agendador das
// rotinas de e-mail. AGENDADOR=desligado desliga (ex.: quando houver um cron externo).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const ligado = process.env.AGENDADOR ? process.env.AGENDADOR !== "desligado" : process.env.NODE_ENV === "production";
  if (!ligado) return;
  const { iniciarAgendador } = await import("./lib/notificacoes/agendador");
  iniciarAgendador();
}
