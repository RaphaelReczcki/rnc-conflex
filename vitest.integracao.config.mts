// Testes de integração: rodam os serviços contra um PostgreSQL de verdade,
// indicado em TEST_DATABASE_URL (nunca o banco de desenvolvimento ou produção).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": caminho("./src"),
      // "server-only" só faz sentido dentro do Next.js
      "server-only": caminho("./tests/apoio/server-only.ts"),
    },
  },
  test: {
    include: ["tests/integracao/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/apoio/preparar-banco.ts"],
    setupFiles: ["tests/apoio/ambiente.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
