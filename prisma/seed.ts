// Seed: setores, categorias padronizadas e um usuário de gestão para teste.
// Idempotente: pode rodar de novo sem duplicar nada. Não cria clientes.
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizar } from "../src/lib/normalizar";

const SETORES = [
  "Fiscal",
  "Contábil",
  "Pessoal/Folha",
  "Societário/Legalização",
  "Atendimento",
  "Financeiro interno",
];

const CATEGORIAS = [
  "Guia paga em atraso",
  "Obrigação acessória entregue fora do prazo",
  "Retificação de declaração",
  "Erro de cálculo na folha",
  "Lançamento contábil incorreto",
  "Classificação fiscal incorreta",
  "Documento do cliente entregue em atraso",
  "Cadastro desatualizado",
  "Falha de comunicação com o cliente",
  "Conciliação bancária com divergência",
  "Prazo de legalização perdido",
];

function exigirEnv(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`Defina ${nome} no .env antes de rodar o seed (veja .env.example).`);
  return valor;
}

async function main() {
  const connectionString = exigirEnv(process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    for (const [ordem, nome] of SETORES.entries()) {
      await prisma.setor.upsert({ where: { nome }, update: {}, create: { nome, ordem } });
    }

    for (const [ordem, nome] of CATEGORIAS.entries()) {
      const nomeNormalizado = normalizar(nome);
      await prisma.categoria.upsert({
        where: { nomeNormalizado },
        update: {},
        create: { nome, nomeNormalizado, ordem },
      });
    }

    const email = exigirEnv("SEED_GESTAO_EMAIL").toLowerCase();
    const nome = process.env.SEED_GESTAO_NOME?.trim() || "Gestão da Qualidade";
    const senha = exigirEnv("SEED_GESTAO_SENHA");
    if (senha.length < 12) throw new Error("SEED_GESTAO_SENHA precisa ter ao menos 12 caracteres.");

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      console.log(`Usuário de gestão ${email} já existe; senha mantida.`);
    } else {
      await prisma.usuario.create({
        data: {
          nome,
          email,
          perfil: "gestao",
          senhaHash: await hash(senha),
          // Pede troca de senha no primeiro acesso
          deveTrocarSenha: true,
        },
      });
      console.log(`Usuário de gestão ${email} criado.`);
    }

    const [setores, categorias, usuarios] = await Promise.all([
      prisma.setor.count(),
      prisma.categoria.count(),
      prisma.usuario.count(),
    ]);
    console.log(`Seed concluído: ${setores} setores, ${categorias} categorias, ${usuarios} usuário(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
