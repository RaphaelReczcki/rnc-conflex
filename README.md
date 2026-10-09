# RNC Conflex

Sistema de registro e tratamento de não conformidades da Conflex Assessoria Contábil. Avalia processos, não pessoas.

- Especificação: [CLAUDE.md](CLAUDE.md)
- Protótipo de referência: [rnc-conflex.html](rnc-conflex.html)
- Modelo de dados: [docs/modelo-de-dados.md](docs/modelo-de-dados.md)
- Como cada indicador do painel é calculado: [docs/indicadores.md](docs/indicadores.md)
- Perfis e permissões: [docs/perfis-e-permissoes.md](docs/perfis-e-permissoes.md)

**Stack:** Next.js + TypeScript, PostgreSQL (Neon) com Prisma 7, deploy na Vercel. Login com e-mail e senha próprios. E-mails e anexos via Microsoft 365.

> Em construção. Pronto até agora: **etapa 1** (modelo de dados, migrations e seed), **etapa 2** (login, perfis e cadastro da equipe), **etapa 3** (registro e lista de RNCs) **etapa 4** (ciclo completo: análise, ação, verificação e reabertura), **etapa 5** (painel e indicadores), **etapa 6** (exportação CSV) e **etapa 7** (notificações por e-mail).

## Pré-requisitos

- Node.js 20.19 ou mais recente
- Um banco PostgreSQL: o local do projeto (`npm run dev:local`), o Neon ou Docker

## Rodar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha:
   - `DATABASE_URL` e `DIRECT_URL`: no painel do Neon, em *Connection string*, copie a URL **pooled** para `DATABASE_URL` e a **direta** (sem `-pooler`) para `DIRECT_URL`. Use um branch próprio de desenvolvimento, não o de produção.
   - `SEED_GESTAO_EMAIL` e `SEED_GESTAO_SENHA` (mínimo de 12 caracteres): usuário de gestão para teste.

3. Crie as tabelas e carregue os dados iniciais:

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

4. Confira as regras do banco:

   ```bash
   npm run db:check
   ```

5. Suba o sistema e abra <http://localhost:3000>:

   ```bash
   npm run dev
   ```

   Entre com `SEED_GESTAO_EMAIL` e `SEED_GESTAO_SENHA`. No primeiro acesso o sistema pede uma senha nova.

6. Rode os testes automatizados:

   ```bash
   npm test
   ```

7. Rode os testes de integração, que usam um PostgreSQL de verdade. O comando abaixo sobe um banco descartável numa pasta temporária (pacote `embedded-postgres`, sem Docker), roda a suíte e apaga tudo no fim:

   ```bash
   npm run test:integracao:local
   ```

   Para rodar contra outro banco só de testes (um branch do Neon, por exemplo), coloque a URL em `TEST_DATABASE_URL` e use `npm run test:integracao`. Os testes gravam dados nesse banco, então nunca aponte para o de desenvolvimento ou o de produção.

### Sem conta na nuvem: PostgreSQL local (recomendado para desenvolver)

O projeto traz um PostgreSQL de verdade, sem Docker e sem instalação (pacote `embedded-postgres`). Os dados ficam em `.dados/postgres`, fora do Git.

1. No `.env`, defina `BANCO_LOCAL_SENHA` com uma senha longa e aponte `DATABASE_URL` e `DIRECT_URL` para `postgresql://rnc:ESSA_SENHA@localhost:54320/rnc` (há um exemplo no `.env.example`).
2. Suba o banco e o sistema juntos:

   ```bash
   npm run dev:local
   ```

3. Na primeira vez, em outro terminal, siga os passos 3 e 4 (`db:deploy` e `db:seed`).

Para subir só o banco: `npm run db:local`.

### Alternativa: Postgres local com Docker

Com o Docker Desktop instalado, defina `POSTGRES_PASSWORD` no `.env`, aponte `DATABASE_URL` e `DIRECT_URL` para `localhost:5432` (há um exemplo comentado no `.env.example`) e rode:

```bash
docker compose up -d
```

Depois siga do passo 3 em diante.

## Registro e lista

- Cada RNC recebe o código `RNC-AAMM-XXXX`, sequencial dentro do mês (horário de Brasília). Registros simultâneos nunca recebem o mesmo número.
- O tipo de problema aceita texto livre com sugestões. Quando coincide com uma categoria (sem diferenciar maiúsculas e acentos), a RNC fica vinculada a ela e usa a grafia oficial.
- O cliente é escolhido da lista ou digitado. Se ainda não existir no cadastro, é incluído ao registrar.
- LGPD: o formulário tem um aviso e recusa textos com CPF no formato `000.000.000-00`.
- Na lista, a busca e os filtros ficam no endereço da página, então dá para guardar ou compartilhar o link de um filtro.
- **Exportar CSV** (só a gestão): baixa exatamente o que a lista mostra, com os filtros e a busca aplicados. O arquivo abre direto no Excel: separador `;`, acentos corretos (UTF-8 com BOM), datas dd/mm/aaaa e valores com vírgula. Textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo na frente, para o Excel não executá-los como fórmula.

## Ciclo da RNC

