-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "cnpj" CHAR(14);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cnpj_key" ON "clientes"("cnpj");

-- CNPJ guardado sem pontuação: 12 posições alfanuméricas + 2 dígitos verificadores
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cnpj_formato_ck" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$');
