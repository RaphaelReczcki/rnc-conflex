import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations usam a conexão direta (DIRECT_URL). No Neon, a DATABASE_URL
// costuma ser a do pooler, que não serve para migrations.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
