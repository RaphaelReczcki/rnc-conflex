// "Esqueci minha senha" contra o banco de teste.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buscarTokenValido } from "@/lib/auth/convites";
import { LIMITE_PEDIDOS_POR_HORA, solicitarRedefinicao } from "@/lib/auth/recuperacao";
import { ErroEnvio, transporteMemoria } from "@/lib/email/transporte";

const sufixo = randomUUID().slice(0, 8);
const EMAIL = `esqueci.${sufixo}@conflex.com.br`;
const tokenDo = (texto: string) => texto.match(/\/convite\/([\w-]+)/)?.[1] ?? "";

beforeAll(async () => {
  await prisma.usuario.create({ data: { nome: "Esqueci Teste", email: EMAIL, perfil: "colaborador" } });
  await prisma.usuario.create({ data: { nome: "Inativo", email: `inativo.${sufixo}@conflex.com.br`, perfil: "colaborador", ativo: false } });
});

describe("esqueci minha senha", () => {
  it("envia um link de uso único que vale 1 hora", async () => {
    const t = transporteMemoria();
    expect(await solicitarRedefinicao(`  ${EMAIL.toUpperCase()} `, t)).toBe("enviado");
    expect(t.enviadas).toHaveLength(1);
    expect(t.enviadas[0].para).toEqual([EMAIL]);
    const token = tokenDo(t.enviadas[0].texto);
    const registro = await buscarTokenValido(token);
    expect(registro?.tipo).toBe("redefinicao");
    const minutos = (+registro!.expiraEm - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(55);
    expect(minutos).toBeLessThanOrEqual(60);
  });

  it("o link não fica guardado no banco", async () => {
    const t = transporteMemoria();
    await solicitarRedefinicao(EMAIL, t);
    const token = tokenDo(t.enviadas[0].texto);
    const n = await prisma.notificacao.findFirstOrThrow({ where: { tipo: "redefinicao_senha", destinatarios: { some: { email: EMAIL } } }, orderBy: { criadaEm: "desc" } });
    expect(n.html).not.toContain(token);
    expect(n.texto).not.toContain(token);
    expect(n.status).toBe("enviada");
  });

  it("pedir de novo cancela o link anterior", async () => {
    // Pessoa própria, para não esbarrar no limite de pedidos dos outros testes
    const outro = `denovo.${sufixo}@conflex.com.br`;
    await prisma.usuario.create({ data: { nome: "De Novo", email: outro, perfil: "colaborador" } });
    const t = transporteMemoria();
    expect(await solicitarRedefinicao(outro, t)).toBe("enviado");
    expect(await solicitarRedefinicao(outro, t)).toBe("enviado");
    const [primeiro, segundo] = t.enviadas.map((m) => tokenDo(m.texto));
    expect(await buscarTokenValido(primeiro)).toBeNull();
    expect(await buscarTokenValido(segundo)).not.toBeNull();
  });

  it("limite de pedidos por hora", async () => {
    // Os testes acima já fizeram pedidos nesta hora; completa até o limite
    let r = "";
    for (let i = 0; i < LIMITE_PEDIDOS_POR_HORA + 1; i++) r = await solicitarRedefinicao(EMAIL, transporteMemoria());
    expect(r).toBe("limite");
  });

  it("e-mail desconhecido ou de pessoa desativada não gera nada", async () => {
    const t = transporteMemoria();
    expect(await solicitarRedefinicao(`ninguem.${sufixo}@conflex.com.br`, t)).toBe("ignorado");
    expect(await solicitarRedefinicao(`inativo.${sufixo}@conflex.com.br`, t)).toBe("ignorado");
    expect(t.enviadas).toHaveLength(0);
  });

  it("falha no envio fica registrada e não volta para a fila", async () => {
    const outro = `falha.${sufixo}@conflex.com.br`;
    await prisma.usuario.create({ data: { nome: "Falha", email: outro, perfil: "colaborador" } });
    const t = transporteMemoria();
    t.falharCom = new ErroEnvio("Microsoft 365 fora do ar", true);
    expect(await solicitarRedefinicao(outro, t)).toBe("falhou");
    const n = await prisma.notificacao.findFirstOrThrow({ where: { tipo: "redefinicao_senha", destinatarios: { some: { email: outro } } } });
    expect(n).toMatchObject({ status: "falhou", tentativas: 6, ultimoErro: "Microsoft 365 fora do ar" });
  });
});
