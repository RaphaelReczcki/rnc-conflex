// Ciclo da RNC contra o banco de teste: transições, permissões, reabertura,
// histórico e concorrência. Cada execução cria dados com nomes únicos.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ErroCiclo } from "@/lib/rnc/ciclo";
import { atualizarImpacto, registrarVerificacao, salvarAcao, salvarAnalise, type Ator } from "@/lib/rnc/ciclo-servico";
import { registrarRnc } from "@/lib/rnc/registro";

const sufixo = randomUUID().slice(0, 8);
let setorA: string;
let setorB: string;
let gestao: Ator, liderA: Ator, liderB: Ator, autor: Ator, responsavel: Ator, outro: Ator;

async function criarUsuario(nome: string, perfil: Ator["perfil"], setorId: string | null): Promise<Ator> {
  const u = await prisma.usuario.create({
    data: { nome: `${nome} ${sufixo}`, email: `${nome.toLowerCase()}.${sufixo}@conflex.com.br`, perfil, setorId },
  });
  return { id: u.id, perfil: u.perfil, setorId: u.setorId, ativo: true };
}

async function novaRnc(): Promise<string> {
  const { codigo } = await registrarRnc(
    {
      setorId: setorA,
      dataOcorrencia: "2026-10-01",
      cliente: "",
      tipoProblema: `Teste integração ${sufixo}`,
      origem: "erro_interno",
      severidade: "alta",
      descricao: "Teste automatizado do ciclo.",
      correcaoImediata: "",
      multasJuros: 0,
      horasRetrabalho: 0,
    },
    autor.id,
  );
  return codigo;
}

const analiseOk = { metodo: "cinco_porques", porque1: "Vencimento caiu no feriado", causaRaiz: "Checklist sem conferência de feriados" };
const acaoOk = () => ({ descricao: "Incluir conferência de feriados no checklist", responsavelId: responsavel.id, prazo: "2026-10-20", verificarEm: "" });

async function estado(codigo: string) {
  return prisma.rnc.findUniqueOrThrow({
    where: { codigo },
    include: { analises: { orderBy: { ciclo: "asc" } }, acoes: { orderBy: { ciclo: "asc" } }, verificacoes: true, historico: { orderBy: { id: "asc" } } },
  });
}

beforeAll(async () => {
  setorA = (await prisma.setor.create({ data: { nome: `Setor A ${sufixo}` } })).id;
  setorB = (await prisma.setor.create({ data: { nome: `Setor B ${sufixo}` } })).id;
  gestao = await criarUsuario("Gestao", "gestao", null);
  liderA = await criarUsuario("LiderA", "lider_setor", setorA);
  liderB = await criarUsuario("LiderB", "lider_setor", setorB);
  autor = await criarUsuario("Autor", "colaborador", setorA);
  responsavel = await criarUsuario("Responsavel", "colaborador", setorB);
  outro = await criarUsuario("Outro", "colaborador", setorA);
});

describe("caminho completo", () => {
  it("análise → ação → verificação eficaz → encerrada, com histórico de cada passo", async () => {
    const codigo = await novaRnc();
    expect((await estado(codigo)).status).toBe("analise");

    await salvarAnalise(liderA, codigo, analiseOk, true);
    expect((await estado(codigo)).status).toBe("acao");

    const r = await salvarAcao(responsavel, codigo, acaoOk(), false).catch((e) => e);
    // O responsável ainda não estava gravado: sem vínculo, não edita
    expect(r).toBeInstanceOf(ErroCiclo);

    await salvarAcao(autor, codigo, acaoOk(), false); // autor define o responsável
    await salvarAcao(responsavel, codigo, acaoOk(), true); // responsável conclui
    let rnc = await estado(codigo);
    expect(rnc.status).toBe("verificacao");
    // Sem data informada: verificar em hoje + 30 dias
    expect(rnc.acoes[0].verificarEm).not.toBeNull();

    await registrarVerificacao(liderA, codigo, { resultado: "eficaz", evidencia: "Dois fechamentos sem atraso" });
    rnc = await estado(codigo);
    expect(rnc.status).toBe("encerrada");
    expect(rnc.encerradaEm).not.toBeNull();
    expect(rnc.reaberturas).toBe(0);
    expect(rnc.verificacoes).toHaveLength(1);

    expect(rnc.historico.map((h) => [h.tipo, h.statusAnterior, h.statusNovo])).toEqual([
      ["registro", null, "analise"],
      ["analise_concluida", "analise", "acao"],
      ["responsavel_alterado", null, null],
      ["acao_concluida", "acao", "verificacao"],
      ["verificacao_eficaz", "verificacao", "encerrada"],
    ]);
    expect(rnc.historico.map((h) => h.usuarioId)).toEqual([autor.id, liderA.id, autor.id, responsavel.id, liderA.id]);
  });
});

