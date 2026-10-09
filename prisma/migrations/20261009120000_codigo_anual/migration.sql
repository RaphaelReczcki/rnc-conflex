-- Código da RNC passa de RNC-AAMM-XXXX (sequência mensal) para RNC-AAAA-NNNN
-- (ano completo, sequência anual que recomeça em 1º de janeiro).

-- 1. Formato do código
ALTER TABLE "rncs" DROP CONSTRAINT "rncs_codigo_formato_ck";

-- RNCs que já existam são renumeradas por ano de registro (horário de Brasília),
-- na ordem em que foram registradas.
WITH novos AS (
  SELECT id,
         'RNC-' || to_char("criada_em" AT TIME ZONE 'America/Sao_Paulo', 'YYYY') || '-' ||
         lpad(row_number() OVER (PARTITION BY to_char("criada_em" AT TIME ZONE 'America/Sao_Paulo', 'YYYY')
                                 ORDER BY "criada_em", "codigo")::text, 4, '0') AS codigo
  FROM "rncs"
)
UPDATE "rncs" r SET "codigo" = n.codigo FROM novos n WHERE r.id = n.id;

ALTER TABLE "rncs"
  ADD CONSTRAINT "rncs_codigo_formato_ck" CHECK ("codigo" ~ '^RNC-20[0-9]{2}-[0-9]{4}$');

-- 2. Contador: por ano em vez de por mês
ALTER TABLE "rnc_contadores" DROP CONSTRAINT "rnc_contadores_ano_mes_ck";
DELETE FROM "rnc_contadores";
ALTER TABLE "rnc_contadores" RENAME COLUMN "ano_mes" TO "ano";
ALTER TABLE "rnc_contadores"
  ADD CONSTRAINT "rnc_contadores_ano_ck" CHECK ("ano" ~ '^20[0-9]{2}$');

INSERT INTO "rnc_contadores" ("ano", "ultimo")
SELECT substr("codigo", 5, 4), max(substr("codigo", 10, 4)::int)
FROM "rncs"
GROUP BY substr("codigo", 5, 4);
