-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "perfil" AS ENUM ('colaborador', 'lider_setor', 'gestao');

-- CreateEnum
CREATE TYPE "status_rnc" AS ENUM ('analise', 'acao', 'verificacao', 'encerrada');

-- CreateEnum
CREATE TYPE "severidade" AS ENUM ('critica', 'alta', 'media', 'baixa');

-- CreateEnum
CREATE TYPE "origem" AS ENUM ('erro_interno', 'cliente', 'sistema_software', 'mudanca_legislacao', 'fornecedor_terceiro', 'orgao_publico');

-- CreateEnum
CREATE TYPE "metodo_analise" AS ENUM ('cinco_porques', 'ishikawa');

-- CreateEnum
CREATE TYPE "resultado_verificacao" AS ENUM ('eficaz', 'ineficaz');

-- CreateEnum
CREATE TYPE "etapa_anexo" AS ENUM ('registro', 'analise', 'acao', 'verificacao');

-- CreateEnum
CREATE TYPE "tipo_evento" AS ENUM ('registro', 'edicao', 'impacto_atualizado', 'analise_concluida', 'acao_concluida', 'verificacao_eficaz', 'verificacao_ineficaz', 'responsavel_alterado', 'anexo_adicionado', 'anexo_removido');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" TEXT,
    "perfil" "perfil" NOT NULL DEFAULT 'colaborador',
    "setor_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deve_trocar_senha" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_acesso_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "nome_normalizado" VARCHAR(120) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "nome_normalizado" VARCHAR(160) NOT NULL,
    "codigo_interno" VARCHAR(40),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rncs" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(13) NOT NULL,
    "data_ocorrencia" DATE NOT NULL,
    "setor_id" UUID NOT NULL,
    "cliente_id" UUID,
    "categoria_id" UUID,
    "tipo_problema" VARCHAR(160) NOT NULL,
    "tipo_problema_norm" VARCHAR(160) NOT NULL,
    "origem" "origem" NOT NULL,
    "severidade" "severidade" NOT NULL,
    "descricao" TEXT NOT NULL,
    "correcao_imediata" TEXT,
    "multas_juros" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "horas_retrabalho" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "status" "status_rnc" NOT NULL DEFAULT 'analise',
    "reaberturas" INTEGER NOT NULL DEFAULT 0,
    "autor_id" UUID NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL,
    "encerrada_em" TIMESTAMPTZ(3),

    CONSTRAINT "rncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rnc_contadores" (
    "ano_mes" CHAR(4) NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rnc_contadores_pkey" PRIMARY KEY ("ano_mes")
);

