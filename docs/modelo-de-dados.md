# Modelo de dados

PostgreSQL, gerenciado pelo Prisma (`prisma/schema.prisma`). Nomes de tabelas e colunas em português, `snake_case` no banco.

```mermaid
erDiagram
    setores ||--o{ usuarios : "lota"
    setores ||--o{ rncs : "classifica"
    categorias |o--o{ rncs : "sugere o tipo"
    clientes |o--o{ rncs : "afetado em"
    usuarios ||--o{ rncs : "registra"

    rncs ||--o{ analises : "1 por ciclo"
    rncs ||--o{ acoes_corretivas : "1 por ciclo"
    rncs ||--o{ verificacoes : "1 por ciclo"
    acoes_corretivas ||--o| verificacoes : "é verificada por"
    rncs ||--o{ historico : "registra eventos"
    rncs ||--o{ anexos : "tem"

    usuarios |o--o{ acoes_corretivas : "responsável"
    usuarios ||--o{ verificacoes : "verifica"
    usuarios |o--o{ historico : "autor do evento"
    usuarios ||--o{ anexos : "envia"
    usuarios ||--o{ equipes : "lidera"
    equipes |o--o{ usuarios : "agrupa"

    equipes {
        uuid id PK
        varchar nome UK
        uuid lider_id FK "líder de setor ou gestão"
        bool ativo
    }
    usuarios {
        uuid id PK
        varchar nome
        varchar email UK "minúsculas"
        text senha_hash "Argon2id"
        perfil perfil "colaborador | lider_setor | gestao"
        uuid setor_id FK "obrigatório p/ líder"
        uuid equipe_id FK "opcional"
        bool ativo
    }
    setores {
        uuid id PK
        varchar nome UK
        int ordem
        bool ativo
    }
    categorias {
        uuid id PK
        varchar nome
        varchar nome_normalizado UK
        bool ativo
    }
    clientes {
        uuid id PK
        varchar nome
        varchar codigo_interno UK
        bool ativo
    }
    rncs {
        uuid id PK
        varchar codigo UK "RNC-AAAA-NNNN"
        date data_ocorrencia
        uuid setor_id FK
        uuid cliente_id FK
        uuid categoria_id FK
        varchar tipo_problema
        varchar tipo_problema_norm
        origem origem
        severidade severidade
        text descricao
        text correcao_imediata
        decimal multas_juros "R$, >= 0"
        decimal horas_retrabalho ">= 0"
        status_rnc status "analise | acao | verificacao | encerrada"
        int reaberturas
        uuid autor_id FK
        timestamptz criada_em
        timestamptz encerrada_em "só se encerrada"
    }
    rnc_contadores {
        char ano PK "AAAA"
        int ultimo
    }
    analises {
        uuid id PK
        uuid rnc_id FK
        int ciclo
        metodo_analise metodo
        text porque_1_a_5
        text ish_6_categorias
        text causa_raiz "obrigatória p/ concluir"
        timestamptz concluida_em
    }
    acoes_corretivas {
        uuid id PK
        uuid rnc_id FK
        int ciclo
        text descricao
        uuid responsavel_id FK
        date prazo
        bool exige_atualizar_documento
        date verificar_em
        timestamptz concluida_em
    }
    verificacoes {
        uuid id PK
        uuid rnc_id FK
        int ciclo
        uuid acao_id FK
        resultado_verificacao resultado "eficaz | ineficaz"
        text evidencia
        uuid verificado_por_id FK
    }
    historico {
        bigint id PK
        uuid rnc_id FK
        tipo_evento tipo
        text texto
        status_rnc status_anterior
        status_rnc status_novo
        int ciclo
        uuid usuario_id FK
        jsonb dados
        timestamptz criado_em
    }
    anexos {
        uuid id PK
        uuid rnc_id FK
        etapa_anexo etapa
        varchar nome_arquivo
        int tamanho_bytes
        varchar armazenamento
        varchar chave
        timestamptz removido_em
    }
```

## Ciclos e reabertura

Cada passagem por análise → ação → verificação é um **ciclo** (`ciclo = reaberturas + 1`). `analises`, `acoes_corretivas` e `verificacoes` têm uma linha por ciclo (`UNIQUE (rnc_id, ciclo)`).

Quando a verificação é **ineficaz**, a RNC volta para `analise`, `reaberturas` aumenta em 1 e começa um novo ciclo com análise em branco. A causa raiz e a ação do ciclo anterior continuam gravadas.

## Regras garantidas pelo banco

| Regra | Como |
|---|---|
| Status, severidade, origem, perfil, método e resultado válidos | ENUMs do PostgreSQL |
| `encerrada` ⇔ `encerrada_em` preenchida | CHECK `rncs_encerramento_ck` |
| Código no formato `RNC-AAAA-NNNN` | CHECK `rncs_codigo_formato_ck` |
| Multas, horas e reaberturas não negativas | CHECKs em `rncs` |
| Análise só conclui com causa raiz | CHECK `analises_conclusao_ck` |
| Ação só conclui com descrição, responsável e data de verificação | CHECK `acoes_corretivas_conclusao_ck` |
| Líder de setor precisa ter setor | CHECK `usuarios_lider_tem_setor_ck` |
| Histórico só aceita INSERT | Trigger `historico_somente_insercao` (bloqueia UPDATE, DELETE e TRUNCATE) |
| RNC com histórico não pode ser apagada | FK `ON DELETE RESTRICT` |

A ordem das transições (análise → ação → verificação → encerrada, ou de volta à análise) envolve mais de uma tabela. Ela é garantida na camada de serviço da aplicação e coberta por testes automatizados (etapa 4).

`npm run db:check` confere todas essas regras contra o banco configurado no `.env`.

## Índices para lista e painel

- `rncs`: `status`; `(setor_id, status)`; `(severidade, status)`; `criada_em DESC`; `encerrada_em`; `data_ocorrencia`; `(setor_id, tipo_problema_norm, criada_em)` para reincidência e problemas recorrentes; `cliente_id`; `autor_id`.
- `acoes_corretivas`: `(concluida_em, prazo)` para prazos vencidos e lembretes; `verificar_em` para verificações liberadas; `(responsavel_id, concluida_em)` para "minhas ações".
- `historico`: `(rnc_id, criado_em)`.
