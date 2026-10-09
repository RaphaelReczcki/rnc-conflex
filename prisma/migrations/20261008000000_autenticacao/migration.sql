-- CreateEnum
CREATE TYPE "tipo_token_senha" AS ENUM ('convite', 'redefinicao');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "bloqueado_ate" TIMESTAMPTZ(3),
ADD COLUMN     "tentativas_falhas" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "encerrada_em" TIMESTAMPTZ(3),
    "user_agent" VARCHAR(400),

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_senha" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "tipo" "tipo_token_senha" NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),

    CONSTRAINT "tokens_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- CreateIndex
CREATE INDEX "sessoes_expira_em_idx" ON "sessoes"("expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_senha_token_hash_key" ON "tokens_senha"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_senha_usuario_id_idx" ON "tokens_senha"("usuario_id");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_senha" ADD CONSTRAINT "tokens_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_senha" ADD CONSTRAINT "tokens_senha_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras de integridade
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_tentativas_falhas_ck" CHECK ("tentativas_falhas" >= 0);

ALTER TABLE "sessoes"
  ADD CONSTRAINT "sessoes_validade_ck" CHECK ("expira_em" > "criada_em");

ALTER TABLE "tokens_senha"
  ADD CONSTRAINT "tokens_senha_validade_ck" CHECK ("expira_em" > "criado_em");