describe("verificação ineficaz", () => {
  it("volta para a análise, soma reabertura, preserva o ciclo anterior e começa análise em branco", async () => {
    const codigo = await novaRnc();
    await salvarAnalise(gestao, codigo, analiseOk, true);
    await salvarAcao(gestao, codigo, acaoOk(), true);
    await registrarVerificacao(gestao, codigo, { resultado: "ineficaz", evidencia: "Atrasou de novo em novembro" });

    let rnc = await estado(codigo);
    expect(rnc.status).toBe("analise");
    expect(rnc.reaberturas).toBe(1);
    expect(rnc.encerradaEm).toBeNull();
    // Ciclo 1 preservado; ciclo 2 ainda sem análise (causa raiz limpa)
    expect(rnc.analises.map((a) => [a.ciclo, a.causaRaiz])).toEqual([[1, analiseOk.causaRaiz]]);
    expect(rnc.acoes.map((a) => a.ciclo)).toEqual([1]);
    const ineficaz = rnc.historico.find((h) => h.tipo === "verificacao_ineficaz");
    expect(ineficaz?.dados).toMatchObject({ cicloEncerrado: 1, causaRaizAnterior: analiseOk.causaRaiz, acaoAnterior: acaoOk().descricao });

    // Segundo ciclo até encerrar
    await salvarAnalise(liderA, codigo, { ...analiseOk, causaRaiz: "Calendário de feriados municipais não cadastrado" }, true);
    await salvarAcao(liderA, codigo, { ...acaoOk(), descricao: "Cadastrar feriados municipais no sistema" }, true);
    await registrarVerificacao(liderA, codigo, { resultado: "eficaz", evidencia: "Sem atrasos em três meses" });

    rnc = await estado(codigo);
    expect(rnc.status).toBe("encerrada");
    expect(rnc.reaberturas).toBe(1);
    expect(rnc.analises.map((a) => a.ciclo)).toEqual([1, 2]);
    expect(rnc.acoes.map((a) => a.ciclo)).toEqual([1, 2]);
    expect(rnc.verificacoes.map((v) => [v.ciclo, v.resultado]).sort()).toEqual([
      [1, "ineficaz"],
      [2, "eficaz"],
    ]);
    expect(rnc.historico.filter((h) => h.tipo === "analise_concluida").map((h) => h.ciclo)).toEqual([1, 2]);
  });
});

describe("permissões", () => {
  it("análise: autor salva rascunho mas não conclui; colaborador sem vínculo e líder de outro setor não editam", async () => {
    const codigo = await novaRnc();
    await expect(salvarAnalise(autor, codigo, analiseOk, false)).resolves.toMatchObject({ mensagem: "Rascunho salvo." });
    await expect(salvarAnalise(autor, codigo, analiseOk, true)).rejects.toThrow(/líder do setor ou a gestão/);
    await expect(salvarAnalise(outro, codigo, analiseOk, false)).rejects.toThrow(ErroCiclo);
    await expect(salvarAnalise(liderB, codigo, analiseOk, true)).rejects.toThrow(ErroCiclo);
    expect((await estado(codigo)).status).toBe("analise");
  });

  it("ação: ninguém ganha acesso se nomeando responsável", async () => {
    const codigo = await novaRnc();
    await salvarAnalise(liderA, codigo, analiseOk, true);
    await expect(salvarAcao(outro, codigo, { ...acaoOk(), responsavelId: outro.id }, true)).rejects.toThrow(ErroCiclo);
    const rnc = await estado(codigo);
    expect(rnc.acoes).toHaveLength(0);
    expect(rnc.status).toBe("acao");
  });

  it("ação: o autor só conclui se ele mesmo for o responsável", async () => {
    const codigo = await novaRnc();
    await salvarAnalise(liderA, codigo, analiseOk, true);
    await expect(salvarAcao(autor, codigo, acaoOk(), true)).rejects.toThrow(/responsável/);
    await expect(salvarAcao(autor, codigo, { ...acaoOk(), responsavelId: autor.id }, true)).resolves.toMatchObject({ evento: "acao_concluida" });
  });

  it("verificação: só líder do setor ou gestão", async () => {
    const codigo = await novaRnc();
    await salvarAnalise(liderA, codigo, analiseOk, true);
    await salvarAcao(liderA, codigo, acaoOk(), true);
    for (const pessoa of [autor, responsavel, outro, liderB]) {
      await expect(registrarVerificacao(pessoa, codigo, { resultado: "eficaz", evidencia: "ok" })).rejects.toThrow(ErroCiclo);
    }
    await expect(registrarVerificacao(gestao, codigo, { resultado: "eficaz", evidencia: "ok" })).resolves.toMatchObject({ evento: "verificacao_eficaz" });
  });

  it("pessoa desativada não faz nada", async () => {
    const codigo = await novaRnc();
    await expect(salvarAnalise({ ...gestao, ativo: false }, codigo, analiseOk, true)).rejects.toThrow(ErroCiclo);
  });
});

