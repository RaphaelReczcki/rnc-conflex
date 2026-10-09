import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { gerarHashSenha } from "@/lib/auth/senha";
import { gerarSenhaProvisoria } from "@/lib/auth/senha-provisoria";
import { analisarUsuarios, COLUNAS, PERFIS_PLANILHA, type LinhaAnalisada } from "./usuarios";

export type Credencial = { nome: string; email: string; senha: string };
export type ResumoImportacao = { criadas: number; atualizadas: number; ignoradas: number; comErro: number };

async function contexto(meuEmail: string, atualizarExistentes: boolean) {
  const [setores, usuarios] = await Promise.all([
    prisma.setor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    prisma.usuario.findMany({ select: { id: true, nome: true, email: true, perfil: true, setorId: true, ativo: true } }),
  ]);
  return { setores, existentes: new Map(usuarios.map((u) => [u.email, u])), atualizarExistentes, meuEmail };
}

export const resumir = (linhas: LinhaAnalisada[]): ResumoImportacao => ({
  criadas: linhas.filter((l) => l.acao === "criar").length,
  atualizadas: linhas.filter((l) => l.acao === "atualizar").length,
  ignoradas: linhas.filter((l) => l.acao === "ignorar").length,
  comErro: linhas.filter((l) => l.acao === "erro").length,
});

// Prévia: nada é gravado.
export async function analisarPlanilhaUsuarios(linhas: string[][], meuEmail: string, atualizarExistentes: boolean) {
  return analisarUsuarios(linhas, await contexto(meuEmail, atualizarExistentes));
}

// Importação: analisa de novo (não confia na prévia) e grava numa transação
// só as linhas sem erro. Devolve as senhas provisórias das pessoas novas.
export async function importarUsuarios(linhas: string[][], meuEmail: string, atualizarExistentes: boolean) {
  const analise = analisarUsuarios(linhas, await contexto(meuEmail, atualizarExistentes));
  if (analise.erroGeral) return { erroGeral: analise.erroGeral, linhas: [], credenciais: [] as Credencial[], resumo: resumir([]) };

  // Hash fora da transação (Argon2 é lento de propósito)
  const novas = await Promise.all(
    analise.linhas
      .filter((l) => l.acao === "criar")
      .map(async (l) => {
        const senha = gerarSenhaProvisoria();
        return { l, senha, hash: await gerarHashSenha(senha) };
      }),
  );

  await prisma.$transaction(async (tx) => {
    for (const { l, hash } of novas) {
      await tx.usuario.create({ data: { nome: l.nome, email: l.email, perfil: l.perfil!, setorId: l.setorId, senhaHash: hash, deveTrocarSenha: true } });
    }
    for (const l of analise.linhas.filter((x) => x.acao === "atualizar")) {
      await tx.usuario.update({ where: { email: l.email }, data: { nome: l.nome, perfil: l.perfil!, setorId: l.setorId } });
    }
  });

  return {
    linhas: analise.linhas,
    resumo: resumir(analise.linhas),
    credenciais: novas.map(({ l, senha }) => ({ nome: l.nome, email: l.email, senha })),
  };
}

// Modelo .xlsx: aba "Usuários" com listas de perfil e setor, e aba de instruções.
export async function gerarModeloUsuarios(): Promise<Buffer> {
  const setores = await prisma.setor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { nome: true } });
  const livro = new ExcelJS.Workbook();
  livro.creator = "Conflex · Não conformidades";

  const aba = livro.addWorksheet("Usuários", { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = [
    { header: COLUNAS[0], key: "nome", width: 34 },
    { header: COLUNAS[1], key: "email", width: 34 },
    { header: COLUNAS[2], key: "perfil", width: 22 },
    { header: COLUNAS[3], key: "setor", width: 26 },
  ];
  const cab = aba.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF384C77" } };
  aba.addRow({ nome: "Ana Exemplo (apague esta linha)", email: "ana.exemplo@conflex.com.br", perfil: "Colaborador", setor: setores[0]?.nome ?? "" });

  // Listas para escolher, numa aba de apoio
  const listas = livro.addWorksheet("Listas");
  Object.values(PERFIS_PLANILHA).forEach((p, i) => (listas.getCell(i + 1, 1).value = p));
  setores.forEach((s, i) => (listas.getCell(i + 1, 2).value = s.nome));
  listas.state = "hidden";
  for (let r = 2; r <= 501; r++) {
    aba.getCell(r, 3).dataValidation = { type: "list", allowBlank: true, formulae: [`Listas!$A$1:$A$${Object.keys(PERFIS_PLANILHA).length}`] };
    if (setores.length) aba.getCell(r, 4).dataValidation = { type: "list", allowBlank: true, formulae: [`Listas!$B$1:$B$${setores.length}`] };
  }

  const ajuda = livro.addWorksheet("Instruções");
  ajuda.getColumn(1).width = 110;
  [
    "Como preencher",
    "",
    "• Uma pessoa por linha, na aba Usuários. Não mude o cabeçalho.",
    "• Nome e E-mail são obrigatórios. Use o e-mail corporativo (@conflex.com.br): ele é o login.",
    `• Perfil: ${Object.values(PERFIS_PLANILHA).join(", ")}. Em branco = Colaborador.`,
    `• Setor: ${setores.map((s) => s.nome).join(", ")}. Obrigatório para Líder de setor.`,
    "• Não coloque CPF nem outros dados pessoais.",
    "",
    "Na importação, o sistema mostra uma prévia antes de gravar. Cada pessoa nova recebe uma senha provisória,",
    "que a gestão repassa, e troca a senha no primeiro acesso. Quem já está cadastrado é ignorado, a menos que",
    "você marque a opção de atualizar nome, perfil e setor.",
  ].forEach((t, i) => {
    const c = ajuda.getCell(i + 1, 1);
    c.value = t;
    if (i === 0) c.font = { bold: true, size: 13, color: { argb: "FF384C77" } };
  });

  return Buffer.from(await livro.xlsx.writeBuffer());
}
