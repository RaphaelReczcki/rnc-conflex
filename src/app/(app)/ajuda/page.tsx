import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { ORIGENS, ORDEM_SEVERIDADE, SEVERIDADES } from "@/lib/rnc/dominio";
import { CAMPOS_ISHIKAWA, type CampoIshikawa } from "@/lib/rnc/ciclo";
import { SeloSeveridade } from "@/components/Rnc";

export const metadata: Metadata = { title: "Como preencher uma RNC" };

const SUMARIO = [
  ["o-que-e", "O que é uma RNC"],
  ["quando", "Quando registrar"],
  ["ciclo", "O ciclo, passo a passo"],
  ["registro", "1. Registro"],
  ["analise", "2. Análise de causa"],
  ["acao", "3. Ação corretiva"],
  ["verificacao", "4. Verificação de eficácia"],
  ["exemplo", "Exemplo completo"],
  ["lgpd", "Proteção de dados (LGPD)"],
  ["glossario", "Glossário"],
  ["duvidas", "Dúvidas frequentes"],
] as const;

const ORIGEM_EXPLICADA: Record<keyof typeof ORIGENS, string> = {
  erro_interno: "Algo no nosso processo falhou: um passo esquecido, uma conferência que não existe, um cálculo errado.",
  cliente: "O problema nasceu do lado do cliente: documento enviado atrasado ou incompleto, informação errada.",
  sistema_software: "Falha ou limitação de um sistema: erro do programa, parametrização, integração que não funcionou.",
  mudanca_legislacao: "Uma regra nova ou alterada que não foi incorporada a tempo ao processo.",
  fornecedor_terceiro: "Um parceiro externo falhou: banco, correspondente, empresa de software, prestador.",
  orgao_publico: "Instabilidade ou erro de portal ou órgão (Receita, prefeitura, junta comercial, eSocial).",
};

const PERGUNTAS_ISHIKAWA: Record<CampoIshikawa, string> = {
  ishMetodo: "O passo a passo (POP, checklist) prevê isso? Está claro? Está atualizado?",
  ishPessoas: "Quem fazia tinha treinamento, tempo e informação para fazer? A carga de trabalho estava razoável?",
  ishSistema: "O sistema estava configurado certo? Avisou? Tem alguma limitação que contribuiu?",
  ishCliente: "O cliente enviou tudo, no prazo e no formato combinado? O combinado estava claro para ele?",
  ishDocumentacao: "O modelo, a planilha ou o registro usado tinha falha? Faltava alguma informação guardada?",
  ishPrazo: "Feriado, fechamento acumulado, interrupções, mudança de calendário? O prazo era apertado demais?",
};

function Dica({ children }: { children: React.ReactNode }) {
  return <div className="dica">{children}</div>;
}