-- CreateTable
CREATE TABLE "analises" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL DEFAULT 1,
    "metodo" "metodo_analise" NOT NULL DEFAULT 'cinco_porques',
    "porque_1" TEXT,
    "porque_2" TEXT,
    "porque_3" TEXT,
    "porque_4" TEXT,
    "porque_5" TEXT,
    "ish_metodo" TEXT,
    "ish_pessoas" TEXT,
    "ish_sistema" TEXT,
    "ish_cliente" TEXT,
    "ish_documentacao" TEXT,
    "ish_prazo" TEXT,
    "causa_raiz" TEXT,
    "concluida_em" TIMESTAMPTZ(3),
    "concluida_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acoes_corretivas" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL DEFAULT 1,
    "descricao" TEXT,
    "responsavel_id" UUID,
    "prazo" DATE,
    "exige_atualizar_documento" BOOLEAN NOT NULL DEFAULT false,
    "verificar_em" DATE,
    "concluida_em" TIMESTAMPTZ(3),
    "concluida_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "acoes_corretivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificacoes" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "acao_id" UUID NOT NULL,
    "resultado" "resultado_verificacao" NOT NULL,
    "evidencia" TEXT,
    "verificado_por_id" UUID NOT NULL,
    "verificado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico" (
    "id" BIGSERIAL NOT NULL,
    "rnc_id" UUID NOT NULL,
    "tipo" "tipo_evento" NOT NULL,
    "texto" TEXT NOT NULL,
    "status_anterior" "status_rnc",
    "status_novo" "status_rnc",
    "ciclo" INTEGER NOT NULL,
    "usuario_id" UUID,
    "dados" JSONB,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos" (
    "id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "etapa" "etapa_anexo" NOT NULL DEFAULT 'registro',
    "ciclo" INTEGER NOT NULL DEFAULT 1,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "tipo_mime" VARCHAR(127) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "armazenamento" VARCHAR(40) NOT NULL,
    "chave" VARCHAR(1024) NOT NULL,
    "sha256" CHAR(64),
    "enviado_por_id" UUID NOT NULL,
    "enviado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removido_em" TIMESTAMPTZ(3),
    "removido_por_id" UUID,

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_setor_id_idx" ON "usuarios"("setor_id");

-- CreateIndex
CREATE INDEX "usuarios_perfil_ativo_idx" ON "usuarios"("perfil", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "setores_nome_key" ON "setores"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_normalizado_key" ON "categorias"("nome_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_interno_key" ON "clientes"("codigo_interno");

-- CreateIndex
CREATE INDEX "clientes_nome_normalizado_idx" ON "clientes"("nome_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "rncs_codigo_key" ON "rncs"("codigo");

-- CreateIndex
CREATE INDEX "rncs_status_idx" ON "rncs"("status");

-- CreateIndex
CREATE INDEX "rncs_setor_id_status_idx" ON "rncs"("setor_id", "status");

-- CreateIndex
CREATE INDEX "rncs_severidade_status_idx" ON "rncs"("severidade", "status");

-- CreateIndex
CREATE INDEX "rncs_criada_em_idx" ON "rncs"("criada_em" DESC);

-- CreateIndex
CREATE INDEX "rncs_encerrada_em_idx" ON "rncs"("encerrada_em");

-- CreateIndex
CREATE INDEX "rncs_data_ocorrencia_idx" ON "rncs"("data_ocorrencia");

-- CreateIndex
CREATE INDEX "rncs_setor_id_tipo_problema_norm_criada_em_idx" ON "rncs"("setor_id", "tipo_problema_norm", "criada_em");

-- CreateIndex
CREATE INDEX "rncs_cliente_id_idx" ON "rncs"("cliente_id");

-- CreateIndex
CREATE INDEX "rncs_autor_id_idx" ON "rncs"("autor_id");

-- CreateIndex
CREATE UNIQUE INDEX "analises_rnc_id_ciclo_key" ON "analises"("rnc_id", "ciclo");

-- CreateIndex
CREATE INDEX "acoes_corretivas_concluida_em_prazo_idx" ON "acoes_corretivas"("concluida_em", "prazo");

-- CreateIndex
CREATE INDEX "acoes_corretivas_verificar_em_idx" ON "acoes_corretivas"("verificar_em");

-- CreateIndex
CREATE INDEX "acoes_corretivas_responsavel_id_concluida_em_idx" ON "acoes_corretivas"("responsavel_id", "concluida_em");

-- CreateIndex
CREATE UNIQUE INDEX "acoes_corretivas_rnc_id_ciclo_key" ON "acoes_corretivas"("rnc_id", "ciclo");

-- CreateIndex
CREATE UNIQUE INDEX "verificacoes_acao_id_key" ON "verificacoes"("acao_id");

-- CreateIndex
CREATE UNIQUE INDEX "verificacoes_rnc_id_ciclo_key" ON "verificacoes"("rnc_id", "ciclo");

-- CreateIndex
CREATE INDEX "historico_rnc_id_criado_em_idx" ON "historico"("rnc_id", "criado_em");

-- CreateIndex
CREATE INDEX "historico_usuario_id_idx" ON "historico"("usuario_id");

-- CreateIndex
CREATE INDEX "anexos_rnc_id_idx" ON "anexos"("rnc_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rncs" ADD CONSTRAINT "rncs_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rncs" ADD CONSTRAINT "rncs_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rncs" ADD CONSTRAINT "rncs_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rncs" ADD CONSTRAINT "rncs_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises" ADD CONSTRAINT "analises_rnc_id_fkey" FOREIGN KEY ("rnc_id") REFERENCES "rncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises" ADD CONSTRAINT "analises_concluida_por_id_fkey" FOREIGN KEY ("concluida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_corretivas" ADD CONSTRAINT "acoes_corretivas_rnc_id_fkey" FOREIGN KEY ("rnc_id") REFERENCES "rncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_corretivas" ADD CONSTRAINT "acoes_corretivas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_corretivas" ADD CONSTRAINT "acoes_corretivas_concluida_por_id_fkey" FOREIGN KEY ("concluida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacoes" ADD CONSTRAINT "verificacoes_rnc_id_fkey" FOREIGN KEY ("rnc_id") REFERENCES "rncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacoes" ADD CONSTRAINT "verificacoes_acao_id_fkey" FOREIGN KEY ("acao_id") REFERENCES "acoes_corretivas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacoes" ADD CONSTRAINT "verificacoes_verificado_por_id_fkey" FOREIGN KEY ("verificado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico" ADD CONSTRAINT "historico_rnc_id_fkey" FOREIGN KEY ("rnc_id") REFERENCES "rncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico" ADD CONSTRAINT "historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_rnc_id_fkey" FOREIGN KEY ("rnc_id") REFERENCES "rncs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_removido_por_id_fkey" FOREIGN KEY ("removido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
