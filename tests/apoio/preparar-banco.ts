// Antes dos testes de integração: confere o banco de teste e aplica as migrations.
import "dotenv/config";
import { execSync } from "node:child_process";

export default function prepararBanco() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL (um banco só para testes) ou use: npm run test:integracao:local");
  if (url === process.env.DATABASE_URL || url === process.env.DIRECT_URL) {
    throw new Error("TEST_DATABASE_URL não pode ser o mesmo banco de DATABASE_URL/DIRECT_URL.");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
