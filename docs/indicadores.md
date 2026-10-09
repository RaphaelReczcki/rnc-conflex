# Indicadores do painel

O cálculo está em `src/lib/painel/indicadores.ts` e é coberto por `tests/indicadores.test.ts`. Datas e meses seguem o horário de Brasília.

**Período** (filtro do painel): últimos 12 meses (padrão), 6 meses, 3 meses, este ano ou ano passado. "Últimos 12 meses" começa à meia-noite do mesmo dia, um ano atrás. **Setor** (filtro): todos ou um só. Todos os números respeitam o filtro de setor.

| Indicador | Como é calculado |
|---|---|
| Etapas do ciclo (análise, ação, verificação) | RNCs em aberto **agora** em cada etapa, sem depender do período |
| Encerradas | RNCs encerradas **dentro do período** (pela data de encerramento) |
| Pedem atenção agora | RNCs distintas com: ação cujo prazo já passou (o próprio dia do prazo ainda não conta); verificação com data prevista hoje ou antes; ou severidade crítica ainda na análise de causa |
| Tempo médio até encerrar | Média, em dias, de (data de encerramento − data de registro) das RNCs encerradas no período. Fica "—" se nenhuma foi encerrada |
| Reincidência | % das RNCs registradas no período cujo par (setor, tipo de problema normalizado) aparece mais de uma vez no período |
| Com origem no cliente | % das RNCs registradas no período com origem "Cliente" |
| Multas e juros, horas de retrabalho | Soma das RNCs registradas no período |
| Por setor e severidade, por origem | Contagem das RNCs registradas no período |
| Registros por mês | Os 6 meses que terminam no mês final do período, contados pela data de registro |
| Problemas que se repetem | Pares (setor, tipo normalizado) com 2 ou mais registros nos 180 dias que terminam no fim do período, do mais frequente ao menos |
| Voltou para a análise | Soma das verificações ineficazes das RNCs registradas no período |

Tipo normalizado: minúsculas, sem acentos e sem espaços nas pontas. "Guia paga em atraso" e "guia  paga em atraso" contam como o mesmo tipo.

Depois de uma reabertura, só a ação do ciclo atual conta para prazo e verificação.

## Cores dos gráficos

As cores dos selos de severidade são as do protótipo. As barras dos gráficos usam tons próprios das mesmas famílias, validados para quem tem daltonismo (separação de cores e luminosidade), um conjunto para o tema claro e outro para o escuro (`--g-*` em `globals.css`). Como um dos tons fica abaixo de 3:1 de contraste com o fundo, cada barra tem o número ao lado e há a opção "Ver em tabela".
