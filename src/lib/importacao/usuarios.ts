// Análise da planilha de usuários, sem banco: o que cada linha vai virar.
import { z } from "zod";
import { normalizar } from "@/lib/normalizar";
import { emailPermitido } from "@/lib/auth/tokens";
import type { Perfil } from "@/lib/auth/permissoes";

export const COLUNAS = ["Nome", "E-mail", "Perfil", "Setor"] as const;
export const PERFIS_PLANILHA: Record<Perfil, string> = { colaborador: "Colaborador", lider_setor: "Líder de setor", gestao: "Gestão da qualidade" };

// Aceita o rótulo da planilha e variações comuns
const SINONIMOS_PERFIL: Record<string, Perfil> = {
  colaborador: "colaborador",
  "lider de setor": "lider_setor",
  lider: "lider_setor",
  lider_setor: "lider_setor",
  "gestao da qualidade": "gestao",
  gestao: "gestao",
  qualidade: "gestao",
};

export type Acao = "criar" | "atualizar" | "ignorar" | "erro";

export type LinhaAnalisada = {
  linha: number; // número da linha na planilha
  nome: string;
  email: string;
  perfil: Perfil | null;
  setorId: string | null;
  setor: string;
  acao: Acao;
  mensagens: string[];
};

type Contexto = {
  setores: { id: string; nome: string }[];
  // E-mail (minúsculo) -> dados atuais de quem já está cadastrado
  existentes: Map<string, { id: string; nome: string; perfil: Perfil; setorId: string | null; ativo: boolean }>;
  atualizarExistentes: boolean;
  meuEmail: string;
  dominios?: string;
};

const chave = (t: string) => normalizar(t).replace(/[\s_-]+/g, " ");

// Acha as colunas pelo cabeçalho (ordem livre, sem diferenciar acento e maiúscula)
export function mapearCabecalho(cabecalho: string[]): { indices: Record<"nome" | "email" | "perfil" | "setor", number>; faltando: string[] } {
  const h = cabecalho.map(chave);
  const achar = (...nomes: string[]) => h.findIndex((c) => nomes.includes(c));
  const indices = { nome: achar("nome", "nome completo"), email: achar("e mail", "email", "login"), perfil: achar("perfil"), setor: achar("setor") };
  const faltando = [indices.nome < 0 && "Nome", indices.email < 0 && "E-mail"].filter(Boolean) as string[];
  return { indices, faltando };
}

export function analisarUsuarios(linhas: string[][], ctx: Contexto): { erroGeral?: string; linhas: LinhaAnalisada[] } {
  if (!linhas.length) return { erroGeral: "A planilha está vazia.", linhas: [] };
  const { indices, faltando } = mapearCabecalho(linhas[0]);
  if (faltando.length) return { erroGeral: `Faltam as colunas: ${faltando.join(", ")}. Use o modelo para conferir o cabeçalho.`, linhas: [] };

  const setorPorNome = new Map(ctx.setores.map((s) => [chave(s.nome), s]));
  const vistos = new Map<string, number>();
  const resultado: LinhaAnalisada[] = [];

  linhas.slice(1).forEach((cols, i) => {
    const pegar = (k: keyof typeof indices) => (indices[k] >= 0 ? (cols[indices[k]] ?? "").trim() : "");
    const nome = pegar("nome").replace(/\s+/g, " ");
    const email = pegar("email").toLowerCase();
    const perfilTexto = pegar("perfil");
    const setorTexto = pegar("setor");
    if (!nome && !email && !perfilTexto && !setorTexto) return; // linha em branco
    const linha = i + 2;
    const erros: string[] = [];
    const avisos: string[] = [];

    if (nome.length < 2) erros.push("Informe o nome.");
    else if (nome.length > 120) erros.push("Nome muito longo.");
    if (!email) erros.push("Informe o e-mail.");
    else if (!z.email().safeParse(email).success) erros.push("E-mail inválido.");
    else if (!emailPermitido(email, ctx.dominios)) erros.push("Use o e-mail corporativo da Conflex.");

    let perfil: Perfil | null = "colaborador";
    if (perfilTexto) {
      perfil = SINONIMOS_PERFIL[chave(perfilTexto)] ?? null;
      if (!perfil) erros.push(`Perfil "${perfilTexto}" não existe. Use: ${Object.values(PERFIS_PLANILHA).join(", ")}.`);
    } else avisos.push("Sem perfil: entra como Colaborador.");

    let setorId: string | null = null;
    let setor = "";
    if (setorTexto) {
      const s = setorPorNome.get(chave(setorTexto));
      if (s) (setorId = s.id), (setor = s.nome);
      else erros.push(`Setor "${setorTexto}" não existe. Use: ${ctx.setores.map((x) => x.nome).join(", ")}.`);
    }
    if (perfil === "lider_setor" && !setorId && !erros.some((e) => e.startsWith("Setor"))) erros.push("Líder de setor precisa de um setor.");

    if (email && vistos.has(email)) erros.push(`E-mail repetido na planilha (já está na linha ${vistos.get(email)}).`);
    else if (email) vistos.set(email, linha);

    let acao: Acao = erros.length ? "erro" : "criar";
    const existente = ctx.existentes.get(email);
    if (!erros.length && existente) {
      if (!ctx.atualizarExistentes) {
        acao = "ignorar";
        avisos.push("Já cadastrado: mantido como está.");
      } else if (email === ctx.meuEmail.toLowerCase() && perfil !== "gestao") {
        acao = "erro";
        erros.push("Você não pode tirar o seu próprio acesso de gestão.");
      } else if (existente.nome === nome && existente.perfil === perfil && existente.setorId === setorId) {
        acao = "ignorar";
        avisos.push("Já cadastrado, sem mudanças.");
      } else {
        acao = "atualizar";
        if (!existente.ativo) avisos.push("Está desativado: os dados são atualizados, mas continua desativado.");
      }
    }
    // Com erro, mostra só os erros (os avisos não importam se a linha não entra)
    resultado.push({ linha, nome, email, perfil, setorId, setor, acao, mensagens: erros.length ? erros : avisos });
  });

  if (!resultado.length) return { erroGeral: "Nenhuma pessoa encontrada abaixo do cabeçalho.", linhas: [] };
  return { linhas: resultado };
}
