// Desenvolvimento local: sobe o PostgreSQL local e o Next.js juntos.
// Ao parar (Ctrl+C), desliga os dois. Uso: npm run dev:local
import { spawn } from "node:child_process";
import { subirBancoLocal } from "./banco-local.mjs";

const desligarBanco = await subirBancoLocal();
const next = spawn("npx next dev", { stdio: "inherit", shell: true });

let saindo = false;
async function sair(codigo = 0) {
  if (saindo) return;
  saindo = true;
  next.kill();
  await desligarBanco().catch(() => {});
  process.exit(codigo);
}
process.on("SIGINT", () => sair(0));
process.on("SIGTERM", () => sair(0));
next.on("exit", (codigo) => sair(codigo ?? 0));
