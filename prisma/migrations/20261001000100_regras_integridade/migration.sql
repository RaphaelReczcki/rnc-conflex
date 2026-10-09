-- Regras de integridade que o schema do Prisma não expressa.
-- Status, severidade, origem e perfil já são ENUMs (valores fora da lista são recusados).

-- usuarios
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_email_minusculo_ck" CHECK ("email" = lower("email") AND "email" LIKE '%_@_%'),
  ADD CONSTRAINT "usuarios_nome_ck" CHECK (btrim("nome") <> ''),
  ADD CONSTRAINT "usuarios_lider_tem_setor_ck" CHECK ("perfil" <> 'lider_setor' OR "setor_id" IS NOT NULL);

-- setores, categorias, clientes
ALTER TABLE "setores"
  ADD CONSTRAINT "setores_nome_ck" CHECK (btrim("nome") <> '');

ALTER TABLE "categorias"
  ADD CONSTRAINT "categorias_nome_ck" CHECK (btrim("nome") <> '' AND btrim("nome_normalizado") <> '');

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_nome_ck" CHECK (btrim("nome") <> '' AND btrim("nome_normalizado") <> '');

-- rnc_contadores
ALTER TABLE "rnc_contadores"
  ADD CONSTRAINT "rnc_contadores_ano_mes_ck" CHECK ("ano_mes" ~ '^[0-9]{2}(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "rnc_contadores_ultimo_ck" CHECK ("ultimo" BETWEEN 0 AND 9999);

-- rncs
ALTER TABLE "rncs"
  ADD CONSTRAINT "rncs_codigo_formato_ck" CHECK ("codigo" ~ '^RNC-[0-9]{2}(0[1-9]|1[0-2])-[0-9]{4}$'),
  ADD CONSTRAINT "rncs_tipo_problema_ck" CHECK (btrim("tipo_problema") <> '' AND btrim("tipo_problema_norm") <> ''),
  ADD CONSTRAINT "rncs_descricao_ck" CHECK (btrim("descricao") <> ''),
  ADD CONSTRAINT "rncs_multas_juros_ck" CHECK ("multas_juros" >= 0),
  ADD CONSTRAINT "rncs_horas_retrabalho_ck" CHECK ("horas_retrabalho" >= 0),
  ADD CONSTRAINT "rncs_reaberturas_ck" CHECK ("reaberturas" >= 0),
  -- Encerrada se, e somente se, tem data de encerramento
  ADD CONSTRAINT "rncs_encerramento_ck" CHECK (("status" = 'encerrada') = ("encerrada_em" IS NOT NULL)),
  ADD CONSTRAINT "rncs_encerrada_apos_criada_ck" CHECK ("encerrada_em" IS NULL OR "encerrada_em" >= "criada_em");

-- analises: só conclui com causa raiz
ALTER TABLE "analises"
  ADD CONSTRAINT "analises_ciclo_ck" CHECK ("ciclo" >= 1),
  ADD CONSTRAINT "analises_conclusao_ck" CHECK (
    "concluida_em" IS NULL
    OR ("causa_raiz" IS NOT NULL AND btrim("causa_raiz") <> '' AND "concluida_por_id" IS NOT NULL)
  );

-- acoes_corretivas: só conclui com ação, responsável e data de verificação
ALTER TABLE "acoes_corretivas"
  ADD CONSTRAINT "acoes_corretivas_ciclo_ck" CHECK ("ciclo" >= 1),
  ADD CONSTRAINT "acoes_corretivas_conclusao_ck" CHECK (
    "concluida_em" IS NULL
    OR ("descricao" IS NOT NULL AND btrim("descricao") <> ''
        AND "responsavel_id" IS NOT NULL
        AND "verificar_em" IS NOT NULL
        AND "concluida_por_id" IS NOT NULL)
  );

-- verificacoes
ALTER TABLE "verificacoes"
  ADD CONSTRAINT "verificacoes_ciclo_ck" CHECK ("ciclo" >= 1);

-- historico
ALTER TABLE "historico"
  ADD CONSTRAINT "historico_texto_ck" CHECK (btrim("texto") <> ''),
  ADD CONSTRAINT "historico_ciclo_ck" CHECK ("ciclo" >= 1);

-- anexos
ALTER TABLE "anexos"
  ADD CONSTRAINT "anexos_tamanho_ck" CHECK ("tamanho_bytes" > 0),
  ADD CONSTRAINT "anexos_ciclo_ck" CHECK ("ciclo" >= 1),
  ADD CONSTRAINT "anexos_remocao_ck" CHECK (("removido_em" IS NULL) = ("removido_por_id" IS NULL));

-- O histórico nunca é alterado nem apagado: só INSERT.
CREATE FUNCTION "historico_somente_insercao"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de RNC não pode ser alterado nem apagado (operação %).', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "historico_bloqueia_update_delete"
  BEFORE UPDATE OR DELETE ON "historico"
  FOR EACH ROW EXECUTE FUNCTION "historico_somente_insercao"();

CREATE TRIGGER "historico_bloqueia_truncate"
  BEFORE TRUNCATE ON "historico"
  FOR EACH STATEMENT EXECUTE FUNCTION "historico_somente_insercao"();
