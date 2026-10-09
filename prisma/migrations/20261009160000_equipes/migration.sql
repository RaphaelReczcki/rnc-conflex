-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "equipe_id" UUID;

-- CreateTable
CREATE TABLE "equipes" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "lider_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipes_nome_key" ON "equipes"("nome");

-- CreateIndex
CREATE INDEX "equipes_lider_id_idx" ON "equipes"("lider_id");

-- CreateIndex
CREATE INDEX "usuarios_equipe_id_idx" ON "usuarios"("equipe_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_lider_id_fkey" FOREIGN KEY ("lider_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regras de integridade
ALTER TABLE "equipes"
  ADD CONSTRAINT "equipes_nome_ck" CHECK (btrim("nome") <> '');
