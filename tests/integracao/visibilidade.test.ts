// Quem vê quais RNCs, contra o banco de teste: colaborador só as dele,
// líder o setor e a equipe (mesmo em outro setor), gestão todas.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { UsuarioAcesso } from "@/lib/auth/permissoes";
import { escopoDoUsuario } from "@/lib/rnc/escopo-servidor";
import { registrarRnc } from "@/lib/rnc/registro";
import { salvarAcao, salvarAnalise } from "@/lib/rnc/ciclo-servico";

const sufixo = randomUUID().slice(0, 8);
let fiscal: string;
let folha: string;
let ana: UsuarioAcesso; // colaboradora do Fiscal, na equipe do líder
let bia: UsuarioAcesso; // colaboradora da Folha, fora da equipe
let lider: UsuarioAcesso; // líder do Fiscal
let gestao: UsuarioAcesso;
const codigos: Record<string, string> = {};

async function pessoa(nome: string, perfil: UsuarioAcesso["perfil"], setorId: string | null): Promise<UsuarioAcesso> {
  const r = await prisma.usuario.create({ data: { nome: `${nome} ${sufixo}`, email: `vis.${nome.toLowerCase()}.${sufixo}@conflex.com.br`, perfil, setorId } });
  return { id: r.id, perfil, setorId, ativo: true };
}

async function codigosVisiveis(u: UsuarioAcesso) {
  const rs = await prisma.rnc.findMany({ where: { AND: [await escopoDoUsuario(u), { tipoProblema: { endsWith: sufixo } }] }, select: { codigo: true } });
  return rs.map((r) => r.codigo).sort();
}
const de = (...nomes: string[]) => nomes.map((n) => codigos[n]).sort();

beforeAll(async () => {
  fiscal = (await prisma.setor.create({ data: { nome: `Fiscal vis ${sufixo}` } })).id;
  folha = (await prisma.setor.create({ data: { nome: `Folha vis ${sufixo}` } })).id;
  ana = await pessoa("Ana", "colaborador", fiscal);
  bia = await pessoa("Bia", "colaborador", folha);
  lider = await pessoa("Lider", "lider_setor", fiscal);
  gestao = await pessoa("Gestao", "gestao", null);
  const equipe = await prisma.equipe.create({ data: { nome: `Equipe vis ${sufixo}`, liderId: lider.id } });
  await prisma.usuario.update({ where: { id: ana.id }, data: { equipeId: equipe.id } });

  const base = { dataOcorrencia: "2026-10-01", cliente: "", origem: "erro_interno" as const, severidade: "media" as const, descricao: "Teste", correcaoImediata: "", multasJuros: 0, horasRetrabalho: 0 };
  const registrar = async (chave: string, setorId: string, autor: UsuarioAcesso) => {
    codigos[chave] = (await registrarRnc({ ...base, setorId, tipoProblema: `${chave} ${sufixo}` }, autor.id)).codigo;
  };
  await registrar("anaFiscal", fiscal, ana); // da Ana, no Fiscal
  await registrar("anaFolha", folha, ana); // da Ana, em outro setor
  await registrar("biaFolha", folha, bia); // da Bia, sem ligação com o Fiscal
  await registrar("biaFiscal", fiscal, bia); // da Bia, no setor do líder
  await registrar("acaoDaAna", folha, bia); // da Bia, com ação para a Ana
  await salvarAnalise(gestao, codigos.acaoDaAna, { metodo: "cinco_porques", causaRaiz: "Causa" }, true);
  await salvarAcao(gestao, codigos.acaoDaAna, { descricao: "Ação", responsavelId: ana.id }, true);
});

describe("visibilidade das RNCs", () => {
  it("gestão vê todas", async () => {
    expect(await codigosVisiveis(gestao)).toEqual(de("anaFiscal", "anaFolha", "biaFolha", "biaFiscal", "acaoDaAna"));
  });

  it("colaborador vê só as que registrou ou com ação dele", async () => {
    expect(await codigosVisiveis(ana)).toEqual(de("anaFiscal", "anaFolha", "acaoDaAna"));
    expect(await codigosVisiveis(bia)).toEqual(de("biaFolha", "biaFiscal", "acaoDaAna"));
  });

  it("líder vê o setor dele e tudo da equipe, mesmo em outro setor", async () => {
    expect(await codigosVisiveis(lider)).toEqual(de("anaFiscal", "anaFolha", "biaFiscal", "acaoDaAna"));
  });

  it("com a equipe inativa, o líder volta a ver só o setor", async () => {
    await prisma.equipe.updateMany({ where: { liderId: lider.id }, data: { ativo: false } });
    // outro objeto: o cache de membros é por usuário
    expect(await codigosVisiveis({ ...lider })).toEqual(de("anaFiscal", "biaFiscal"));
  });
});
