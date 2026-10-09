# Perfis e permissões

As regras estão em `src/lib/auth/permissoes.ts` e são cobertas por `tests/permissoes.test.ts`. A interface usa essas regras para mostrar ou esconder botões, e o servidor confere de novo antes de gravar.

**"Sob sua responsabilidade"** quer dizer: a pessoa registrou a RNC **ou** é a responsável pela ação corretiva do ciclo atual.

## Quem vê quais RNCs

Regra em `src/lib/rnc/escopo.ts` (testes em `tests/escopo.test.ts` e `tests/integracao/visibilidade.test.ts`). Vale para a lista de registros, o painel e a página da RNC.

- **Colaborador:** só as dele, ou seja, as que registrou e as que têm ação corretiva dele (de qualquer ciclo).
- **Líder de setor:** todas do seu setor, mais as das pessoas das equipes que lidera (registradas por elas ou com ação delas), mesmo em outro setor, mais as próprias.
- **Gestão:** todas.

As **equipes** são cadastradas em Administração → Equipes, cada uma com um líder (perfil Líder de setor ou Gestão). Cada pessoa fica em uma equipe, escolhida em Usuários → Editar. Equipe inativa deixa de valer para a visibilidade. Ver uma RNC não dá direito de preenchê-la: quem preenche e conclui cada etapa segue a tabela abaixo. Por exemplo, o líder vê a RNC de alguém da equipe registrada em outro setor, mas quem trata é o líder daquele setor.

## Quem faz o quê

| O que | Colaborador | Líder de setor | Gestão |
|---|---|---|---|
| Ver painel e registros | só as dele | setor + equipe | todos |
| Registrar RNC | sim | sim | sim |
| Preencher análise de causa (rascunho) | se for sua | RNCs do seu setor | todas |
| **Concluir** análise de causa | não | RNCs do seu setor | todas |
| Preencher ação corretiva (rascunho) | se for sua | RNCs do seu setor | todas |
| **Concluir** ação corretiva | se for responsável pela ação | RNCs do seu setor | todas |
| Verificar eficácia | não | RNCs do seu setor | todas |
| Editar impacto (R$ e horas) | se for sua | RNCs do seu setor | todas |
| Administração: usuários, equipes, clientes e e-mails | não | não | sim |
| Exportar CSV | não | não | sim |

Uma pessoa desativada perde todo o acesso, inclusive às RNCs que registrou.

Se um setor não tiver líder, só a gestão conclui análises e verificações das RNCs desse setor.
