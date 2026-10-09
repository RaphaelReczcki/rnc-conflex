# Perfis e permissões

As regras estão em `src/lib/auth/permissoes.ts` e são cobertas por `tests/permissoes.test.ts`. A interface usa essas regras para mostrar ou esconder botões, e o servidor confere de novo antes de gravar.

**"Sob sua responsabilidade"** quer dizer: a pessoa registrou a RNC **ou** é a responsável pela ação corretiva do ciclo atual.

| O que | Colaborador | Líder de setor | Gestão |
|---|---|---|---|
| Ver painel e registros | todos | todos | todos |
| Registrar RNC | sim | sim | sim |
| Preencher análise de causa (rascunho) | se for sua | RNCs do seu setor | todas |
| **Concluir** análise de causa | não | RNCs do seu setor | todas |
| Preencher ação corretiva (rascunho) | se for sua | RNCs do seu setor | todas |
| **Concluir** ação corretiva | se for responsável pela ação | RNCs do seu setor | todas |
| Verificar eficácia | não | RNCs do seu setor | todas |
| Editar impacto (R$ e horas) | se for sua | RNCs do seu setor | todas |
| Administração: usuários, clientes e e-mails | não | não | sim |
| Exportar CSV | não | não | sim |

Uma pessoa desativada perde todo o acesso, inclusive às RNCs que registrou.

Se um setor não tiver líder, só a gestão conclui análises e verificações das RNCs desse setor.
