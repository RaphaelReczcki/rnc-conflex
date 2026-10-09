// PostgreSQL de verdade para desenvolvimento local (pacote embedded-postgres),
// com os dados guardados em .dados/postgres. Sem Docker e sem instalação.
// Uso direto: node scripts/banco-local.mjs   (fica rodando até Ctrl+C)
import "dotenv/config";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

export const PASTA = join(process.cwd(), ".dados", "postgres");
export const PORTA = Number(process.env.BANCO_LOCAL_PORTA || 54320);

function portaAberta(porta) {
  return new Promise((ok) => {
    const s = createConnection({ port: porta, host: "127.0.0.1" });
    s.once("connect", () => (s.end(), ok(true)));
    s.once("error", () => ok(false));
  });
}

// Sobe o banco, se ainda não estiver no ar. Devolve uma função para desligar.
export async function subirBancoLocal() {
  const senha = process.env.BANCO_LOCAL_SENHA;
  if (!senha) throw new Error("Defina BANCO_LOCAL_SENHA no .env (veja .env.example).");
  if (await portaAberta(PORTA)) {
    console.log(`PostgreSQL local já está no ar na porta ${PORTA}.`);
    return async () => {};
  }
  const pg = new EmbeddedPostgres({ databaseDir: PASTA, user: "rnc", password: senha, port: PORTA, persistent: true, onLog: () => {}, onError: () => {},
    // Sempre UTC, como o Neon: o Prisma grava e lê as datas em UTC
    postgresFlags: ["-c", "timezone=UTC"] });
  const novo = !existsSync(join(PASTA, "PG_VERSION"));
  if (novo) await pg.initialise();
  await pg.start();
  if (novo) {
    await pg.createDatabase("rnc");
    const c = pg.getPgClient("rnc");
    await c.connect();
    await c.query("ALTER DATABASE rnc SET timezone TO 'UTC'");
    await c.end();
  }
  console.log(`PostgreSQL local no ar na porta ${PORTA}${novo ? " (banco novo criado)" : ""}.`);
  return () => pg.stop();
}

if (process.argv[1] && process.argv[1].endsWith("banco-local.mjs")) {
  const desligar = await subirBancoLocal();
  const sair = async () => {
    await desligar();
    process.exit(0);
  };
  process.on("SIGINT", sair);
  process.on("SIGTERM", sair);
  console.log("Ctrl+C para desligar.");
}
