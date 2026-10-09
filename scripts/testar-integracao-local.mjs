// Roda os testes de integração num PostgreSQL real e descartável
// (pacote embedded-postgres): cria o banco numa pasta temporária, roda a
// suíte e apaga tudo no fim, passe ou falhe. Não precisa de Docker nem de Neon.
// Uso: npm run test:integracao:local
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const pasta = mkdtempSync(join(tmpdir(), "rnc-teste-pg-"));
const senha = randomBytes(12).toString("hex"); // só existe durante esta execução
const porta = 54_000 + Math.floor(Math.random() * 900);
const pg = new EmbeddedPostgres({ databaseDir: pasta, user: "rnc", password: senha, port: porta, persistent: false, onLog: () => {}, postgresFlags: ["-c", "timezone=UTC"] });

let status = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("rnc_teste");
  const url = `postgresql://rnc:${senha}@localhost:${porta}/rnc_teste`;
  console.log(`PostgreSQL de teste na porta ${porta} (descartável)`);
  const r = spawnSync("npx vitest run --config vitest.integracao.config.mts", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, TEST_DATABASE_URL: url },
  });
  status = r.status ?? 1;
} catch (e) {
  console.error("Não foi possível subir o PostgreSQL de teste:", e instanceof Error ? e.message : e);
} finally {
  await pg.stop().catch(() => {});
  rmSync(pasta, { recursive: true, force: true });
}
process.exit(status);
