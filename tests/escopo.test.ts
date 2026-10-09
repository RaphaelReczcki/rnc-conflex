import { describe, expect, it } from "vitest";
import type { UsuarioAcesso } from "@/lib/auth/permissoes";
import { escopoRncs, podeVerRnc } from "@/lib/rnc/escopo";

const FISCAL = "setor-fiscal";
const FOLHA = "setor-folha";

const u = (id: string, perfil: UsuarioAcesso["perfil"], setorId: string | null = null, ativo = true): UsuarioAcesso => ({ id, perfil, setorId, ativo });
const rnc = (setorId: string, autorId: string, ...responsaveis: (string | null)[]) => ({ setorId, autorId, responsaveis });

describe("podeVerRnc", () => {
  const ana = u("ana", "colaborador", FISCAL);
  const lider = u("lider", "lider_setor", FISCAL);
  const gestao = u("gestao", "gestao");

  it("gestão vê todas", () => {
    expect(podeVerRnc(gestao, rnc(FOLHA, "outro"))).toBe(true);
  });

  it("colaborador vê as que registrou e as que têm ação dele", () => {
    expect(podeVerRnc(ana, rnc(FISCAL, "ana"))).toBe(true);
    expect(podeVerRnc(ana, rnc(FOLHA, "outro", "ana"))).toBe(true);
  });

  it("colaborador não vê as outras do próprio setor", () => {
    expect(podeVerRnc(ana, rnc(FISCAL, "outro"))).toBe(false);
    expect(podeVerRnc(ana, rnc(FISCAL, "outro", null, "bia"))).toBe(false);
  });

  it("colaborador não ganha visão por estar numa equipe", () => {
    expect(podeVerRnc(ana, rnc(FOLHA, "bia"), ["bia"])).toBe(false);
  });

  it("líder vê todas do seu setor", () => {
    expect(podeVerRnc(lider, rnc(FISCAL, "qualquer"))).toBe(true);
  });

  it("líder vê as da equipe em outro setor, registradas ou com ação da pessoa", () => {
    expect(podeVerRnc(lider, rnc(FOLHA, "ana"), ["ana"])).toBe(true);
    expect(podeVerRnc(lider, rnc(FOLHA, "outro", "ana"), ["ana"])).toBe(true);
  });

  it("líder não vê as de outro setor que não envolvem a equipe", () => {
    expect(podeVerRnc(lider, rnc(FOLHA, "outro", "bia"), ["ana"])).toBe(false);
  });

  it("líder vê as próprias em outro setor", () => {
    expect(podeVerRnc(lider, rnc(FOLHA, "lider"))).toBe(true);
  });

  it("pessoa desativada não vê nada", () => {
    expect(podeVerRnc(u("x", "gestao", null, false), rnc(FISCAL, "x"))).toBe(false);
    expect(podeVerRnc(null, rnc(FISCAL, "x"))).toBe(false);
  });
});

describe("escopoRncs", () => {
  it("gestão: sem filtro", () => {
    expect(escopoRncs(u("g", "gestao"))).toEqual({});
  });

  it("desativado: filtro que não traz nada", () => {
    expect(escopoRncs(u("x", "colaborador", FISCAL, false))).toEqual({ id: { in: [] } });
  });

  it("colaborador: só a própria pessoa, sem o setor", () => {
    const f = escopoRncs(u("ana", "colaborador", FISCAL), ["bia"]);
    expect(JSON.stringify(f)).not.toContain(FISCAL);
    expect(JSON.stringify(f)).not.toContain("bia");
    expect(f.OR).toHaveLength(2);
  });

  it("líder: setor + líder e equipe, sem repetir o líder", () => {
    const f = escopoRncs(u("lider", "lider_setor", FISCAL), ["ana", "lider"]);
    expect(f.OR).toEqual([
      { setorId: FISCAL },
      { autorId: { in: ["lider", "ana"] } },
      { acoes: { some: { responsavelId: { in: ["lider", "ana"] } } } },
    ]);
  });
});
