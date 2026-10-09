# Colocar o sistema na nuvem (Railway)

O sistema roda no **Railway**: um serviço com a aplicação (Next.js) e um banco **PostgreSQL**, no mesmo projeto. O código fica num repositório **privado** no GitHub; cada atualização enviada para a branch `master` gera um deploy automático.

## O que já está pronto no código

- `npm start` aplica as migrations do banco (`prisma migrate deploy`) e sobe o sistema. O Railway detecta o projeto Node.js e usa `npm run build` e `npm start` sozinho, sem arquivo de configuração.
- As rotinas de e-mail (diária às 7h e resumo de segunda às 8h, horário de Brasília) rodam **dentro do próprio sistema**, sem cron externo. Se o servidor reiniciar depois do horário, a rotina roda quando ele voltar, e nenhum aviso sai duas vezes.
- `/api/saude` responde se o sistema e o banco estão no ar.
- `scripts/migrar-para-nuvem.mjs` leva a equipe e os cadastros do banco local para o da nuvem.

## Passo a passo

### 1. Repositório no GitHub

1. Em <https://github.com/new>, crie um repositório **privado** chamado `rnc-conflex`, **vazio** (sem README, sem .gitignore).
2. Envie o código (feito pelo Claude, com o seu login do GitHub):

   ```bash
   git remote add origin https://github.com/SEU-USUARIO/rnc-conflex.git
   git push -u origin master
   ```

### 2. Projeto no Railway

1. Entre em <https://railway.com> com a conta do GitHub.
2. **New Project → Deploy from GitHub repo → rnc-conflex.** Autorize o Railway a ver só esse repositório.
3. No mesmo projeto: **+ Create → Database → PostgreSQL.**
4. No serviço da aplicação, em **Settings → Region**, escolha a região mais próxima do Brasil disponível.

### 3. Variáveis do serviço da aplicação

Em **Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
| `DIRECT_URL` | `${{Postgres.DATABASE_URL}}` |
| `APP_URL` | `https://rnc.conflex.com.br` |
| `EMAIL_DOMINIOS_PERMITIDOS` | `conflex.com.br` |
| `SESSAO_HORAS` | `12` |
| `EMAIL_MODO` | `desligado` até o Microsoft 365 ser configurado; depois `graph` |
| `EMAIL_REMETENTE` | `rnc@conflex.com.br` |
| `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET` | Do registro no Entra ID (veja [microsoft-365-envio.md](microsoft-365-envio.md)) |
| `CRON_SECRET` | Texto longo e aleatório (opcional: protege as rotas `/api/cron/*`, para disparo manual) |

Senhas e segredos ficam só no Railway, nunca no código.

### 4. Levar a equipe e os cadastros

1. No serviço **Postgres** do Railway, em **Variables**, copie o valor de `DATABASE_PUBLIC_URL`.
2. No `.env` local, adicione `NUVEM_DATABASE_URL="<o valor copiado>"`.
3. Rode:

   ```bash
   node scripts/migrar-para-nuvem.mjs
   ```

   O script aplica as migrations na nuvem e copia setores, categorias, clientes e usuários, com perfil, setor e senha. Pode rodar mais de uma vez: o que já existe na nuvem é mantido. RNCs, sessões e e-mails não são copiados.
4. Depois, apague a linha `NUVEM_DATABASE_URL` do `.env`.

### 5. Endereço rnc.conflex.com.br

1. No serviço da aplicação: **Settings → Networking → Custom Domain → `rnc.conflex.com.br`**, com a porta indicada pelo Railway.
2. O Railway mostra um registro **CNAME** (e às vezes um TXT de verificação). Quem administra o DNS da `conflex.com.br` cria esse registro.
3. O certificado HTTPS é emitido automaticamente quando o DNS propagar (minutos a algumas horas).

### 6. Conferir

- `https://rnc.conflex.com.br/api/saude` deve responder `{"ok":true}`.
- Entre com a sua conta. Em **Administração → Usuários**, a equipe deve estar lá.
- Em **Administração → E-mails**, o modo de envio aparece. Com o M365 configurado, mande um e-mail de teste.

## Atualizações

Cada `git push` para a `master` gera um deploy novo. Se algo der errado, use **Deployments → Redeploy** numa versão anterior.

## Backups

No serviço **Postgres**, ative os **Backups** do Railway (diários). Para a LGPD, guarde de tempos em tempos uma cópia fora do Railway, por exemplo um `pg_dump` salvo no SharePoint da Conflex.
