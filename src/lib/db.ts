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

function instancia(): PrismaClient {
  global_.prisma ??= criarPrisma();
  return global_.prisma;
}

// A conexão só é criada no primeiro uso. Assim, carregar o módulo (como o
// build do Next.js faz para coletar as rotas) não exige DATABASE_URL.
export const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, prop) {
    const cliente = instancia();
    const valor = Reflect.get(cliente, prop, cliente);
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
