// Como o e-mail sai: Microsoft Graph (produção), arquivo (desenvolvimento)
// ou memória (testes). Escolhido por EMAIL_MODO.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Mensagem = { para: string[]; assunto: string; html: string; texto: string; referencia?: string };
export type Transporte = { nome: string; enviar(m: Mensagem): Promise<void> };

// Falha que vale tentar de novo (rede, limite de envio, instabilidade do M365)
export class ErroEnvio extends Error {
  constructor(
    mensagem: string,
    readonly temporario: boolean,
  ) {
    super(mensagem);
  }
}

// ---------- Microsoft Graph (client credentials) ----------

type ConfigGraph = { tenantId: string; clientId: string; clientSecret: string; remetente: string; fetch?: typeof fetch };

export function transporteGraph(cfg: ConfigGraph): Transporte {
  const f = cfg.fetch ?? fetch;
  let token: { valor: string; expiraEm: number } | null = null;

  async function obterToken(): Promise<string> {
    if (token && token.expiraEm > Date.now() + 60_000) return token.valor;
    const r = await f(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    if (!r.ok) {
      // Sem detalhes do corpo: pode conter dados da configuração
      throw new ErroEnvio(`Falha ao autenticar no Microsoft 365 (HTTP ${r.status}). Confira tenant, client id e segredo.`, r.status >= 500);
    }
    const j = (await r.json()) as { access_token: string; expires_in: number };
    token = { valor: j.access_token, expiraEm: Date.now() + j.expires_in * 1000 };
    return token.valor;
  }

  return {
    nome: "graph",
    async enviar(m) {
      const r = await f(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.remetente)}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await obterToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject: m.assunto,
            body: { contentType: "HTML", content: m.html },
            toRecipients: m.para.map((address) => ({ emailAddress: { address } })),
          },
          saveToSentItems: true,
        }),
      });
      if (r.status === 202) return;
      if (r.status === 401) token = null;
      const temporario = r.status === 429 || r.status >= 500 || r.status === 401;
      let detalhe = "";
      try {
        detalhe = ((await r.json()) as { error?: { code?: string } }).error?.code ?? "";
      } catch {}
      throw new ErroEnvio(`Microsoft 365 recusou o envio (HTTP ${r.status}${detalhe ? `, ${detalhe}` : ""}).`, temporario);
    },
  };
}

// ---------- Arquivo (desenvolvimento) ----------

export function transporteArquivo(pasta: string): Transporte {
  return {
    nome: "arquivo",
    async enviar(m) {
      await mkdir(pasta, { recursive: true });
      const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
      const nome = `${carimbo}_${(m.referencia ?? "email").replace(/[^\w-]+/g, "_").slice(0, 60)}.html`;
      const cabecalho = `<!--\nPara: ${m.para.join(", ")}\nAssunto: ${m.assunto}\n-->\n`;
      await writeFile(join(pasta, nome), cabecalho + m.html, "utf8");
    },
  };
}

// ---------- Memória (testes) ----------

export function transporteMemoria(): Transporte & { enviadas: Mensagem[]; falharCom?: ErroEnvio } {
  const t: Transporte & { enviadas: Mensagem[]; falharCom?: ErroEnvio } = {
    nome: "memoria",
    enviadas: [],
    async enviar(m) {
      if (t.falharCom) throw t.falharCom;
      t.enviadas.push(m);
    },
  };
  return t;
}

// ---------- Escolha pelo ambiente ----------

export function transportePadrao(env: NodeJS.ProcessEnv = process.env): Transporte | null {
  const modo = env.EMAIL_MODO ?? (env.NODE_ENV === "production" ? "graph" : "arquivo");
  if (modo === "desligado") return null;
  if (modo === "arquivo") return transporteArquivo(env.EMAIL_PASTA ?? join(process.cwd(), ".emails"));
  const faltando = ["M365_TENANT_ID", "M365_CLIENT_ID", "M365_CLIENT_SECRET", "EMAIL_REMETENTE"].filter((k) => !env[k]);
  if (faltando.length) throw new ErroEnvio(`Envio pelo Microsoft 365 sem configuração: defina ${faltando.join(", ")}.`, false);
  return transporteGraph({
    tenantId: env.M365_TENANT_ID!,
    clientId: env.M365_CLIENT_ID!,
    clientSecret: env.M365_CLIENT_SECRET!,
    remetente: env.EMAIL_REMETENTE!,
  });
}
