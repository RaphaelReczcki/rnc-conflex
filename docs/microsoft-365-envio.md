# Envio de e-mails pelo Microsoft 365

O sistema envia os avisos pela API do Microsoft Graph, como a caixa **rnc@conflex.com.br**. O app registrado no Entra ID só consegue enviar como essa caixa, e não como qualquer pessoa do escritório.

Você vai precisar de uma conta de **administrador global** (ou de Exchange + aplicativos) do Microsoft 365 da Conflex. Leva uns 20 minutos.

## 1. Criar a caixa compartilhada

1. Abra o **Centro de administração do Exchange**: <https://admin.exchange.microsoft.com>.
2. **Destinatários → Caixas de correio → Adicionar uma caixa de correio compartilhada**.
3. Nome de exibição: `RNC Conflex`. Endereço: `rnc@conflex.com.br`.
4. Salve. Caixa compartilhada não ocupa licença.

Opcional: dê acesso de leitura à gestão da qualidade, para ver os itens enviados e as respostas que chegarem.

## 2. Registrar o aplicativo no Entra ID

1. Abra <https://entra.microsoft.com> → **Aplicativos → Registros de aplicativo → Novo registro**.
2. Nome: `RNC Conflex - envio de e-mail`. Tipo de conta: **somente este diretório**. Não precisa de URI de redirecionamento. Clique em **Registrar**.
3. Na tela do app, anote:
   - **ID do aplicativo (cliente)** → vai em `M365_CLIENT_ID`
   - **ID do diretório (locatário)** → vai em `M365_TENANT_ID`
4. **Certificados e segredos → Novo segredo do cliente**. Descrição `RNC produção`, validade de 24 meses. Copie o **Valor** na hora (ele não aparece de novo) → vai em `M365_CLIENT_SECRET`.
5. Anote a data de vencimento do segredo na agenda. Antes dela, gere um novo e troque na Vercel.

**Não** adicione a permissão `Mail.Send` em "Permissões de API". Ela daria ao app o poder de enviar como qualquer caixa da empresa. A permissão vai ser dada no passo 3, limitada à caixa do RNC.

## 3. Limitar o app à caixa rnc@conflex.com.br (Exchange Online)

1. Em <https://entra.microsoft.com> → **Aplicativos → Aplicativos empresariais**, abra `RNC Conflex - envio de e-mail` e anote o **ID do objeto** dessa tela. Ele é diferente do ID do objeto que aparece em "Registros de aplicativo".
2. No PowerShell do Windows, como administrador:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
Connect-ExchangeOnline
```

3. Registre o app no Exchange e dê a permissão de envio **só** para a caixa do RNC. Troque `<ID-do-aplicativo>` e `<ID-do-objeto-do-aplicativo-empresarial>` pelos valores anotados:

```powershell
New-ServicePrincipal -AppId <ID-do-aplicativo> -ObjectId <ID-do-objeto-do-aplicativo-empresarial> -DisplayName "RNC Conflex"

New-ManagementScope -Name "RNC - caixa de envio" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'rnc@conflex.com.br'"

New-ManagementRoleAssignment -App <ID-do-aplicativo> -Role "Application Mail.Send" -CustomResourceScope "RNC - caixa de envio"
```

4. Confira. Deve aparecer `InScope: True` para a caixa do RNC e `False` para qualquer outra:

```powershell
Test-ServicePrincipalAuthorization -Identity <ID-do-aplicativo> -Resource rnc@conflex.com.br
Test-ServicePrincipalAuthorization -Identity <ID-do-aplicativo> -Resource seu.email@conflex.com.br
```

A permissão pode levar de 30 minutos a 2 horas para valer.

## 4. Configurar o sistema

No `.env` (desenvolvimento) ou em **Vercel → Settings → Environment Variables** (produção):

| Variável | Valor |
|---|---|
| `EMAIL_MODO` | `graph` |
| `EMAIL_REMETENTE` | `rnc@conflex.com.br` |
| `M365_TENANT_ID` | ID do diretório (passo 2) |
| `M365_CLIENT_ID` | ID do aplicativo (passo 2) |
| `M365_CLIENT_SECRET` | Valor do segredo (passo 2) |
| `APP_URL` | Endereço oficial do sistema, usado nos links dos e-mails |
| `CRON_SECRET` | Texto longo e aleatório (veja abaixo) |

Para gerar o `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

O segredo do cliente e o `CRON_SECRET` nunca vão para o código nem para o Git.

## 5. Testar

1. Entre no sistema com um usuário da gestão → **Administração → E-mails**.
2. O quadro "Modo de envio" deve mostrar **Microsoft 365, enviando como rnc@conflex.com.br**.
3. Clique em **Enviar um e-mail de teste para mim**. Se falhar, o motivo aparece na lista:
   - `HTTP 401` na autenticação: confira tenant, client id e segredo.
   - `HTTP 403, ErrorAccessDenied`: a permissão do passo 3 ainda não valeu ou o escopo está errado. Espere e rode o `Test-ServicePrincipalAuthorization` de novo.

## Quando cada e-mail sai

| Aviso | Para quem | Quando |
|---|---|---|
| Ação atribuída | Responsável pela ação | Na hora em que é escolhido (não avisa quem escolheu a si mesmo) |
| Prazo em 3 dias | Responsável pela ação | Rotina diária, 7h |
| Prazo hoje | Responsável pela ação | Rotina diária, 7h |
| Verificação liberada | Líderes do setor (sem líder: a gestão) | Rotina diária, 7h, quando chega a data prevista |
| Resumo semanal | Gestão da qualidade | Segunda-feira, 8h |

As rotinas rodam pelo **Vercel Cron** (`vercel.json`), que chama `/api/cron/diario` e `/api/cron/resumo` com o `CRON_SECRET`. Os horários no arquivo estão em UTC: 10h e 11h UTC equivalem a 7h e 8h em Brasília.

Se o Microsoft 365 estiver fora do ar, o e-mail fica na fila e o sistema tenta de novo: 5 minutos depois, 10, 20, e assim por diante, até 6 tentativas. Nenhum aviso sai duas vezes.
