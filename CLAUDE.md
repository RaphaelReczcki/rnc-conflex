# Sistema de Não Conformidades (RNC) — Conflex Assessoria Contábil

## Objetivo

Aplicação web interna para a equipe da Conflex registrar não conformidades (erros, atrasos, falhas de processo), tratá-las num ciclo fechado e acompanhar indicadores de melhoria. O princípio é avaliar o processo, não a pessoa: a interface e os textos nunca devem soar punitivos.

Existe um protótipo funcional em `rnc-conflex.html` (HTML único, sem backend). Use-o como referência de fluxo, campos, textos e visual. Esta versão deve virar um sistema multiusuário de verdade, com login, banco de dados e notificações.

## Stack sugerida (confirmar com o Raphael antes de começar)

- Next.js (App Router) + TypeScript
- PostgreSQL (Supabase ou Postgres próprio) com Prisma ou Drizzle
- Autenticação por e-mail corporativo (@conflex.com.br)
- Envio de e-mail para lembretes de prazo
- Deploy no Railway (aplicação + PostgreSQL), código em GitHub privado (definido em 09/10/2026; veja docs/deploy-railway.md)

Antes de escrever código, pergunte onde o sistema vai rodar e se já existe alguma infraestrutura (servidor, banco, Microsoft 365 para login).

## Perfis de acesso

- **Colaborador:** registra RNCs e trata as que estiverem sob sua responsabilidade.
- **Líder de setor:** trata qualquer RNC do seu setor e conclui análises e verificações.
- **Gestão da qualidade / sócios:** acesso total, painel consolidado, exportação, cadastro de setores e categorias.

## Ciclo da RNC

Status possíveis, nesta ordem: `analise` → `acao` → `verificacao` → `encerrada`.

1. **Registro:** cria a RNC já com status `analise`.
2. **Análise de causa:** método "5 Porquês" (5 campos) ou "Ishikawa" (categorias: Método/processo, Pessoas, Sistema/software, Cliente, Documentação, Prazo/ambiente). Campo obrigatório para concluir: causa raiz. Pode salvar rascunho.
3. **Ação corretiva:** ação (obrigatória), responsável (obrigatório, usuário do sistema), prazo, flag "exige atualizar POP/checklist/modelo", data prevista de verificação (padrão: hoje + 30 dias).
4. **Verificação de eficácia:**
   - **Eficaz:** status `encerrada`, registra evidência/aprendizado e a data de encerramento.
   - **Ineficaz:** volta para `analise` e incrementa `reaberturas`. A ação anterior é preservada no histórico e a causa raiz é limpa para nova análise.

Toda transição grava uma entrada de histórico (texto, data, usuário). O histórico nunca é apagado.

## Campos do registro

- Código legível: `RNC-AAAA-NNNN` (ex.: `RNC-2026-0001`), começando pelo ano; numeração sequencial anual, recomeça em 1º de janeiro
- Data da ocorrência
- Setor: Fiscal, Contábil, Pessoal/Folha, Societário/Legalização, Atendimento, Financeiro interno. Deve ser editável pela gestão.
- Cliente afetado (opcional; idealmente vinculado a um cadastro de clientes)
- Tipo de problema: texto com sugestões a partir de uma lista padronizada, editável pela gestão. Exemplos: Guia paga em atraso, Obrigação acessória entregue fora do prazo, Retificação de declaração, Erro de cálculo na folha, Lançamento contábil incorreto, Classificação fiscal incorreta, Documento do cliente entregue em atraso, Cadastro desatualizado, Falha de comunicação com o cliente, Conciliação bancária com divergência, Prazo de legalização perdido.
- Origem: Erro interno, Cliente, Sistema/software, Mudança na legislação, Fornecedor/terceiro, Órgão público
- Severidade:
  - **Crítica:** gera multa, autuação ou risco legal
  - **Alta:** exige retificação ou retrabalho significativo
  - **Média:** atraso interno, sem impacto externo
  - **Baixa:** oportunidade de melhoria
- O que aconteceu (obrigatório)
- Correção imediata
- Impacto: multas e juros (R$) e horas de retrabalho, editáveis depois do registro
- Anexos (novo em relação ao protótipo): comprovantes, prints, guias

## Painel e indicadores (janela padrão: 12 meses)

- Contagem por etapa do ciclo (encerradas consideram só as dos últimos 12 meses)
- "Pedem atenção": ações com prazo vencido, verificações com data atingida, críticas ainda sem análise
- Tempo médio até encerrar: média de (encerradaEm − criadaEm) em dias
- Reincidência: % das RNCs cujo par (setor, tipo de problema normalizado) aparece mais de uma vez no período
- % com origem no cliente
- Custo acumulado: multas/juros e horas de retrabalho
- Gráficos: por setor empilhado por severidade, por origem, registros por mês (6 meses)
- Problemas recorrentes: pares (setor, tipo) com 2 ou mais ocorrências nos últimos 180 dias
- Filtros do painel por setor e período (novo)

Normalização do tipo de problema: minúsculas, sem acentos, sem espaços nas pontas.

## Lista de registros

Busca por código, cliente, tipo e responsável. Filtros por etapa (padrão: em aberto), setor e severidade. Exportação CSV com separador `;`, BOM UTF-8 e proteção contra injeção de fórmula (prefixar `'` em valores iniciados por `= + - @`).

## Notificações (novo)

- E-mail ao responsável quando receber uma ação corretiva
- Lembrete 3 dias antes e no dia do prazo da ação
- Aviso ao líder do setor quando a verificação estiver liberada
- Resumo semanal para a gestão

## LGPD e segurança

- O sistema guarda dados de clientes do escritório: acesso só autenticado, só pela equipe.
- Não registrar CPF, dados bancários ou dados de saúde de funcionários de clientes nos campos livres. Incluir um aviso discreto no formulário.
- Log de auditoria das alterações (o histórico cobre a maior parte).
- Backups do banco.

## Interface

- Português do Brasil, datas em dd/mm/aaaa e moeda em BRL
- Seguir o layout do sistema fiscal e-LALUR da Conflex (`C:\Users\RAPHAEL\Lalur\web`): logo Conflex, azul-marinho `#384c77` e azul-claro `#79c5f1`, cabeçalho com barra da marca + faixa de módulos, login dividido com a arte da marca, fonte Segoe UI. Do protótipo ficam os componentes (ciclo, cores de severidade, formulários). Tema claro e escuro, responsivo para celular
- Textos em linguagem simples e não punitiva

## Ordem sugerida de implementação

1. Modelo de dados e migrations (rnc, historico, usuario, setor, categoria, anexo)
2. Autenticação e perfis
3. Registro e lista
4. Detalhe com o ciclo completo e as regras de transição
5. Painel e indicadores
6. Exportação CSV
7. Notificações por e-mail
8. Anexos
9. Testes das regras de transição e do cálculo dos indicadores
