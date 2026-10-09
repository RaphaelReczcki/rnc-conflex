// Importação de usuários contra o banco de teste.
import { randomUUID } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { lerPlanilha } from "@/lib/importacao/planilha";
import { analisarPlanilhaUsuarios, gerarModeloUsuarios, importarUsuarios } from "@/lib/importacao/importar-usuarios";

const sufixo = randomUUID().slice(0, 8);
const email = (n: string) => `${n}.${sufixo}@conflex.com.br`;
let setorNome: string;
const GESTOR = `gestor.${sufixo}@conflex.com.br`;

beforeAll(async () => {
  setorNome = `Importação ${sufixo}`;
  await prisma.setor.create({ data: { nome: setorNome } });
  await prisma.usuario.create({ data: { nome: "Gestor", email: GESTOR, perfil: "gestao" } });
});

describe("importar usuários", () => {
  it("cria as pessoas novas com senha provisória e troca obrigatória; linhas com erro ficam de fora", async () => {
    const planilha = [
      ["Nome", "E-mail", "Perfil", "Setor"],
      ["Ana Import", email("ana"), "Líder de setor", setorNome],
      ["Bruno Import", email("bruno"), "", ""],
      ["Errado", "errado@gmail.com", "", ""],
    ];
    const previa = await analisarPlanilhaUsuarios(planilha, GESTOR, false);
    expect(previa.linhas.map((l) => l.acao)).toEqual(["criar", "criar", "erro"]);
    expect(await prisma.usuario.count({ where: { email: email("ana") } })).toBe(0); // a prévia não grava

    const r = await importarUsuarios(planilha, GESTOR, false);
    expect(r.resumo).toEqual({ criadas: 2, atualizadas: 0, ignoradas: 0, comErro: 1 });
    expect(r.credenciais.map((c) => c.email)).toEqual([email("ana"), email("bruno")]);

    const ana = await prisma.usuario.findUniqueOrThrow({ where: { email: email("ana") }, include: { setor: true } });
    expect(ana).toMatchObject({ perfil: "lider_setor", deveTrocarSenha: true, ativo: true });
    expect(ana.setor?.nome).toBe(setorNome);
    expect(await verify(ana.senhaHash!, r.credenciais[0].senha)).toBe(true);
    expect(await prisma.usuario.count({ where: { email: "errado@gmail.com" } })).toBe(0);
  });

  it("importar de novo não duplica; com a opção marcada, atualiza perfil e setor sem mexer na senha", async () => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { email: email("bruno") } });
    const planilha = [
      ["Nome", "E-mail", "Perfil", "Setor"],
      ["Bruno Import", email("bruno"), "Líder de setor", setorNome],
    ];
    expect((await importarUsuarios(planilha, GESTOR, false)).resumo).toMatchObject({ criadas: 0, ignoradas: 1 });
    const r = await importarUsuarios(planilha, GESTOR, true);
    expect(r.resumo).toMatchObject({ criadas: 0, atualizadas: 1 });
    expect(r.credenciais).toEqual([]);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { email: email("bruno") } });
    expect(depois.perfil).toBe("lider_setor");
    expect(depois.senhaHash).toBe(antes.senhaHash);
  });

  it("o modelo baixado é lido de volta pela importação", async () => {
    const dados = await gerarModeloUsuarios();
    const linhas = await lerPlanilha({ name: "modelo.xlsx", size: dados.length, arrayBuffer: async () => dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength) as ArrayBuffer });
    expect(linhas[0]).toEqual(["Nome", "E-mail", "Perfil", "Setor"]);
    const previa = await analisarPlanilhaUsuarios(linhas, GESTOR, false);
    // A linha de exemplo do modelo é válida (e vira pessoa nova se não for apagada)
    expect(previa.linhas[0]).toMatchObject({ email: "ana.exemplo@conflex.com.br", perfil: "colaborador" });
  });
});
