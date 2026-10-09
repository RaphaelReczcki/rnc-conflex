import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function criarPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não definida. Copie .env.example para .env e preencha a conexão.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Uma instância por processo (evita abrir conexões a cada hot reload no dev).
const global_ = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = global_.prisma ?? criarPrisma();
if (process.env.NODE_ENV !== "production") global_.prisma = prisma;
