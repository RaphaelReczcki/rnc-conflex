// Juntar clientes duplicados: RNCs passam para o cadastro certo, com histórico.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { normalizar } from "@/lib/normalizar";
import { juntarClientes } from "@/lib/clientes/juntar";
import { registrarRnc } from "@/lib/rnc/registro";

const sufixo = randomUUID().slice(0, 8);
let setor: string;
let gestor: string;

const novoCliente = (nome: string, codigoInterno: string | null = null, cnpj: string | null = null) =>
  prisma.cliente.create({ data: { nome: `${nome} ${sufixo}`, nomeNormalizado: normalizar(`${nome} ${sufixo}`), codigoInterno, cnpj } });

// CNPJ válido diferente a cada execução (o campo é único)
function cnpjValido(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  const dv = (b: string, pesos: number[]) => {
    const r = [...b].reduce((s, c, i) => s + (c.charCodeAt(0) - 48) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + d1 + dv(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

async function rncDe(cliente: string) {
  const { codigo } = await registrarRnc(
    { setorId: setor, dataOcorrencia: "2026-10-01", cliente, tipoProblema: "Teste", origem: "cliente", severidade: "baixa", descricao: "Teste", correcaoImediata: "", multasJuros: 0, horasRetrabalho: 0 },
    gestor,
  );
  return codigo;
}

beforeAll(async () => {
  setor = (await prisma.setor.create({ data: { nome: `Clientes ${sufixo}` } })).id;
  gestor = (await prisma.usuario.create({ data: { nome: `Gestao ${sufixo}`, email: `cli.${sufixo}@conflex.com.br`, perfil: "gestao" } })).id;
});

describe("juntar clientes", () => {
  it("move as RNCs, registra no histórico e remove o duplicado", async () => {
    const certo = await novoCliente("Padaria Boa Vista");
    const errado = await novoCliente("Padaria Bova Vista", "D-123");
    const r1 = await rncDe(errado.nome);
    const r2 = await rncDe(errado.nome);

    const r = await juntarClientes(gestor, errado.id, certo.id);
    expect(r).toEqual({ ok: true, origem: errado.nome, destino: certo.nome, rncs: 2 });

    const rncs = await prisma.rnc.findMany({ where: { codigo: { in: [r1, r2] } }, include: { historico: { orderBy: { id: "asc" } } } });
    for (const x of rncs) {
      expect(x.clienteId).toBe(certo.id);
      expect(x.historico.at(-1)).toMatchObject({ tipo: "edicao", usuarioId: gestor, texto: `Cliente corrigido de "${errado.nome}" para "${certo.nome}"` });
    }
    expect(await prisma.cliente.findUnique({ where: { id: errado.id } })).toBeNull();
    // O código interno que só o duplicado tinha passa para o certo
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: certo.id } })).codigoInterno).toBe("D-123");
  });

  it("o CNPJ que só o duplicado tinha passa para o cadastro certo", async () => {
    const cnpj = cnpjValido();
    const certo = await novoCliente("Clínica Sorriso");
    const errado = await novoCliente("Clinica Sorisso", null, cnpj);
    await juntarClientes(gestor, errado.id, certo.id);
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: certo.id } })).cnpj).toBe(cnpj);
  });

  it("o banco recusa CNPJ fora do formato e CNPJ repetido", async () => {
    await expect(novoCliente("Formato errado", null, "11.222.333/000")).rejects.toThrow();
    const cnpj = cnpjValido();
    await novoCliente("Primeiro", null, cnpj);
    await expect(novoCliente("Segundo", null, cnpj)).rejects.toThrow();
  });

  it("não junta um cliente com ele mesmo nem com cliente inexistente", async () => {
    const c = await novoCliente("Mercado Central");
    expect(await juntarClientes(gestor, c.id, c.id)).toMatchObject({ ok: false });
    expect(await juntarClientes(gestor, c.id, randomUUID())).toMatchObject({ ok: false });
    expect(await prisma.cliente.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  it("depois de juntar, o registro reaproveita o cadastro certo", async () => {
    const certo = await novoCliente("Oficina Silva");
    const errado = await novoCliente("Oficina Silvaa");
    await juntarClientes(gestor, errado.id, certo.id);
    const codigo = await rncDe(`oficina silva ${sufixo}`);
    expect((await prisma.rnc.findUniqueOrThrow({ where: { codigo } })).clienteId).toBe(certo.id);
  });
});
