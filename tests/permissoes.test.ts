import { describe, expect, it } from "vitest";
import {
  podeConcluirAcao,
  podeConcluirAnalise,
  podeEditarAcao,
  podeEditarAnalise,
  podeEditarImpacto,
  podeExportar,
  podeGerenciarCadastros,
  podeGerenciarUsuarios,
  podeRegistrarRnc,
  podeVerificar,
  type RncAcesso,
  type UsuarioAcesso,
} from "@/lib/auth/permissoes";

const FISCAL = "setor-fiscal";
const FOLHA = "setor-folha";

const u = (id: string, perfil: UsuarioAcesso["perfil"], setorId: string | null = null, ativo = true): UsuarioAcesso => ({
  id,
  perfil,
  setorId,
  ativo,
});

const gestao = u("gestao", "gestao");
const liderFiscal = u("lider-fiscal", "lider_setor", FISCAL);
const liderFolha = u("lider-folha", "lider_setor", FOLHA);
const autor = u("autor", "colaborador", FISCAL);
const responsavel = u("responsavel", "colaborador", FOLHA);
const outro = u("outro", "colaborador", FISCAL);
const desativado = u("autor", "gestao", null, false);

const rnc: RncAcesso = { setorId: FISCAL, autorId: "autor", responsavelAcaoId: "responsavel" };

describe("registro", () => {
  it("qualquer pessoa ativa registra; desativada não", () => {
    for (const p of [gestao, liderFiscal, autor, outro]) expect(podeRegistrarRnc(p)).toBe(true);
    expect(podeRegistrarRnc(desativado)).toBe(false);
    expect(podeRegistrarRnc(null)).toBe(false);
  });
});

describe("análise de causa", () => {
  it("rascunho: gestão, líder do setor, autor e responsável", () => {
    for (const p of [gestao, liderFiscal, autor, responsavel]) expect(podeEditarAnalise(p, rnc)).toBe(true);
  });
  it("rascunho: colaborador sem vínculo e líder de outro setor não", () => {
    expect(podeEditarAnalise(outro, rnc)).toBe(false);
    expect(podeEditarAnalise(liderFolha, rnc)).toBe(false);
  });
  it("concluir: só gestão e líder do setor", () => {
    expect(podeConcluirAnalise(gestao, rnc)).toBe(true);
    expect(podeConcluirAnalise(liderFiscal, rnc)).toBe(true);
    for (const p of [liderFolha, autor, responsavel, outro]) expect(podeConcluirAnalise(p, rnc)).toBe(false);
  });
});

describe("ação corretiva", () => {
  it("editar: gestão, líder do setor, autor e responsável", () => {
    for (const p of [gestao, liderFiscal, autor, responsavel]) expect(podeEditarAcao(p, rnc)).toBe(true);
    expect(podeEditarAcao(outro, rnc)).toBe(false);
  });
  it("concluir: gestão, líder do setor e o responsável pela ação; o autor não", () => {
    for (const p of [gestao, liderFiscal, responsavel]) expect(podeConcluirAcao(p, rnc)).toBe(true);
    for (const p of [autor, outro, liderFolha]) expect(podeConcluirAcao(p, rnc)).toBe(false);
  });
  it("sem responsável definido, o colaborador não conclui", () => {
    const semResp = { ...rnc, responsavelAcaoId: null };
    expect(podeConcluirAcao(autor, semResp)).toBe(false);
    expect(podeConcluirAcao(responsavel, semResp)).toBe(false);
  });
});

describe("verificação de eficácia", () => {
  it("só gestão e líder do setor", () => {
    expect(podeVerificar(gestao, rnc)).toBe(true);
    expect(podeVerificar(liderFiscal, rnc)).toBe(true);
    for (const p of [liderFolha, autor, responsavel, outro]) expect(podeVerificar(p, rnc)).toBe(false);
  });
});

describe("impacto", () => {
  it("gestão, líder do setor, autor e responsável", () => {
    for (const p of [gestao, liderFiscal, autor, responsavel]) expect(podeEditarImpacto(p, rnc)).toBe(true);
    expect(podeEditarImpacto(outro, rnc)).toBe(false);
  });
});

describe("gestão", () => {
  it("usuários, cadastros e exportação só para gestão ativa", () => {
    for (const f of [podeGerenciarUsuarios, podeGerenciarCadastros, podeExportar]) {
      expect(f(gestao)).toBe(true);
      expect(f(liderFiscal)).toBe(false);
      expect(f(autor)).toBe(false);
      expect(f(desativado)).toBe(false);
    }
  });
});

describe("pessoa desativada", () => {
  it("perde todo acesso, mesmo sendo autora", () => {
    expect(podeEditarAnalise(desativado, rnc)).toBe(false);
    expect(podeEditarAcao(desativado, rnc)).toBe(false);
    expect(podeEditarImpacto(desativado, rnc)).toBe(false);
    expect(podeVerificar(desativado, rnc)).toBe(false);
  });
});
