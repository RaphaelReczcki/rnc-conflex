// Confere se o banco recusa dados inválidos e se o histórico é imutável.
// Cada caso roda numa transação desfeita no fim (ROLLBACK): nada fica gravado.
// Uso: npm run db:check
import "dotenv/config";
import { Client } from "pg";

type Caso = { nome: string; sql: string };

// Cria um setor, um usuário, uma RNC e um evento de histórico de apoio.
const PREPARO = `
  INSERT INTO setores (id, nome, atualizado_em) VALUES ('00000000-0000-0000-0000-000000000001', 'Setor teste', now());
  INSERT INTO usuarios (id, nome, email, perfil, atualizado_em)
    VALUES ('00000000-0000-0000-0000-000000000002', 'Pessoa teste', 'teste@conflex.com.br', 'colaborador', now());
  INSERT INTO rncs (id, codigo, data_ocorrencia, setor_id, tipo_problema, tipo_problema_norm, origem, severidade,
                    descricao, autor_id, atualizada_em)
    VALUES ('00000000-0000-0000-0000-000000000003', 'RNC-2099-9999', current_date,
            '00000000-0000-0000-0000-000000000001', 'Guia paga em atraso', 'guia paga em atraso',
            'erro_interno', 'alta', 'Teste', '00000000-0000-0000-0000-000000000002', now());
  INSERT INTO historico (rnc_id, tipo, texto, status_novo, ciclo, usuario_id)
    VALUES ('00000000-0000-0000-0000-000000000003', 'registro', 'RNC registrada', 'analise', 1,
            '00000000-0000-0000-0000-000000000002');
`;

const RNC = "'00000000-0000-0000-0000-000000000003'";

const DEVEM_FALHAR: Caso[] = [
  { nome: "status inválido", sql: `UPDATE rncs SET status = 'cancelada' WHERE id = ${RNC}` },
  { nome: "severidade inválida", sql: `UPDATE rncs SET severidade = 'gravissima' WHERE id = ${RNC}` },
  { nome: "origem inválida", sql: `UPDATE rncs SET origem = 'outro' WHERE id = ${RNC}` },
  { nome: "encerrada sem data de encerramento", sql: `UPDATE rncs SET status = 'encerrada' WHERE id = ${RNC}` },
  { nome: "data de encerramento sem estar encerrada", sql: `UPDATE rncs SET encerrada_em = now() WHERE id = ${RNC}` },
  { nome: "código fora do formato RNC-AAAA-NNNN", sql: `UPDATE rncs SET codigo = 'RNC-2610-0001' WHERE id = ${RNC}` },
  { nome: "multas e juros negativos", sql: `UPDATE rncs SET multas_juros = -1 WHERE id = ${RNC}` },
  { nome: "horas de retrabalho negativas", sql: `UPDATE rncs SET horas_retrabalho = -0.5 WHERE id = ${RNC}` },
  { nome: "descrição vazia", sql: `UPDATE rncs SET descricao = '   ' WHERE id = ${RNC}` },
  {
    nome: "análise concluída sem causa raiz",
    sql: `INSERT INTO analises (id, rnc_id, ciclo, concluida_em, concluida_por_id, atualizado_em)
          VALUES (gen_random_uuid(), ${RNC}, 1, now(), '00000000-0000-0000-0000-000000000002', now())`,
  },
  {
    nome: "ação concluída sem responsável",
    sql: `INSERT INTO acoes_corretivas (id, rnc_id, ciclo, descricao, verificar_em, concluida_em, concluida_por_id, atualizado_em)
          VALUES (gen_random_uuid(), ${RNC}, 1, 'Ação', current_date + 30, now(),
                  '00000000-0000-0000-0000-000000000002', now())`,
  },
  {
    nome: "líder de setor sem setor",
    sql: `INSERT INTO usuarios (id, nome, email, perfil, atualizado_em)
          VALUES (gen_random_uuid(), 'Líder', 'lider@conflex.com.br', 'lider_setor', now())`,
  },
  { nome: "perfil inválido", sql: `UPDATE usuarios SET perfil = 'admin' WHERE email = 'teste@conflex.com.br'` },
  { nome: "e-mail com maiúsculas", sql: `UPDATE usuarios SET email = 'Teste@Conflex.com.br' WHERE email = 'teste@conflex.com.br'` },
  { nome: "alterar histórico", sql: `UPDATE historico SET texto = 'editado' WHERE rnc_id = ${RNC}` },
  { nome: "apagar histórico", sql: `DELETE FROM historico WHERE rnc_id = ${RNC}` },
  { nome: "truncar histórico", sql: `TRUNCATE historico CASCADE` },
  { nome: "apagar RNC com histórico", sql: `DELETE FROM rncs WHERE id = ${RNC}` },
  { nome: "RNC com setor inexistente", sql: `UPDATE rncs SET setor_id = gen_random_uuid() WHERE id = ${RNC}` },
];

const DEVEM_PASSAR: Caso[] = [
  {
    nome: "encerrar com data de encerramento",
    sql: `UPDATE rncs SET status = 'encerrada', encerrada_em = now() + interval '1 second' WHERE id = ${RNC}`,
  },
  {
    nome: "análise concluída com causa raiz",
    sql: `INSERT INTO analises (id, rnc_id, ciclo, causa_raiz, concluida_em, concluida_por_id, atualizado_em)
          VALUES (gen_random_uuid(), ${RNC}, 1, 'Checklist sem conferência de feriados', now(),
                  '00000000-0000-0000-0000-000000000002', now())`,
  },
  { nome: "acrescentar evento ao histórico", sql: `INSERT INTO historico (rnc_id, tipo, texto, ciclo) VALUES (${RNC}, 'edicao', 'Ajuste', 1)` },
];

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL (ou DIRECT_URL) no .env.");
  const db = new Client({ connectionString: url });
  await db.connect();
  let falhas = 0;

  const rodar = async (caso: Caso, esperaErro: boolean) => {
    await db.query("BEGIN");
    try {
      await db.query(PREPARO);
      let erro: string | null = null;
      try {
        await db.query(caso.sql);
      } catch (e) {
        erro = e instanceof Error ? e.message : String(e);
      }
      const ok = esperaErro ? erro !== null : erro === null;
      if (!ok) falhas++;
      const detalhe = esperaErro ? (erro ? `recusado: ${erro.split("\n")[0]}` : "ACEITO (deveria recusar)") : erro ? `ERRO: ${erro}` : "aceito";
      console.log(`${ok ? "ok  " : "FALHOU"}  ${caso.nome} — ${detalhe}`);
    } finally {
      await db.query("ROLLBACK");
    }
  };

  console.log("Deve recusar:");
  for (const caso of DEVEM_FALHAR) await rodar(caso, true);
  console.log("\nDeve aceitar:");
  for (const caso of DEVEM_PASSAR) await rodar(caso, false);

  const { rows } = await db.query(`
    SELECT (SELECT count(*) FROM setores)::int AS setores,
           (SELECT count(*) FROM categorias)::int AS categorias,
           (SELECT count(*) FROM usuarios WHERE perfil = 'gestao')::int AS gestao,
           (SELECT count(*) FROM clientes)::int AS clientes`);
  console.log(`\nDados do seed: ${JSON.stringify(rows[0])}`);
  await db.end();

  console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodas as verificações passaram.");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
