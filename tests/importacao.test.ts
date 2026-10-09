import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { lerCsv, lerPlanilha } from "@/lib/importacao/planilha";
import { analisarUsuarios, mapearCabecalho } from "@/lib/importacao/usuarios";

const FISCAL = { id: "s-fiscal", nome: "Fiscal" };
const FOLHA = { id: "s-folha", nome: "Pessoal/Folha" };
const ctxBase = {
  setores: [FISCAL, FOLHA],
  existentes: new Map(),
  atualizarExistentes: false,
  meuEmail: "qualidade@conflex.com.br",
  dominios: "conflex.com.br",
};
const CAB = ["Nome", "E-mail", "Perfil", "Setor"];
const analisar = (linhas: string[][], ctx = {}) => analisarUsuarios([CAB, ...linhas], { ...ctxBase, ...ctx });

describe("leitura de CSV", () => {
  it("separador ; com aspas, BOM e quebras de linha do Windows", () => {
    expect(lerCsv('﻿Nome;E-mail\r\n"Silva; Ana";ana@conflex.com.br\r\n"Diz ""oi""";b@conflex.com.br\r\n')).toEqual([
      ["Nome", "E-mail"],
      ["Silva; Ana", "ana@conflex.com.br"],
      ['Diz "oi"', "b@conflex.com.br"],
    ]);
  });
  it("separador , e linhas em branco ignoradas", () => {
    expect(lerCsv("Nome,E-mail\n\nAna,ana@conflex.com.br\n")).toEqual([
      ["Nome", "E-mail"],
      ["Ana", "ana@conflex.com.br"],
    ]);
  });
});

describe("leitura de Excel", () => {
  it("lê a primeira aba, inclusive e-mail que o Excel transformou em link", async () => {
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet("Usuários");
    aba.addRow(CAB);
    aba.addRow(["Ana Souza", { text: "ana@conflex.com.br", hyperlink: "mailto:ana@conflex.com.br" }, "Colaborador", "Fiscal"]);
    const dados = await livro.xlsx.writeBuffer();
    const arquivo = { name: "usuarios.xlsx", size: dados.byteLength, arrayBuffer: async () => dados as ArrayBuffer };
    expect(await lerPlanilha(arquivo)).toEqual([CAB, ["Ana Souza", "ana@conflex.com.br", "Colaborador", "Fiscal"]]);
  });
  it("recusa .xls antigo, arquivo vazio e arquivo grande", async () => {
    const f = (name: string, size: number) => ({ name, size, arrayBuffer: async () => new ArrayBuffer(0) });
    await expect(lerPlanilha(f("a.xls", 10))).rejects.toThrow(/\.xlsx/);
    await expect(lerPlanilha(f("a.xlsx", 0))).rejects.toThrow(/Escolha/);
    await expect(lerPlanilha(f("a.xlsx", 2 * 1024 * 1024))).rejects.toThrow(/1 MB/);
  });
});

describe("cabeçalho", () => {
  it("acha as colunas em qualquer ordem, sem diferenciar acento e maiúscula", () => {
    expect(mapearCabecalho(["SETOR", "email", "nome", "Perfil"]).indices).toEqual({ nome: 2, email: 1, perfil: 3, setor: 0 });
  });
  it("avisa se faltar Nome ou E-mail", () => {
    expect(analisarUsuarios([["Nome", "Setor"], ["Ana", "Fiscal"]], ctxBase).erroGeral).toMatch(/E-mail/);
  });
});

