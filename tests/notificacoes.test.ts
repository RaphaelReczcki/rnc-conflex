import { describe, expect, it, vi } from "vitest";
import { destinatariosVerificacao, esperaAposFalha, lembretesDoDia, semanaIso, verificacoesLiberadas, type AcaoAberta } from "@/lib/notificacoes/regras";
import { emailAcaoAtribuida, emailLembretePrazo, emailResumoSemanal, esc } from "@/lib/email/modelos";
import { ErroEnvio, transporteGraph, transportePadrao } from "@/lib/email/transporte";

describe("semana ISO do resumo", () => {
  it("segunda a domingo, ano ISO", () => {
    expect(semanaIso("2026-10-08")).toBe("2026-W41");
    expect(semanaIso("2026-10-05")).toBe("2026-W41"); // segunda
    expect(semanaIso("2026-10-11")).toBe("2026-W41"); // domingo
    expect(semanaIso("2026-10-12")).toBe("2026-W42");
    expect(semanaIso("2027-01-01")).toBe("2026-W53"); // sexta: ainda é a última semana de 2026
    expect(semanaIso("2025-12-29")).toBe("2026-W01"); // segunda que já pertence a 2026
  });
});

describe("espera entre tentativas", () => {
  it("cresce de 5 em 5 minutos dobrando, até 6 horas", () => {
    expect([1, 2, 3, 4].map((t) => esperaAposFalha(t) / 60_000)).toEqual([5, 10, 20, 40]);
    expect(esperaAposFalha(20) / 60_000).toBe(360);
  });
});

describe("lembretes de prazo", () => {
  const hoje = "2026-10-08";
  const base: AcaoAberta = { acaoId: "a", ciclo: 1, cicloAtual: 1, statusRnc: "acao", prazo: hoje, concluida: false, responsavelAtivo: true };
  it("no dia do prazo e 3 dias antes", () => {
    const r = lembretesDoDia(
      [
        { ...base, acaoId: "hoje" },
        { ...base, acaoId: "em3", prazo: "2026-10-11" },
        { ...base, acaoId: "em2", prazo: "2026-10-10" },
        { ...base, acaoId: "venceu", prazo: "2026-10-07" },
      ],
      hoje,
    );
    expect(r).toEqual([
      { acaoId: "hoje", emDias: 0, chave: "lembrete_prazo_dia:hoje:2026-10-08" },
      { acaoId: "em3", emDias: 3, chave: "lembrete_prazo_3d:em3:2026-10-11" },
    ]);
  });
  it("não lembra ação concluída, de ciclo antigo, sem prazo, de responsável inativo ou fora da etapa", () => {
    expect(
      lembretesDoDia(
        [
          { ...base, concluida: true },
          { ...base, ciclo: 1, cicloAtual: 2 },
          { ...base, prazo: null },
          { ...base, responsavelAtivo: false },
          { ...base, statusRnc: "verificacao" },
        ],
        hoje,
      ),
    ).toEqual([]);
  });
  it("prazo alterado gera chave nova (o lembrete do novo prazo também sai)", () => {
    const a = lembretesDoDia([{ ...base, prazo: "2026-10-11" }], hoje)[0].chave;
    const b = lembretesDoDia([{ ...base, prazo: "2026-10-08" }], hoje)[0].chave;
    expect(a).not.toBe(b);
  });
});

