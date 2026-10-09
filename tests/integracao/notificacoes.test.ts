// Notificações contra o banco de teste: fila, rotinas e falhas de envio.
// Usa datas em 2031 para não se misturar com os dados de outros testes.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ErroEnvio, transporteMemoria } from "@/lib/email/transporte";
import { processarFila } from "@/lib/notificacoes/fila";
import { resumoSemanal, rotinaDiaria } from "@/lib/notificacoes/agendadas";
import { MAX_TENTATIVAS } from "@/lib/notificacoes/regras";
import { salvarAcao, salvarAnalise, type Ator } from "@/lib/rnc/ciclo-servico";
import { registrarRnc } from "@/lib/rnc/registro";

const sufixo = randomUUID().slice(0, 8);
// 10/03/2031 (segunda-feira), 9h em Brasília
const agora = new Date("2031-03-10T12:00:00Z");
let setor: string;
let gestao: Ator & { email: string };
let lider: Ator & { email: string };
let colab: Ator & { email: string };

async function usuario(nome: string, perfil: Ator["perfil"], setorId: string | null) {
  const u = await prisma.usuario.create({ data: { nome: `${nome} ${sufixo}`, email: `${nome.toLowerCase()}.${sufixo}@conflex.com.br`, perfil, setorId } });
  return { id: u.id, perfil: u.perfil, setorId: u.setorId, ativo: true, email: u.email };
}

async function rncNaAcao(acao: Record<string, string>) {
  const { codigo } = await registrarRnc(
    { setorId: setor, dataOcorrencia: "2026-10-01", cliente: "", tipoProblema: `Notificação ${sufixo}`, origem: "erro_interno", severidade: "media", descricao: "Teste de notificação", correcaoImediata: "", multasJuros: 0, horasRetrabalho: 0 },
    colab.id,
  );
  await salvarAnalise(lider, codigo, { metodo: "cinco_porques", causaRaiz: "Causa de teste" }, true);
  await salvarAcao(lider, codigo, { descricao: "Ação de teste", ...acao }, false);
  return codigo;
}

const doTeste = (t: ReturnType<typeof transporteMemoria>, codigo: string) => t.enviadas.filter((m) => m.assunto.startsWith(codigo));

beforeAll(async () => {
  setor = (await prisma.setor.create({ data: { nome: `Notificações ${sufixo}` } })).id;
  gestao = await usuario("Gestao", "gestao", null);
  lider = await usuario("Lider", "lider_setor", setor);
  colab = await usuario("Colab", "colaborador", setor);
  // Esvazia a fila de outros testes
  await processarFila({ transporte: transporteMemoria(), limite: 1000 });
});

describe("ação atribuída", () => {
  it("entra na fila junto com a escolha do responsável e sai no processamento", async () => {
    const codigo = await rncNaAcao({ responsavelId: colab.id, prazo: "2031-04-01" });
    const n = await prisma.notificacao.findFirstOrThrow({ where: { tipo: "acao_atribuida", rnc: { codigo } }, include: { destinatarios: true } });
    expect(n.status).toBe("pendente");
    expect(n.destinatarios.map((d) => d.email)).toEqual([colab.email]);

    const t = transporteMemoria();
    await processarFila({ transporte: t });
    const [m] = doTeste(t, codigo);
    expect(m.para).toEqual([colab.email]);
    expect(m.texto).toContain(`Lider ${sufixo} indicou você`);
    expect((await prisma.notificacao.findUniqueOrThrow({ where: { id: n.id } })).status).toBe("enviada");
  });

  it("não avisa quem nomeou a si mesmo", async () => {
    const codigo = await rncNaAcao({ responsavelId: lider.id });
    expect(await prisma.notificacao.count({ where: { tipo: "acao_atribuida", rnc: { codigo } } })).toBe(0);
  });
});

