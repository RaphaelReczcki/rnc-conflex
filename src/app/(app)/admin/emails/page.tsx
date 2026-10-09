import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";
import { formatarDataHora } from "@/lib/formato";
import { MAX_TENTATIVAS } from "@/lib/notificacoes/regras";
import { BotoesNotificacoes } from "./BotoesNotificacoes";

export const metadata: Metadata = { title: "E-mails" };

const TIPOS: Record<string, string> = {
  acao_atribuida: "Ação atribuída",
  lembrete_prazo_3d: "Prazo em 3 dias",
  lembrete_prazo_dia: "Prazo hoje",
  verificacao_liberada: "Verificação liberada",
  resumo_semanal: "Resumo semanal",
  redefinicao_senha: "Esqueci a senha",
  teste: "Teste",
};

function modoAtual(): { rotulo: string; detalhe: string; alerta?: boolean } {
  const modo = process.env.EMAIL_MODO ?? (process.env.NODE_ENV === "production" ? "graph" : "arquivo");
  if (modo === "desligado") return { rotulo: "Desligado", detalhe: "Os avisos ficam só registrados aqui, sem envio.", alerta: true };
  if (modo === "arquivo") return { rotulo: "Teste local", detalhe: "Os e-mails são gravados como arquivos na pasta .emails do projeto, sem sair para ninguém." };
  const faltando = ["M365_TENANT_ID", "M365_CLIENT_ID", "M365_CLIENT_SECRET", "EMAIL_REMETENTE"].filter((k) => !process.env[k]);
  if (faltando.length) return { rotulo: "Microsoft 365 sem configuração", detalhe: `Faltam: ${faltando.join(", ")}.`, alerta: true };
  return { rotulo: "Microsoft 365", detalhe: `Enviando como ${process.env.EMAIL_REMETENTE}.` };
}

export default async function PaginaNotificacoes() {
  await exigirGestao();
  const [lista, contagem] = await Promise.all([
    prisma.notificacao.findMany({
      orderBy: { criadaEm: "desc" },
      take: 100,
      include: { destinatarios: { include: { usuario: { select: { nome: true } } } }, rnc: { select: { codigo: true } } },
    }),
    prisma.notificacao.groupBy({ by: ["status"], _count: true }),
  ]);
  const total = (s: string) => contagem.find((c) => c.status === s)?._count ?? 0;
  const modo = modoAtual();

  return (
    <>
      <section className="card">
        <h2>E-mails automáticos</h2>
        <p className="sub">
          Avisos de ação atribuída, lembretes de prazo (3 dias antes e no dia), verificação liberada (para o líder do setor) e o resumo semanal
          da gestão (segunda, 8h). A rotina diária roda às 7h.
        </p>
        <div className={`notice ${modo.alerta ? "alerta" : "ok"}`}>
          <strong>Modo de envio: {modo.rotulo}.</strong> {modo.detalhe}
        </div>
        <div className="kpis" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
          <div className="kpi">
            <div className="v">{total("enviada")}</div>
            <div className="l">Enviados</div>
          </div>
          <div className="kpi">
            <div className="v">{total("pendente")}</div>
            <div className="l">Na fila</div>
          </div>
          <div className={`kpi ${total("falhou") ? "alert" : ""}`}>
            <div className="v">{total("falhou")}</div>
            <div className="l">Com falha</div>
          </div>
        </div>
        <BotoesNotificacoes falhas={total("falhou")} />
      </section>

      <section>
        <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Últimos 100</h2>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Aviso</th>
                <th>Para</th>
                <th className="col-opcional">Assunto</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.length ? (
                lista.map((n) => (
                  <tr key={n.id}>
                    <td>{formatarDataHora(n.enviadaEm ?? n.criadaEm)}</td>
                    <td>
                      {TIPOS[n.tipo]}
                      {n.rnc && (
                        <span className="sub">
                          <Link href={`/rncs/${n.rnc.codigo}`}>{n.rnc.codigo}</Link>
                        </span>
                      )}
                    </td>
                    <td>
                      {n.destinatarios.map((d) => d.usuario.nome).join(", ")}
                      <span className="sub">{n.destinatarios.map((d) => d.email).join(", ")}</span>
                    </td>
                    <td className="col-opcional">{n.assunto}</td>
                    <td>
                      <span className={`pill ${n.status === "enviada" ? "" : "off"}`}>
                        {n.status === "enviada" ? "Enviado" : n.status === "pendente" ? "Na fila" : n.tentativas >= MAX_TENTATIVAS ? "Falhou" : "Vai tentar de novo"}
                      </span>
                      {n.ultimoErro && n.status !== "enviada" && <span className="sub">{n.ultimoErro}</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty">
                    Nenhum e-mail ainda. Eles aparecem aqui quando alguém recebe uma ação, um prazo se aproxima ou uma verificação é liberada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
