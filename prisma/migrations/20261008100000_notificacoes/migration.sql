-- CreateEnum
CREATE TYPE "tipo_notificacao" AS ENUM ('acao_atribuida', 'lembrete_prazo_3d', 'lembrete_prazo_dia', 'verificacao_liberada', 'resumo_semanal', 'teste');

-- CreateEnum
CREATE TYPE "status_notificacao" AS ENUM ('pendente', 'enviada', 'falhou');

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL,
    "chave" VARCHAR(200) NOT NULL,
    "tipo" "tipo_notificacao" NOT NULL,
    "rnc_id" UUID,
    "assunto" VARCHAR(300) NOT NULL,
    "html" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "status_notificacao" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimo_erro" TEXT,
    "proxima_tentativa_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_em" TIMESTAMPTZ(3),

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao_destinatarios" (
    "notificacao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,

    CONSTRAINT "notificacao_destinatarios_pkey" PRIMARY KEY ("notificacao_id","usuario_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_chave_key" ON "notificacoes"("chave");

-- CreateIndex
CREATE INDEX "notificacoes_status_proxima_tentativa_em_idx" ON "notificacoes"("status", "proxima_tentativa_em");

-- CreateIndex
CREATE INDEX "notificacoes_criada_em_idx" ON "notificacoes"("criada_em" DESC);

-- CreateIndex
CREATE INDEX "notificacao_destinatarios_usuario_id_idx" ON "notificacao_destinatarios"("usuario_id");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_rnc_id_fkey" FOREIGN KEY ("rnc_id") REFERENCES "rncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao_destinatarios" ADD CONSTRAINT "notificacao_destinatarios_notificacao_id_fkey" FOREIGN KEY ("notificacao_id") REFERENCES "notificacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao_destinatarios" ADD CONSTRAINT "notificacao_destinatarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras de integridade
ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_tentativas_ck" CHECK ("tentativas" >= 0),
  ADD CONSTRAINT "notificacoes_envio_ck" CHECK (("status" = 'enviada') = ("enviada_em" IS NOT NULL)),
  ADD CONSTRAINT "notificacoes_chave_ck" CHECK (btrim("chave") <> '');
