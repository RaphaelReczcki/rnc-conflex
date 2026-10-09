import { describe, expect, it } from "vitest";
import { validarSenha, SENHA_MIN } from "@/lib/auth/senha-regras";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { BLOQUEIO_MINUTOS, BLOQUEIO_TENTATIVAS, emailPermitido, gerarToken, hashToken, registrarFalha } from "@/lib/auth/tokens";
import { normalizar } from "@/lib/normalizar";

describe("validarSenha", () => {
  it(`exige ao menos ${SENHA_MIN} caracteres`, () => {
    expect(validarSenha("curta")).toMatch(/ao menos/);
    expect(validarSenha("uma frase boa")).toBeNull();
  });
  it("recusa caractere repetido e senha com o e-mail", () => {
    expect(validarSenha("aaaaaaaaaaaa")).toMatch(/repetir/);
    expect(validarSenha("maria.silva2026", "maria.silva@conflex.com.br")).toMatch(/e-mail/);
  });
});

describe("hash de senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const h = await gerarHashSenha("cafe com pao de queijo");
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verificarSenha(h, "cafe com pao de queijo")).toBe(true);
    expect(await verificarSenha(h, "cafe com pao")).toBe(false);
  });
  it("sem hash (pessoa sem senha ou inexistente) sempre recusa", async () => {
    expect(await verificarSenha(null, "qualquer coisa")).toBe(false);
  });
});

describe("tokens", () => {
  it("gera tokens diferentes e guarda só o hash", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toHaveLength(64);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });
});

describe("e-mail corporativo", () => {
  it("aceita só os domínios configurados", () => {
    expect(emailPermitido("ana@conflex.com.br", "conflex.com.br")).toBe(true);
    expect(emailPermitido("ANA@Conflex.com.br", "conflex.com.br")).toBe(true);
    expect(emailPermitido("ana@gmail.com", "conflex.com.br")).toBe(false);
    expect(emailPermitido("ana@conflex.com.br.evil.com", "conflex.com.br")).toBe(false);
  });
  it("sem configuração, aceita qualquer domínio", () => {
    expect(emailPermitido("ana@gmail.com", "")).toBe(true);
  });
});

describe("bloqueio por tentativas", () => {
  const agora = new Date("2026-10-08T12:00:00Z");
  it(`bloqueia por ${BLOQUEIO_MINUTOS} minutos na ${BLOQUEIO_TENTATIVAS}ª senha errada`, () => {
    let tentativas = 0;
    for (let i = 1; i < BLOQUEIO_TENTATIVAS; i++) {
      const r = registrarFalha(tentativas, agora);
      expect(r.bloqueadoAte).toBeNull();
      tentativas = r.tentativasFalhas;
    }
    const r = registrarFalha(tentativas, agora);
    expect(r.bloqueadoAte?.getTime()).toBe(agora.getTime() + BLOQUEIO_MINUTOS * 60_000);
    expect(r.tentativasFalhas).toBe(0);
  });
});

describe("normalizar", () => {
  it("minúsculas, sem acentos, sem espaços nas pontas", () => {
    expect(normalizar("  Retificação de Declaração ")).toBe("retificacao de declaracao");
    expect(normalizar(null)).toBe("");
  });
});

describe("senha provisória", async () => {
  const { gerarSenhaProvisoria } = await import("@/lib/auth/senha-provisoria");
  it("10 caracteres, letras sem i/l/o e 2 dígitos, e passa na regra de senha", () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenhaProvisoria();
      expect(s).toMatch(/^[a-hj-km-np-z]{8}[1-9]\d$/);
      expect(validarSenha(s)).toBeNull();
    }
  });
  it("não repete", () => {
    expect(new Set(Array.from({ length: 500 }, gerarSenhaProvisoria)).size).toBe(500);
  });
});