describe("rotina diária", () => {
  it("lembra 3 dias antes e no dia do prazo, sem repetir se rodar de novo", async () => {
    const em3 = await rncNaAcao({ responsavelId: colab.id, prazo: "2031-03-13" });
    const hoje = await rncNaAcao({ responsavelId: colab.id, prazo: "2031-03-10" });
    const longe = await rncNaAcao({ responsavelId: colab.id, prazo: "2031-03-20" });

    const t = transporteMemoria();
    await rotinaDiaria({ agora, transporte: t });
    expect(doTeste(t, em3).map((m) => m.assunto)).toContain(`${em3}: o prazo da ação é em 3 dias (13/03/2031)`);
    expect(doTeste(t, hoje).map((m) => m.assunto)).toContain(`${hoje}: o prazo da ação é hoje`);
    expect(doTeste(t, longe).filter((m) => m.assunto.includes("prazo"))).toHaveLength(0);

    const t2 = transporteMemoria();
    await rotinaDiaria({ agora, transporte: t2 });
    expect(t2.enviadas.filter((m) => m.assunto.includes("prazo") && [em3, hoje].some((c) => m.assunto.startsWith(c)))).toHaveLength(0);
  });

  it("avisa o líder do setor quando a verificação fica liberada", async () => {
    const codigo = await rncNaAcao({ responsavelId: colab.id, verificarEm: "2031-03-10" });
    await salvarAcao(colab, codigo, { descricao: "Ação de teste", responsavelId: colab.id, verificarEm: "2031-03-10" }, true);
    const t = transporteMemoria();
    await rotinaDiaria({ agora, transporte: t });
    const avisos = doTeste(t, codigo).filter((m) => m.assunto.includes("verificação"));
    expect(avisos.map((m) => m.para)).toEqual([[lider.email]]);
  });
});

describe("resumo semanal", () => {
  it("um por pessoa da gestão, uma vez por semana", async () => {
    const t = transporteMemoria();
    await resumoSemanal({ agora, transporte: t });
    const meu = t.enviadas.filter((m) => m.para[0] === gestao.email);
    expect(meu).toHaveLength(1);
    expect(meu[0].assunto).toMatch(/^Resumo semanal das RNCs/);
    const t2 = transporteMemoria();
    await resumoSemanal({ agora, transporte: t2 });
    expect(t2.enviadas.filter((m) => m.para[0] === gestao.email)).toHaveLength(0);
  });
});

describe("na mesma execução", () => {
  it("o que a rotina coloca na fila sai na mesma chamada (hora real)", async () => {
    const t = transporteMemoria();
    const r = await resumoSemanal({ transporte: t });
    expect(r.enfileiradas).toBeGreaterThan(0);
    expect(r.enviadas).toBeGreaterThanOrEqual(r.enfileiradas);
    expect(r.falhas).toBe(0);
  });
});

describe("falhas de envio", () => {
  it("falha temporária: fica para tentar de novo mais tarde, e depois sai", async () => {
    const codigo = await rncNaAcao({ responsavelId: colab.id });
    const ruim = transporteMemoria();
    ruim.falharCom = new ErroEnvio("instável", true);
    await processarFila({ transporte: ruim, agora });
    const n = await prisma.notificacao.findFirstOrThrow({ where: { tipo: "acao_atribuida", rnc: { codigo } } });
    expect(n.status).toBe("falhou");
    expect(n.tentativas).toBe(1);
    expect(+n.proximaTentativaEm).toBeGreaterThan(+agora);

    // Antes da hora marcada, não tenta de novo
    const bom = transporteMemoria();
    await processarFila({ transporte: bom, agora });
    expect(doTeste(bom, codigo)).toHaveLength(0);
    // Depois da espera, envia
    await processarFila({ transporte: bom, agora: new Date(+agora + 6 * 60_000) });
    expect(doTeste(bom, codigo)).toHaveLength(1);
  });

  it("falha definitiva (ex.: permissão negada) não fica tentando", async () => {
    const codigo = await rncNaAcao({ responsavelId: colab.id });
    const ruim = transporteMemoria();
    ruim.falharCom = new ErroEnvio("Microsoft 365 recusou o envio (HTTP 403).", false);
    await processarFila({ transporte: ruim, agora });
    const n = await prisma.notificacao.findFirstOrThrow({ where: { tipo: "acao_atribuida", rnc: { codigo } } });
    expect(n.tentativas).toBe(MAX_TENTATIVAS);
    expect(n.ultimoErro).toContain("403");
  });

  it("duas execuções ao mesmo tempo não mandam o mesmo e-mail duas vezes", async () => {
    const codigo = await rncNaAcao({ responsavelId: colab.id });
    const t = transporteMemoria();
    await Promise.all([processarFila({ transporte: t, agora }), processarFila({ transporte: t, agora }), processarFila({ transporte: t, agora })]);
    expect(doTeste(t, codigo)).toHaveLength(1);
  });
});