describe("análise das linhas", () => {
  it("linha completa vira pessoa nova", () => {
    const [l] = analisar([["Ana Souza", "Ana@Conflex.com.br", "Líder de setor", "fiscal"]]).linhas;
    expect(l).toMatchObject({ linha: 2, nome: "Ana Souza", email: "ana@conflex.com.br", perfil: "lider_setor", setorId: "s-fiscal", acao: "criar" });
  });
  it("aceita variações do perfil e perfil em branco vira Colaborador (com aviso)", () => {
    const ls = analisar([
      ["Ana", "a@conflex.com.br", "gestao", ""],
      ["Bia", "b@conflex.com.br", "LIDER", "Pessoal/Folha"],
      ["Caio", "c@conflex.com.br", "", ""],
    ]).linhas;
    expect(ls.map((l) => l.perfil)).toEqual(["gestao", "lider_setor", "colaborador"]);
    expect(ls[2].mensagens).toContain("Sem perfil: entra como Colaborador.");
  });
  it("erros por linha: perfil, setor, e-mail, nome, líder sem setor", () => {
    const ls = analisar([
      ["Ana", "ana@conflex.com.br", "Diretor", ""],
      ["Bia", "bia@conflex.com.br", "Colaborador", "Jurídico"],
      ["Caio", "caio@gmail.com", "", ""],
      ["Duda", "duda@", "", ""],
      ["E", "e@conflex.com.br", "", ""],
      ["Fabi", "fabi@conflex.com.br", "Líder de setor", ""],
    ]).linhas;
    expect(ls.every((l) => l.acao === "erro")).toBe(true);
    expect(ls.map((l) => l.mensagens[0])).toEqual([
      expect.stringMatching(/Perfil "Diretor" não existe/),
      expect.stringMatching(/Setor "Jurídico" não existe/),
      "Use o e-mail corporativo da Conflex.",
      "E-mail inválido.",
      "Informe o nome.",
      "Líder de setor precisa de um setor.",
    ]);
  });
  it("e-mail repetido na planilha: a segunda ocorrência é erro", () => {
    const ls = analisar([
      ["Ana", "ana@conflex.com.br", "", ""],
      ["Ana de novo", "ANA@conflex.com.br", "", ""],
    ]).linhas;
    expect(ls.map((l) => l.acao)).toEqual(["criar", "erro"]);
    expect(ls[1].mensagens[0]).toMatch(/linha 2/);
  });
  it("linha com erro mostra só os erros, sem os avisos", () => {
    const [l] = analisar([["Fora", "fora@gmail.com", "", ""]]).linhas;
    expect(l.mensagens).toEqual(["Use o e-mail corporativo da Conflex."]);
  });
  it("pula linhas em branco e mantém o número da linha da planilha", () => {
    const ls = analisar([["", "", "", ""], ["Ana", "ana@conflex.com.br", "", ""]]).linhas;
    expect(ls).toHaveLength(1);
    expect(ls[0].linha).toBe(3);
  });
});

describe("quem já está cadastrado", () => {
  const existentes = new Map([
    ["ana@conflex.com.br", { id: "1", nome: "Ana", perfil: "colaborador" as const, setorId: null, ativo: true }],
    ["qualidade@conflex.com.br", { id: "2", nome: "Gestão", perfil: "gestao" as const, setorId: null, ativo: true }],
    ["ex@conflex.com.br", { id: "3", nome: "Ex", perfil: "colaborador" as const, setorId: null, ativo: false }],
  ]);
  it("por padrão é ignorado", () => {
    const [l] = analisar([["Ana Souza", "ana@conflex.com.br", "Líder de setor", "Fiscal"]], { existentes }).linhas;
    expect(l.acao).toBe("ignorar");
  });
  it("com a opção marcada é atualizado; sem mudança, ignorado", () => {
    const ls = analisar(
      [
        ["Ana Souza", "ana@conflex.com.br", "Líder de setor", "Fiscal"],
        ["Gestão", "qualidade@conflex.com.br", "Gestão da qualidade", ""],
        ["Ex", "ex@conflex.com.br", "Colaborador", "Fiscal"],
      ],
      { existentes, atualizarExistentes: true },
    ).linhas;
    expect(ls.map((l) => l.acao)).toEqual(["atualizar", "ignorar", "atualizar"]);
    expect(ls[2].mensagens.join(" ")).toMatch(/continua desativado/);
  });
  it("não deixa a planilha tirar o seu próprio acesso de gestão", () => {
    const [l] = analisar([["Gestão", "qualidade@conflex.com.br", "Colaborador", ""]], { existentes, atualizarExistentes: true }).linhas;
    expect(l.acao).toBe("erro");
  });
});