describe("transições fora de ordem", () => {
  it("não deixa pular etapas nem mexer em RNC encerrada", async () => {
    const codigo = await novaRnc();
    await expect(salvarAcao(gestao, codigo, acaoOk(), true)).rejects.toThrow(/depois da análise/);
    await expect(registrarVerificacao(gestao, codigo, { resultado: "eficaz", evidencia: "x" })).rejects.toThrow(ErroCiclo);

    await salvarAnalise(gestao, codigo, analiseOk, true);
    await expect(salvarAnalise(gestao, codigo, analiseOk, true)).rejects.toThrow(/já foi concluída/);
    await salvarAcao(gestao, codigo, acaoOk(), true);
    await registrarVerificacao(gestao, codigo, { resultado: "eficaz", evidencia: "ok" });

    await expect(salvarAnalise(gestao, codigo, analiseOk, false)).rejects.toThrow(ErroCiclo);
    await expect(salvarAcao(gestao, codigo, acaoOk(), false)).rejects.toThrow(ErroCiclo);
    await expect(registrarVerificacao(gestao, codigo, { resultado: "ineficaz", evidencia: "" })).rejects.toThrow(/encerrada/);
    // Tentativas recusadas não deixam rastro: só os eventos que aconteceram
    expect((await estado(codigo)).historico.map((h) => h.tipo)).toEqual([
      "registro",
      "analise_concluida",
      "responsavel_alterado",
      "acao_concluida",
      "verificacao_eficaz",
    ]);
  });
});

describe("concorrência", () => {
  it("duas conclusões simultâneas da mesma análise: só uma vale", async () => {
    const codigo = await novaRnc();
    const resultados = await Promise.allSettled([
      salvarAnalise(gestao, codigo, analiseOk, true),
      salvarAnalise(liderA, codigo, analiseOk, true),
      salvarAnalise(gestao, codigo, analiseOk, true),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof ErroCiclo)).toBe(true);
    const rnc = await estado(codigo);
    expect(rnc.status).toBe("acao");
    expect(rnc.historico.filter((h) => h.tipo === "analise_concluida")).toHaveLength(1);
  });
});

describe("impacto e histórico", () => {
  it("atualiza o impacto e registra antes/depois no histórico", async () => {
    const codigo = await novaRnc();
    await expect(atualizarImpacto(outro, codigo, { multasJuros: "10", horasRetrabalho: "" })).rejects.toThrow(ErroCiclo);
    await atualizarImpacto(autor, codigo, { multasJuros: "1.234,56", horasRetrabalho: "2,5" });
    const rnc = await estado(codigo);
    expect(Number(rnc.multasJuros)).toBe(1234.56);
    expect(Number(rnc.horasRetrabalho)).toBe(2.5);
    const ev = rnc.historico.find((h) => h.tipo === "impacto_atualizado");
    expect(ev?.texto).toMatch(/de R\$\s0,00 para R\$\s1\.234,56; retrabalho de 0 h para 2,5 h/);
    expect(ev?.dados).toEqual({ antes: { multas: 0, horas: 0 }, depois: { multas: 1234.56, horas: 2.5 } });
  });

  it("o banco recusa alterar ou apagar o histórico", async () => {
    const codigo = await novaRnc();
    const { historico } = await estado(codigo);
    await expect(prisma.historico.update({ where: { id: historico[0].id }, data: { texto: "editado" } })).rejects.toThrow(/não pode ser alterado/);
    await expect(prisma.historico.delete({ where: { id: historico[0].id } })).rejects.toThrow(/não pode ser alterado/);
  });
});
