// Modelos dos e-mails (HTML + texto puro). Funções puras.
// Todo texto vindo de usuários passa por esc(): nada digitado numa RNC vira HTML.
import { formatarData } from "@/lib/formato";

export type Email = { assunto: string; html: string; texto: string };

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const RODAPE = "Aviso automático do sistema de não conformidades da Conflex. O objetivo é melhorar o processo, não apontar culpados.";

type Bloco = { rotulo: string; valor: string };

// Layout comum: faixa da marca, título, parágrafos, quadro de dados e botão.
function montar({ assunto, titulo, paragrafos, dados = [], link, textoLink }: { assunto: string; titulo: string; paragrafos: string[]; dados?: Bloco[]; link: string; textoLink: string }): Email {
  const linhasDados = dados
    .map((d) => `<tr><td style="padding:4px 12px 4px 0;color:#62708a;white-space:nowrap;vertical-align:top">${esc(d.rotulo)}</td><td style="padding:4px 0;color:#1f2a40">${esc(d.valor)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f6fa;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1f2a40">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe2ec;border-radius:10px;overflow:hidden">
<tr><td style="background:#384c77;border-bottom:3px solid #79c5f1;padding:14px 24px;color:#ffffff;font-weight:600">Conflex · Não conformidades</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:18px;color:#384c77">${esc(titulo)}</h1>
${paragrafos.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${esc(p)}</p>`).join("")}
${linhasDados ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;font-size:14px">${linhasDados}</table>` : ""}
<p style="margin:16px 0 4px"><a href="${esc(link)}" style="display:inline-block;background:#384c77;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${esc(textoLink)}</a></p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f6f9fd;border-top:1px solid #dbe2ec;color:#62708a;font-size:12px">${esc(RODAPE)}</td></tr>
</table></td></tr></table></body></html>`;
  const texto = [titulo, "", ...paragrafos, "", ...dados.map((d) => `${d.rotulo}: ${d.valor}`), "", `${textoLink}: ${link}`, "", "--", RODAPE].join("\n");
  return { assunto, html, texto };
}

export type DadosRnc = { codigo: string; setor: string; tipoProblema: string; link: string };

const resumir = (t: string | null | undefined, max = 300) => {
  const s = (t ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

export function emailAcaoAtribuida(p: DadosRnc & { para: string; quem: string; acao: string | null; prazo: string | null }): Email {
  return montar({
    assunto: `${p.codigo}: você é responsável por uma ação corretiva`,
    titulo: "Uma ação corretiva ficou com você",
    paragrafos: [
      `Olá, ${primeiroNome(p.para)}. ${p.quem} indicou você como responsável pela ação corretiva da ${p.codigo}.`,
      "A ação existe para mudar o processo e evitar que o problema se repita. Se algo não estiver claro ou o prazo não couber, combine com quem indicou ou ajuste na RNC.",
    ],
    dados: [
      { rotulo: "Setor", valor: p.setor },
      { rotulo: "Problema", valor: p.tipoProblema },
      { rotulo: "Ação", valor: resumir(p.acao) || "Ainda em definição" },
      { rotulo: "Prazo", valor: p.prazo ? formatarData(p.prazo) : "Sem prazo definido" },
    ],
    link: p.link,
    textoLink: "Abrir a RNC",
  });
}

export function emailLembretePrazo(p: DadosRnc & { para: string; acao: string | null; prazo: string; emDias: 0 | 3 }): Email {
  const quando = p.emDias === 0 ? "hoje" : `em 3 dias, ${formatarData(p.prazo)}`;
  return montar({
    assunto: p.emDias === 0 ? `${p.codigo}: o prazo da ação é hoje` : `${p.codigo}: o prazo da ação é em 3 dias (${formatarData(p.prazo)})`,
    titulo: p.emDias === 0 ? "O prazo da ação corretiva é hoje" : "Lembrete: prazo da ação corretiva",
    paragrafos: [
      `Olá, ${primeiroNome(p.para)}. Um lembrete: o prazo da ação corretiva da ${p.codigo} é ${quando}.`,
      "Se a ação já foi feita, conclua na RNC para liberar a verificação de eficácia. Se precisar de mais tempo, ajuste o prazo.",
    ],
    dados: [
      { rotulo: "Setor", valor: p.setor },
      { rotulo: "Problema", valor: p.tipoProblema },
      { rotulo: "Ação", valor: resumir(p.acao) },
    ],
    link: p.link,
    textoLink: "Abrir a RNC",
  });
}

export function emailVerificacaoLiberada(p: DadosRnc & { para: string; acao: string | null; verificarEm: string; concluidaPor: string | null }): Email {
  return montar({
    assunto: `${p.codigo}: a verificação de eficácia já pode ser feita`,
    titulo: "Verificação de eficácia liberada",
    paragrafos: [
      `Olá, ${primeiroNome(p.para)}. A ação corretiva da ${p.codigo} foi concluída${p.concluidaPor ? ` por ${p.concluidaPor}` : ""} e a data prevista para verificar a eficácia chegou (${formatarData(p.verificarEm)}).`,
      "Confira se o problema voltou a acontecer desde a ação. Se não voltou, a RNC é encerrada; se voltou, ela retorna para a análise de causa.",
    ],
    dados: [
      { rotulo: "Setor", valor: p.setor },
      { rotulo: "Problema", valor: p.tipoProblema },
      { rotulo: "Ação", valor: resumir(p.acao) },
    ],
    link: p.link,
    textoLink: "Verificar a eficácia",
  });
}

export type DadosResumo = {
  para: string;
  inicio: string;
  fim: string;
  registradas: number;
  encerradas: number;
  abertas: { analise: number; acao: number; verificacao: number };
  atencao: { codigo: string; tipoProblema: string; motivo: string }[];
  recorrentes: { setor: string; tipoProblema: string; total: number }[];
  link: string;
};

export function emailResumoSemanal(p: DadosResumo): Email {
  const total = p.abertas.analise + p.abertas.acao + p.abertas.verificacao;
  return montar({
    assunto: `Resumo semanal das RNCs: ${p.registradas} ${p.registradas === 1 ? "nova" : "novas"}, ${p.atencao.length} ${p.atencao.length === 1 ? "pede" : "pedem"} atenção`,
    titulo: `Resumo da semana (${formatarData(p.inicio)} a ${formatarData(p.fim)})`,
    paragrafos: [
      `Olá, ${primeiroNome(p.para)}. Na última semana foram registradas ${p.registradas} RNCs e encerradas ${p.encerradas}. Há ${total} em aberto.`,
      p.atencao.length
        ? `Pedem atenção: ${p.atencao.slice(0, 10).map((a) => `${a.codigo} (${a.motivo})`).join("; ")}${p.atencao.length > 10 ? `; e mais ${p.atencao.length - 10}` : ""}.`
        : "Nada atrasado: nenhuma ação com prazo vencido, verificação pendente ou crítica sem análise.",
      ...(p.recorrentes.length
        ? [`Problemas que se repetem: ${p.recorrentes.slice(0, 5).map((r) => `${r.tipoProblema} no ${r.setor} (${r.total}×)`).join("; ")}. São bons candidatos a revisar um POP ou checklist.`]
        : []),
    ],
    dados: [
      { rotulo: "Análise de causa", valor: String(p.abertas.analise) },
      { rotulo: "Ação corretiva", valor: String(p.abertas.acao) },
      { rotulo: "Verificação", valor: String(p.abertas.verificacao) },
    ],
    link: p.link,
    textoLink: "Abrir o painel",
  });
}

export function emailTeste(p: { para: string; link: string }): Email {
  return montar({
    assunto: "Teste de envio do sistema de não conformidades",
    titulo: "O envio de e-mails está funcionando",
    paragrafos: [`Olá, ${primeiroNome(p.para)}. Este é um e-mail de teste pedido na tela de notificações. Se ele chegou, os avisos automáticos também vão chegar.`],
    link: p.link,
    textoLink: "Abrir o sistema",
  });
}

export function emailRedefinicaoSenha(p: { para: string; link: string }): Email {
  return montar({
    assunto: "Link para criar uma nova senha",
    titulo: "Criar uma nova senha",
    paragrafos: [
      `Olá, ${primeiroNome(p.para)}. Recebemos um pedido para criar uma nova senha no sistema de não conformidades.`,
      "O link abaixo vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: a sua senha atual continua valendo.",
    ],
    link: p.link,
    textoLink: "Criar nova senha",
  });
}