describe("verificação liberada", () => {
  it("só quando a data prevista chegou, no ciclo atual", () => {
    const r = verificacoesLiberadas(
      [
        { acaoId: "ontem", ciclo: 1, cicloAtual: 1, statusRnc: "verificacao", verificarEm: "2026-10-07" },
        { acaoId: "hoje", ciclo: 1, cicloAtual: 1, statusRnc: "verificacao", verificarEm: "2026-10-08" },
        { acaoId: "amanha", ciclo: 1, cicloAtual: 1, statusRnc: "verificacao", verificarEm: "2026-10-09" },
        { acaoId: "encerrada", ciclo: 1, cicloAtual: 1, statusRnc: "encerrada", verificarEm: "2026-10-01" },
        { acaoId: "antiga", ciclo: 1, cicloAtual: 2, statusRnc: "verificacao", verificarEm: "2026-10-01" },
      ],
      "2026-10-08",
    );
    expect(r.map((x) => x.acaoId)).toEqual(["ontem", "hoje"]);
  });
  it("vai para os líderes ativos do setor; sem líder, para a gestão", () => {
    const u = [
      { id: "l1", perfil: "lider_setor", setorId: "fiscal", ativo: true },
      { id: "l2", perfil: "lider_setor", setorId: "fiscal", ativo: false },
      { id: "l3", perfil: "lider_setor", setorId: "folha", ativo: true },
      { id: "g", perfil: "gestao", setorId: null, ativo: true },
    ];
    expect(destinatariosVerificacao(u, "fiscal").map((x) => x.id)).toEqual(["l1"]);
    expect(destinatariosVerificacao(u, "contabil").map((x) => x.id)).toEqual(["g"]);
  });
});