- **Análise de causa:** 5 Porquês ou Ishikawa. Dá para salvar rascunho; para concluir, é preciso escrever a causa raiz.
- **Ação corretiva:** ação, responsável (alguém da equipe), prazo, aviso de atualizar POP/checklist/modelo e data da verificação (padrão: hoje + 30 dias).
- **Verificação de eficácia:** se for eficaz, a RNC é encerrada, e a evidência é obrigatória. Se for ineficaz, a RNC volta para a análise de causa num novo ciclo, com a análise em branco; a análise e a ação anteriores ficam visíveis em "Ciclos anteriores".
- Toda transição grava o histórico (texto, data, pessoa). A RNC fica travada durante a transição, então duas pessoas não a movem ao mesmo tempo.
- Quem pode fazer cada passo: [docs/perfis-e-permissoes.md](docs/perfis-e-permissoes.md).

## Notificações por e-mail

- **Ação atribuída:** sai na hora para quem recebe a ação.
- **Lembretes de prazo:** 3 dias antes e no dia, às 7h.
- **Verificação liberada:** para o líder do setor (sem líder, a gestão), às 7h.
- **Resumo semanal:** para a gestão, segunda às 8h.
- Os e-mails passam por uma fila no banco: se o Microsoft 365 falhar, o sistema tenta de novo e nenhum aviso sai duas vezes. A gestão acompanha tudo em **Administração → E-mails**, onde também dá para mandar um teste.
- **Desenvolvimento:** com `EMAIL_MODO="arquivo"`, os e-mails são gravados na pasta `.emails/` em vez de enviados.
- **Produção:** siga [docs/microsoft-365-envio.md](docs/microsoft-365-envio.md) para criar a caixa `rnc@conflex.com.br`, registrar o app no Entra ID e limitá-lo a essa caixa.
- As rotinas rodam pelo Vercel Cron (`vercel.json`), protegidas por `CRON_SECRET`.

## Administração (gestão)

O link **Administração** fica na barra do usuário, ao lado de "Alterar senha", e só aparece para a gestão da qualidade. Ela tem três abas, no padrão do e-LALUR:

- **Usuários:** em **+ Novo usuário**, o sistema gera uma senha provisória que aparece no quadro "Senhas provisórias para repassar", com Copiar e Copiar todas. A pessoa troca a senha no primeiro acesso. **Redefinir senha** gera outra senha provisória, invalida a anterior e encerra as sessões abertas da pessoa. Ninguém é apagado: quem sai da equipe é desativado e continua no histórico das RNCs.
- **Clientes:** cadastro dos clientes citados nas RNCs: nome, CNPJ (com validação, inclusive do CNPJ alfanumérico) e código no sistema contábil. Sem CPF (LGPD). O CNPJ também sai na exportação CSV. **Juntar com outro** corrige cadastros duplicados por erro de digitação: as RNCs passam para o cliente certo, cada uma com um registro no histórico.
- **E-mails:** acompanhamento dos avisos automáticos e envio de teste.

Após 5 senhas erradas seguidas, o acesso fica pausado por 15 minutos.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev:local` | Sobe o PostgreSQL local e o sistema em <http://localhost:3000> |
| `npm run dev` | Sobe só o sistema (com o banco já no ar ou no Neon) |
| `npm run build` | Gera a versão de produção (é o que a Vercel roda) |
| `npm test` | Roda os testes de unidade (regras do ciclo, indicadores, permissões, validações) |
| `npm run test:integracao:local` | Roda os testes de integração num PostgreSQL descartável |
| `npm run test:integracao` | Roda os testes de integração contra o banco de `TEST_DATABASE_URL` |
| `npm run typecheck` | Confere os tipos do TypeScript |

## Scripts do banco

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Cria uma nova migration a partir de mudanças no `schema.prisma` (só em desenvolvimento) |
| `npm run db:deploy` | Aplica as migrations pendentes (desenvolvimento e produção) |
| `npm run db:seed` | Cria setores, categorias e o usuário de gestão. Pode rodar mais de uma vez sem duplicar |
| `npm run db:check` | Testa as restrições e a proteção do histórico, sem gravar nada |
| `npm run db:studio` | Abre o Prisma Studio para ver os dados |

## Deploy (Vercel + Neon)

1. Crie no Neon o banco de produção, ou um branch `main` separado do de desenvolvimento.
2. Na Vercel, importe o repositório e cadastre as variáveis de ambiente de produção: `DATABASE_URL` (pooled), `DIRECT_URL` (direta), `EMAIL_DOMINIOS_PERMITIDOS`, `SESSAO_HORAS`, `APP_URL`, `CRON_SECRET` e as do e-mail (`EMAIL_MODO=graph`, `EMAIL_REMETENTE`, `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`). O `APP_URL` precisa ser o endereço oficial do sistema, para que os links de convite não dependam do endereço informado pelo navegador.
3. Aplique as migrations em produção antes de cada deploy que as altere:

   ```bash
   npm run db:deploy
   ```

4. Rode o seed uma vez, com um `SEED_GESTAO_SENHA` forte, e troque a senha no primeiro acesso.

**Backups:** o Neon guarda o histórico do banco e permite restaurar um ponto no tempo; o período depende do plano. Para a LGPD, recomenda-se também um `pg_dump` periódico guardado no SharePoint da Conflex. O passo a passo entra junto com o deploy.

## Segurança

- Senhas e chaves só em variáveis de ambiente, nunca no código. O `.env` está no `.gitignore`.
- Senhas de usuários são guardadas com hash Argon2id.
- A sessão fica num cookie `httpOnly`. O banco guarda só o hash do token da sessão e dos links de convite, então um vazamento do banco não dá acesso ao sistema.
- Trocar a senha encerra as sessões abertas em outros aparelhos.
- O histórico das RNCs não pode ser alterado nem apagado: o banco recusa essas operações.
