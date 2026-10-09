// Copia equipe e cadastros do banco local para o banco da nuvem (Railway).
// Leva: setores, categorias, clientes e usuários (com perfil, setor e senha).
// Não leva: RNCs, sessões, links de senha e e-mails. Nunca sobrescreve o que já
// existe no destino (o que já estiver lá é mantido).
//
// Uso: defina NUVEM_DATABASE_URL no .env (a URL pública do Postgres do Railway)
//      e rode: node scripts/migrar-para-nuvem.mjs
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

const origemUrl = process.env.DATABASE_URL;
const destinoUrl = process.env.NUVEM_DATABASE_URL;
if (!origemUrl || !destinoUrl) {
  console.error("Defina DATABASE_URL (banco local) e NUVEM_DATABASE_URL (banco da nuvem) no .env.");
  process.exit(1);
}
if (origemUrl === destinoUrl) {
  console.error("NUVEM_DATABASE_URL é igual ao banco local. Nada foi feito.");
  process.exit(1);
}
const host = (u) => new URL(u).hostname;
const local = (u) => ["localhost", "127.0.0.1"].includes(host(u));

console.log(`Origem: ${host(origemUrl)}  →  Destino: ${host(destinoUrl)}`);
console.log("1) Aplicando as migrations no destino…");
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: destinoUrl, DIRECT_URL: destinoUrl } });

const origem = new pg.Client({ connectionString: origemUrl });
// Conexão criptografada com o Railway (certificado próprio do serviço)
const destino = new pg.Client({ connectionString: destinoUrl, ssl: local(destinoUrl) ? undefined : { rejectUnauthorized: false } });
await origem.connect();
await destino.connect();

console.log("2) Copiando cadastros…");
await destino.query("BEGIN");
try {
  for (const tabela of ["setores", "categorias", "clientes", "usuarios"]) {
    const { rows, fields } = await origem.query(`SELECT * FROM "${tabela}"`);
    const cols = fields.map((f) => f.name);
    let novos = 0;
    for (const r of rows) {
      const res = await destino.query(
        `INSERT INTO "${tabela}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT DO NOTHING`,
        cols.map((c) => r[c]),
      );
      novos += res.rowCount;
    }
    console.log(`   ${tabela}: ${rows.length} no local, ${novos} copiados, ${rows.length - novos} já existiam no destino`);
  }
  await destino.query("COMMIT");
} catch (e) {
  await destino.query("ROLLBACK");
  console.error("Falhou; nada foi gravado no destino:", e.message);
  process.exitCode = 1;
}
const total = (await destino.query("SELECT count(*)::int n FROM usuarios WHERE ativo")).rows[0].n;
console.log(`Pronto. Usuários ativos na nuvem: ${total}.`);
await origem.end();
await destino.end();