describe("modelos de e-mail", () => {
  const rnc = { codigo: "RNC-2026-0001", setor: "Fiscal", tipoProblema: "Guia paga em atraso", link: "https://rnc.conflex.com.br/rncs/RNC-2026-0001" };
  it("escapa HTML de tudo o que foi digitado", () => {
    expect(esc(`<script>alert("x")</script> & 'y'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
    const e = emailAcaoAtribuida({ ...rnc, tipoProblema: "<img src=x onerror=alert(1)>", para: "Ana Souza", quem: "Bruno", acao: "<b>negrito</b>", prazo: "2026-10-20" });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).not.toContain("<b>negrito</b>");
    expect(e.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("ação atribuída: assunto, saudação pelo primeiro nome, prazo em dd/mm/aaaa e link", () => {
    const e = emailAcaoAtribuida({ ...rnc, para: "Ana Souza", quem: "Bruno Lima", acao: "Revisar o checklist", prazo: "2026-10-20" });
    expect(e.assunto).toBe("RNC-2026-0001: você é responsável por uma ação corretiva");
    expect(e.texto).toContain("Olá, Ana. Bruno Lima indicou você");
    expect(e.texto).toContain("Prazo: 20/10/2026");
    expect(e.texto).toContain(rnc.link);
    expect(e.html).toContain(`href="${rnc.link}"`);
  });
  it("sem prazo definido", () => {
    expect(emailAcaoAtribuida({ ...rnc, para: "Ana", quem: "Bruno", acao: null, prazo: null }).texto).toContain("Prazo: Sem prazo definido");
  });
  it("lembretes: hoje e em 3 dias", () => {
    expect(emailLembretePrazo({ ...rnc, para: "Ana", acao: "x", prazo: "2026-10-08", emDias: 0 }).assunto).toBe("RNC-2026-0001: o prazo da ação é hoje");
    expect(emailLembretePrazo({ ...rnc, para: "Ana", acao: "x", prazo: "2026-10-11", emDias: 3 }).assunto).toBe("RNC-2026-0001: o prazo da ação é em 3 dias (11/10/2026)");
  });
  it("tom não punitivo: sem palavras de cobrança", () => {
    const textos = [
      emailAcaoAtribuida({ ...rnc, para: "Ana", quem: "Bruno", acao: "x", prazo: "2026-10-20" }),
      emailLembretePrazo({ ...rnc, para: "Ana", acao: "x", prazo: "2026-10-08", emDias: 0 }),
    ].map((e) => e.texto.split("\n--\n")[0].toLowerCase()); // o rodapé diz "não apontar culpados"
    for (const t of textos) for (const palavra of ["culpa", "falha sua", "atrasad", "cobrança", "advertência"]) expect(t).not.toContain(palavra);
  });
  it("resumo semanal: singular e plural no assunto", () => {
    const base = { para: "Gestão", inicio: "2026-10-01", fim: "2026-10-07", encerradas: 0, abertas: { analise: 1, acao: 0, verificacao: 0 }, recorrentes: [], link: "x" };
    expect(emailResumoSemanal({ ...base, registradas: 1, atencao: [] }).assunto).toBe("Resumo semanal das RNCs: 1 nova, 0 pedem atenção");
    expect(emailResumoSemanal({ ...base, registradas: 3, atencao: [{ codigo: "A", tipoProblema: "t", motivo: "m" }] }).assunto).toBe("Resumo semanal das RNCs: 3 novas, 1 pede atenção");
  });
});

describe("envio pelo Microsoft Graph", () => {
  const cfg = { tenantId: "tenant", clientId: "cliente", clientSecret: "segredo", remetente: "rnc@conflex.com.br" };
  const resposta = (status: number, corpo: unknown = {}) => new Response(status === 202 ? null : JSON.stringify(corpo), { status });

  it("pede o token e envia com o remetente configurado", async () => {
    const f = vi.fn().mockResolvedValueOnce(resposta(200, { access_token: "tk", expires_in: 3600 })).mockResolvedValueOnce(resposta(202));
    await transporteGraph({ ...cfg, fetch: f }).enviar({ para: ["ana@conflex.com.br"], assunto: "A", html: "<p>x</p>", texto: "x" });
    expect(f.mock.calls[0][0]).toBe("https://login.microsoftonline.com/tenant/oauth2/v2.0/token");
    const corpoToken = String(f.mock.calls[0][1].body);
    expect(corpoToken).toContain("grant_type=client_credentials");
    expect(corpoToken).toContain("scope=https%3A%2F%2Fgraph.microsoft.com%2F.default");
    expect(f.mock.calls[1][0]).toBe("https://graph.microsoft.com/v1.0/users/rnc%40conflex.com.br/sendMail");
    expect(f.mock.calls[1][1].headers.Authorization).toBe("Bearer tk");
    const msg = JSON.parse(f.mock.calls[1][1].body).message;
    expect(msg).toEqual({ subject: "A", body: { contentType: "HTML", content: "<p>x</p>" }, toRecipients: [{ emailAddress: { address: "ana@conflex.com.br" } }] });
  });

  it("reaproveita o token entre envios", async () => {
    const f = vi.fn().mockResolvedValueOnce(resposta(200, { access_token: "tk", expires_in: 3600 })).mockResolvedValue(resposta(202));
    const t = transporteGraph({ ...cfg, fetch: f });
    await t.enviar({ para: ["a@x"], assunto: "1", html: "", texto: "" });
    await t.enviar({ para: ["a@x"], assunto: "2", html: "", texto: "" });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("limite de envio (429) e erro do servidor são temporários; permissão negada não", async () => {
    const falha = async (status: number) => {
      const f = vi.fn().mockResolvedValueOnce(resposta(200, { access_token: "tk", expires_in: 3600 })).mockResolvedValueOnce(resposta(status, { error: { code: "X" } }));
      return transporteGraph({ ...cfg, fetch: f }).enviar({ para: ["a@x"], assunto: "", html: "", texto: "" }).catch((e) => e);
    };
    for (const s of [429, 503]) expect(((await falha(s)) as ErroEnvio).temporario).toBe(true);
    const negado = (await falha(403)) as ErroEnvio;
    expect(negado).toBeInstanceOf(ErroEnvio);
    expect(negado.temporario).toBe(false);
    expect(negado.message).toContain("403");
  });

  it("token recusado não expõe o segredo na mensagem", async () => {
    const f = vi.fn().mockResolvedValueOnce(resposta(401, { error_description: "segredo inválido: segredo" }));
    const e = (await transporteGraph({ ...cfg, fetch: f }).enviar({ para: ["a@x"], assunto: "", html: "", texto: "" }).catch((x) => x)) as ErroEnvio;
    expect(e.message).not.toContain("segredo inválido");
    expect(e.temporario).toBe(false);
  });
});

describe("modo de envio pelo ambiente", () => {
  it("arquivo no desenvolvimento, desligado quando pedido", () => {
    expect(transportePadrao({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv)?.nome).toBe("arquivo");
    expect(transportePadrao({ EMAIL_MODO: "desligado" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
  it("Microsoft 365 sem configuração avisa o que falta", () => {
    expect(() => transportePadrao({ EMAIL_MODO: "graph", EMAIL_REMETENTE: "rnc@conflex.com.br" } as unknown as NodeJS.ProcessEnv)).toThrow(/M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET/);
  });
});
