// Exportação CSV contra o banco de teste: filtros da lista, ciclo atual e
// proteção contra fórmula num texto digitado por alguém.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { lerFiltros } from "@/lib/rnc/filtros";
import { exportarRegistros } from "@/lib/rnc/exportacao";
import { registrarRnc } from "@/lib/rnc/registro";
import { registrarVerificacao, salvarAcao, salvarAnalise, type Ator } from "@/lib/rnc/ciclo-servico";

const sufixo = randomUUID().slice(0, 8);
let setor: string;
let gestao: Ator;
let codigoPerigoso: string;
let codigoReaberto: string;

const linhasDe = (csv: string) => csv.slice(1).trim().split("\r\n");

beforeAll(async () => {
  setor = (await prisma.setor.create({ data: { nome: `Exportação ${sufixo}` } })).id;
  const u = await prisma.usuario.create({ data: { nome: `Gestao ${sufixo}`, email: `exp.${sufixo}@conflex.com.br`, perfil: "gestao" } });
  gestao = { id: u.id, perfil: "gestao", setorId: null, ativo: true };
  const base = {
    setorId: setor,
    dataOcorrencia: "2026-10-01",
    cliente: `Cliente ${sufixo}`,
    tipoProblema: `Exportação ${sufixo}`,
    origem: "cliente" as const,
    severidade: "critica" as const,
    correcaoImediata: "",
    multasJuros: 1234.5,
    horasRetrabalho: 2.5,
  };
  ({ codigo: codigoPerigoso } = await registrarRnc({ ...base, descricao: '=HYPERLINK("http://exemplo","clique")' }, u.id));
  ({ codigo: codigoReaberto } = await registrarRnc({ ...base, severidade: "baixa", descricao: "Teste de reabertura" }, u.id));
  await salvarAnalise(gestao, codigoReaberto, { metodo: "cinco_porques", causaRaiz: "Causa do ciclo 1" }, true);
  await salvarAcao(gestao, codigoReaberto, { descricao: "Ação do ciclo 1", responsavelId: u.id }, true);
  await registrarVerificacao(gestao, codigoReaberto, { resultado: "ineficaz", evidencia: "" });
});

describe("exportação CSV", () => {
  it("usa os filtros da lista: setor e severidade", async () => {
    const { csv, total } = await exportarRegistros(lerFiltros({ etapa: "todas", setor, sev: "critica" }));
    expect(total).toBe(1);
    expect(linhasDe(csv)[1]).toContain(`"${codigoPerigoso}"`);
  });

  it("busca pelo cliente, sem acento e sem diferenciar maiúsculas", async () => {
    const { total } = await exportarRegistros(lerFiltros({ etapa: "todas", q: `CLIENTE ${sufixo}` }));
    expect(total).toBe(2);
  });

  it("neutraliza fórmula digitada no texto da RNC", async () => {
    const { csv } = await exportarRegistros(lerFiltros({ etapa: "todas", setor, sev: "critica" }));
    expect(csv).toContain(`"'=HYPERLINK(""http://exemplo"",""clique"")"`);
    expect(csv).not.toMatch(/;"=HYPERLINK/);
  });

  it("valores em formato brasileiro e rótulos legíveis", async () => {
    const { csv } = await exportarRegistros(lerFiltros({ etapa: "todas", setor, sev: "critica" }));
    const linha = linhasDe(csv)[1];
    expect(linha).toContain('"1234,50"');
    expect(linha).toContain('"2,5"');
    expect(linha).toContain('"Crítica"');
    expect(linha).toContain('"Cliente"');
    expect(linha).toContain('"Análise de causa"');
    expect(linha).toMatch(/"\d{2}\/\d{2}\/\d{4}"/);
  });

  it("depois de uma reabertura, causa e ação ficam vazias (ciclo novo)", async () => {
    const { csv } = await exportarRegistros(lerFiltros({ etapa: "todas", setor, sev: "baixa" }));
    const cab = linhasDe(csv)[0].split(";");
    const cel = linhasDe(csv)[1].split(";");
    expect(cel[cab.indexOf('"Causa raiz"')]).toBe('""');
    expect(cel[cab.indexOf('"Ação corretiva"')]).toBe('""');
    expect(cel[cab.indexOf('"Reaberturas"')]).toBe('"1"');
  });
});