export default async function PaginaAjuda() {
  await exigirUsuario();
  return (
    <div className="ajuda-pagina">
      <aside className="ajuda-sumario" aria-label="Sumário">
        <strong>Neste guia</strong>
        <nav>
          {SUMARIO.map(([id, titulo]) => (
            <a key={id} href={`#${id}`}>
              {titulo}
            </a>
          ))}
        </nav>
        <Link href="/registrar" className="btn primary small" style={{ marginTop: 12 }}>
          + Registrar RNC
        </Link>
      </aside>

      <article className="ajuda-conteudo">
        <header className="titulo-pagina">
          <div>
            <h1>Como preencher uma RNC</h1>
            <p className="suave">Um guia curto, com os conceitos e exemplos do dia a dia do escritório.</p>
          </div>
        </header>

        <section id="o-que-e" className="card">
          <h2>O que é uma RNC</h2>
          <p>
            RNC é o <strong>Registro de Não Conformidade</strong>: a anotação de algo que saiu diferente do esperado, como um erro, um atraso ou uma
            falha de processo, para que o escritório descubra a causa e mude o processo, e assim o problema não volte.
          </p>
          <p>
            <strong>A RNC avalia o processo, não a pessoa.</strong> Quase sempre, quando alguém erra, o processo deixou espaço para o erro: faltou uma
            conferência, um aviso, um prazo folgado, uma instrução clara. Registrar é uma contribuição para a equipe, não uma confissão nem uma
            denúncia.
          </p>
          <Dica>
            Quanto mais RNCs registradas, mais o escritório aprende. Uma equipe que registra pouco não erra menos: só aprende menos.
          </Dica>
        </section>

        <section id="quando" className="card">
          <h2>Quando registrar</h2>
          <p>Registre assim que perceber, mesmo que o efeito já tenha sido corrigido. Alguns exemplos:</p>
          <ul>
            <li>Guia paga em atraso, com multa e juros, ou que quase atrasou.</li>
            <li>Obrigação acessória (SPED, DCTFWeb, EFD-Reinf, DIRF…) entregue fora do prazo ou com erro que exigiu retificação.</li>
            <li>Erro de cálculo na folha, lançamento contábil incorreto, classificação fiscal errada.</li>
            <li>Documento do cliente que chegou tarde e apertou o fechamento.</li>
            <li>Cadastro desatualizado, comunicação que gerou mal-entendido com o cliente.</li>
            <li>
              Uma oportunidade de melhoria: algo que não chegou a dar errado, mas poderia (severidade <SeloSeveridade severidade="baixa" />).
            </li>
          </ul>
          <p>
            <strong>Não é RNC:</strong> uma dúvida técnica, uma tarefa pendente dentro do prazo ou uma reclamação sobre uma pessoa. Se o problema se
            repete, ele é um ótimo candidato a RNC, mesmo que cada ocorrência pareça pequena.
          </p>
        </section>

        <section id="ciclo" className="card">
          <h2>O ciclo, passo a passo</h2>
          <ol className="ciclo-ajuda">
            <li>
              <strong>Registro:</strong> o que aconteceu, onde e quanto custou. Qualquer pessoa da equipe registra.
            </li>
            <li>
              <strong>Análise de causa:</strong> por que aconteceu, até chegar a algo que o processo possa mudar.
            </li>
            <li>
              <strong>Ação corretiva:</strong> a mudança no processo, com responsável e prazo.
            </li>
            <li>
              <strong>Verificação de eficácia:</strong> depois de um tempo, confere se o problema voltou. Se não voltou, a RNC é encerrada. Se voltou,
              ela retorna para a análise, e a análise e a ação anteriores ficam guardadas para consulta.
            </li>
          </ol>
          <p className="suave">
            Quem pode fazer cada passo depende do perfil: o líder do setor e a gestão concluem a análise e verificam a eficácia; o responsável pela
            ação a conclui.
          </p>
        </section>

        <section id="registro" className="card">
          <h2>1. Registro</h2>
          <dl className="campos-ajuda">
            <dt>Setor</dt>
            <dd>Onde o problema aconteceu, que nem sempre é o setor de quem percebeu.</dd>
            <dt>Data da ocorrência</dt>
            <dd>Quando o problema aconteceu (ex.: o dia do vencimento perdido), não necessariamente o dia em que foi percebido.</dd>
            <dt>Cliente afetado</dt>
            <dd>Deixe em branco se o problema é só interno. Escolha da lista para não criar o mesmo cliente com outro nome.</dd>
            <dt>Tipo de problema</dt>
            <dd>
              Escolha um da lista sempre que possível e use sempre o mesmo nome para o mesmo tipo. É assim que o painel encontra problemas que se
              repetem. Ex.: &quot;Guia paga em atraso&quot;, e não &quot;DARF atrasado&quot; numa vez e &quot;guia vencida&quot; na outra.
            </dd>
            <dt>Origem</dt>
            <dd>
              De onde o problema veio:
              <ul>
                {(Object.keys(ORIGENS) as (keyof typeof ORIGENS)[]).map((k) => (
                  <li key={k}>
                    <strong>{ORIGENS[k]}:</strong> {ORIGEM_EXPLICADA[k]}
                  </li>
                ))}
              </ul>
            </dd>
            <dt>Severidade</dt>
            <dd>
              Pelo efeito que o problema teve, ou teria se não fosse percebido:
              <table className="tabela" style={{ marginTop: 8 }}>
                <tbody>
                  {ORDEM_SEVERIDADE.map((k) => (
                    <tr key={k}>
                      <td style={{ width: 90 }}>
                        <SeloSeveridade severidade={k} />
                      </td>
                      <td>{SEVERIDADES[k].descricao}</td>
                      <td className="suave">
                        {
                          {
                            critica: "Ex.: multa por atraso de obrigação, autuação, perda de prazo de recurso.",
                            alta: "Ex.: retificar uma declaração, refazer a folha do mês.",
                            media: "Ex.: fechamento atrasou um dia, sem efeito para o cliente.",
                            baixa: "Ex.: um passo do checklist que poderia ser mais claro.",
                          }[k]
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </dd>
            <dt>O que aconteceu</dt>
            <dd>
              Os fatos: o quê, quando, qual obrigação ou documento, como foi percebido. Escreva para alguém que não estava lá entender. Evite nomes de
              pessoas e julgamentos (&quot;faltou atenção de fulano&quot;): descreva o que aconteceu, não quem errou.
            </dd>
            <dt>Correção imediata</dt>
            <dd>
              O que já foi feito para resolver o efeito, ou &quot;apagar o incêndio&quot;. Ex.: &quot;guia reemitida e paga com juros em 10/10&quot;. A
              correção resolve este caso; a ação corretiva, mais adiante, evita os próximos.
            </dd>
            <dt>Impacto</dt>
            <dd>Multas e juros em reais e horas de retrabalho. Pode ser preenchido ou corrigido depois, quando os valores forem conhecidos.</dd>
          </dl>
        </section>

        <section id="analise" className="card">
          <h2>2. Análise de causa</h2>
          <p>
            A <strong>causa raiz</strong> é o motivo mais profundo que o processo pode mudar. Se a causa raiz for resolvida, o problema não volta.
            Corrigir só o efeito (pagar a guia com juros) não impede que aconteça de novo no mês seguinte.
          </p>
          <Dica>
            &quot;Erro humano&quot;, &quot;falta de atenção&quot; e &quot;esquecimento&quot; não são causa raiz: são o ponto de partida. Pergunte de novo:
            por que o processo permitiu que a atenção fosse o único controle?
          </Dica>

          <h3>Método 5 Porquês: bom para a maioria dos casos</h3>
          <p>Comece pelo problema e pergunte &quot;por quê?&quot; sobre cada resposta, até chegar a algo que o processo possa mudar. Nem sempre são 5.</p>
          <ol className="porques-ajuda">
            <li>
              <em>Por que o DARF da DCTFWeb foi pago com atraso?</em> Porque foi agendado para o dia 20, o vencimento normal.
            </li>
            <li>
              <em>Por que o dia 20 não servia?</em> Porque o dia 20 foi feriado e, nesse caso, o vencimento é antecipado para o dia útil anterior (19).
            </li>
            <li>
              <em>Por que ninguém percebeu a antecipação?</em> Porque o calendário de vencimentos usado não traz os feriados municipais.
            </li>
            <li>
              <em>Por que não traz?</em> Porque o checklist de fechamento não tem o passo de conferir os feriados do mês.
            </li>
          </ol>
          <p>
            <strong>Causa raiz:</strong> o checklist de fechamento não prevê a conferência de vencimentos antecipados por feriado.
          </p>

          <h3>Método Ishikawa: para problemas que se repetem ou com várias causas</h3>
          <p>Também chamado de &quot;espinha de peixe&quot;. Olhe o problema por seis ângulos e anote o que contribuiu em cada um:</p>
          <table className="tabela">
            <tbody>
              {(Object.keys(CAMPOS_ISHIKAWA) as CampoIshikawa[]).map((c) => (
                <tr key={c}>
                  <td style={{ width: 160 }}>
                    <strong>{CAMPOS_ISHIKAWA[c].rotulo}</strong>
                  </td>
                  <td>{PERGUNTAS_ISHIKAWA[c]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="suave">
            Em &quot;Pessoas&quot;, olhe para as condições de trabalho (treinamento, carga, informação), nunca para culpados. Depois de preencher,
            escolha entre os fatores a causa mais importante e escreva-a como causa raiz.
          </p>
        </section>

        <section id="acao" className="card">
          <h2>3. Ação corretiva</h2>
          <p>
            A ação corretiva é <strong>a mudança no processo que ataca a causa raiz</strong>. Compare:
          </p>
          <table className="tabela">
            <thead>
              <tr>
                <th>Correção imediata</th>
                <th>Ação corretiva</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Resolve este caso.</td>
                <td>Evita os próximos.</td>
              </tr>
              <tr>
                <td>&quot;Guia reemitida e paga com juros.&quot;</td>
                <td>&quot;Incluir no checklist fiscal a conferência dos feriados do mês, com revisão do líder.&quot;</td>
              </tr>
            </tbody>
          </table>
          <h3>Uma boa ação corretiva</h3>
          <ul>
            <li>
              <strong>Muda algo concreto:</strong> um passo do POP, um item de checklist, um modelo, um aviso no sistema, um prazo combinado com o
              cliente.
            </li>
            <li>
              <strong>Tem um responsável</strong> (alguém da equipe) e um <strong>prazo</strong> realista.
            </li>
            <li>
              <strong>Dá para conferir</strong> depois: o checklist novo existe? Está sendo usado?
            </li>
          </ul>
          <Dica>
            Evite ações vagas como &quot;ter mais atenção&quot;, &quot;reforçar com a equipe&quot; ou &quot;tomar cuidado&quot;. Elas não mudam o
            processo, e o problema tende a voltar.
          </Dica>
          <p>
            Marque <strong>&quot;A ação exige atualizar um POP, checklist ou modelo&quot;</strong> sempre que a mudança precisar ficar escrita, para
            que quem chegar depois também a siga.
          </p>
          <p>
            <strong>Verificar a eficácia em:</strong> o sistema sugere 30 dias. Para obrigações mensais, escolha uma data depois do próximo vencimento,
            para dar tempo de a mudança ser posta à prova.
          </p>
        </section>

        <section id="verificacao" className="card">
          <h2>4. Verificação de eficácia</h2>
          <p>
            Na data marcada, o líder do setor ou a gestão confere: <strong>o problema voltou a acontecer desde a ação?</strong>
          </p>
          <ul>
            <li>
              <strong>Eficaz, o problema não voltou:</strong> a RNC é encerrada. Registre a evidência e o aprendizado. Ex.: &quot;três fechamentos sem
              atraso; checklist v2 publicado na pasta de procedimentos&quot;.
            </li>
            <li>
              <strong>Ineficaz, o problema voltou:</strong> a RNC volta para a análise de causa. Não é um fracasso: é sinal de que a primeira análise não
              enxergou tudo. A análise e a ação anteriores ficam guardadas, como ponto de partida.
            </li>
          </ul>
          <Dica>Prefira evidência que qualquer pessoa possa conferir (datas, quantidades, documentos) a impressões como &quot;parece que melhorou&quot;.</Dica>
        </section>

        <section id="exemplo" className="card">
          <h2>Exemplo completo</h2>
          <dl className="campos-ajuda">
            <dt>Registro</dt>
            <dd>
              Setor Fiscal · Cliente Padaria Exemplo · Tipo &quot;Guia paga em atraso&quot; · Origem Erro interno · Severidade <SeloSeveridade severidade="critica" />
              <br />
              <em>O que aconteceu:</em> o DARF da DCTFWeb (contribuições previdenciárias) de setembro vencia no dia 20/10, que foi feriado municipal; o
              vencimento foi antecipado para 19/10, mas o pagamento ficou agendado para o dia 20 e saiu com multa e juros. Percebido na conciliação
              do dia 21.
              <br />
              <em>Correção imediata:</em> diferença de juros calculada e informada ao cliente em 21/10. · Impacto: R$ 152,30 e 1,5 h.
            </dd>
            <dt>Análise (5 Porquês)</dt>
            <dd>Causa raiz: o checklist de fechamento fiscal não prevê a conferência de vencimentos antecipados por feriado.</dd>
            <dt>Ação corretiva</dt>
            <dd>
              Incluir no checklist fiscal o passo &quot;conferir feriados nacionais e municipais do mês e ajustar os agendamentos&quot;, com revisão do
              líder. Responsável: líder do Fiscal · Prazo: 31/10 · Exige atualizar checklist: sim · Verificar em: 15/12 (depois de dois vencimentos).
            </dd>
            <dt>Verificação</dt>
            <dd>Eficaz: novembro e dezembro sem atraso; checklist v2 em uso. RNC encerrada.</dd>
          </dl>
        </section>

        <section id="lgpd" className="card">
          <h2>Proteção de dados (LGPD)</h2>
          <p>
            Nos campos de texto, <strong>não registre</strong> CPF, dados bancários ou dados de saúde de funcionários dos clientes. Descreva o fato
            sem eles. Ex.: &quot;cálculo de adicional noturno de um empregado do setor de produção&quot; em vez do nome e do CPF da pessoa. O sistema
            recusa textos com CPF.
          </p>
        </section>

        <section id="glossario" className="card">
          <h2>Glossário</h2>
          <dl className="campos-ajuda">
            <dt>Não conformidade</dt>
            <dd>Algo que saiu diferente do combinado, do prazo ou da regra.</dd>
            <dt>Correção</dt>
            <dd>O que resolve o efeito do problema neste caso.</dd>
            <dt>Causa raiz</dt>
            <dd>O motivo mais profundo, que o processo pode mudar, sem o qual o problema não teria acontecido.</dd>
            <dt>Ação corretiva</dt>
            <dd>A mudança no processo que elimina a causa raiz e evita que o problema se repita.</dd>
            <dt>Eficácia</dt>
            <dd>A ação funcionou: o problema não voltou.</dd>
            <dt>Reincidência</dt>
            <dd>O mesmo tipo de problema, no mesmo setor, acontecendo de novo. Aparece no painel.</dd>
            <dt>POP</dt>
            <dd>Procedimento Operacional Padrão: o passo a passo escrito de uma rotina.</dd>
          </dl>
        </section>

        <section id="duvidas" className="card">
          <h2>Dúvidas frequentes</h2>
          <dl className="campos-ajuda">
            <dt>Errei e percebi sozinho. Preciso registrar?</dt>
            <dd>Sim, e é o melhor caso: o processo melhora antes de o problema chegar ao cliente. O registro não aponta culpados.</dd>
            <dt>Não sei a severidade certa.</dt>
            <dd>Escolha pelo efeito que o problema teve ou teria. Na dúvida entre duas, use a maior; o líder pode conversar sobre isso na análise.</dd>
            <dt>O problema foi do cliente. Ainda é RNC?</dt>
            <dd>
              Sim, com origem &quot;Cliente&quot;. Esses registros ajudam a conversar com o cliente sobre prazos e documentos, e a ação pode ser um
              lembrete, um combinado ou um modelo novo.
            </dd>
            <dt>Não consigo concluir a análise.</dt>
            <dd>Salve o rascunho. Quem conclui é o líder do setor ou a gestão da qualidade.</dd>
            <dt>Mais de um setor teve parte no problema.</dt>
            <dd>Registre no setor onde o problema apareceu e cite os outros no texto. A análise pode envolver todos.</dd>
          </dl>
        </section>
      </article>
    </div>
  );
}
