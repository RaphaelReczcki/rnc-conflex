import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth/sessao";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { ORDEM_SEVERIDADE, SEVERIDADES } from "@/lib/rnc/dominio";
import { calcularIndicadores, periodoDe, type ItemAtencao } from "@/lib/painel/indicadores";
import { carregarLinhasPainel } from "@/lib/painel/carregar";
import { escopoDoUsuario } from "@/lib/rnc/escopo-servidor";
import { FiltrosPainel } from "./FiltrosPainel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOTIVO: Record<ItemAtencao["motivo"], (data: string | null) => string> = {
  prazo: (d) => `Prazo era ${formatarData(d)}`,
  verificacao: (d) => `Verificar desde ${formatarData(d)}`,
  critica: () => "Crítica sem análise",
};

export default async function Painel({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirUsuario();
  // Painel com as RNCs que esta pessoa pode ver
  const escopo = await escopoDoUsuario(usuario);
  const params = await searchParams;
  const agora = new Date();
  const periodo = periodoDe(params.periodo, agora);
  const setorFiltro = params.setor && UUID.test(params.setor) ? params.setor : "";

  const [setores, existeAlguma] = await Promise.all([
    prisma.setor.findMany({ orderBy: [{ ativo: "desc" }, { ordem: "asc" }], select: { id: true, nome: true, ativo: true } }),
    prisma.rnc.count({ where: escopo, take: 1 }),
  ]);

  if (!existeAlguma) {
    return (
      <section className="cycle">
        <h2>Nenhuma não conformidade registrada ainda</h2>
        <p className="sub">
          Quando alguém da equipe perceber um erro, atraso ou falha de processo, o registro começa aqui. O painel se monta sozinho a partir
          dos registros.
        </p>
        <Link href="/registrar" className="btn primary">
          Registrar a primeira RNC
        </Link>
      </section>
    );
  }

  const linhas = await carregarLinhasPainel(periodo, setorFiltro || undefined, escopo);

  const setoresGrafico = setores.filter((s) => (setorFiltro ? s.id === setorFiltro : s.ativo || linhas.some((l) => l.setorId === s.id)));
  const I = calcularIndicadores(linhas, { agora, periodo, setores: setoresGrafico });

  const qsSetor = setorFiltro ? `&setor=${setorFiltro}` : "";
  const estacoes = [
    { k: "analise", nome: "Análise de causa", dica: "Registradas, sem causa raiz" },
    { k: "acao", nome: "Ação corretiva", dica: I.atencao.filter((a) => a.motivo === "prazo").length ? `${I.atencao.filter((a) => a.motivo === "prazo").length} com prazo vencido` : "Em andamento" },
    { k: "verificacao", nome: "Verificação", dica: I.atencao.filter((a) => a.motivo === "verificacao").length ? `${I.atencao.filter((a) => a.motivo === "verificacao").length} já podem ser verificadas` : "Aguardando o prazo de checagem" },
    { k: "encerrada", nome: "Encerradas", dica: `Eficazes, ${periodo.rotulo.toLowerCase()}` },
  ] as const;
  const maxSetor = Math.max(1, ...I.porSetor.map((s) => s.total));
  const maxOrigem = Math.max(1, ...I.porOrigem.map((o) => o.total));
  const maxMes = Math.max(1, ...I.meses.map((m) => m.total));
  const intervalo = `${formatarData(periodo.inicio)} a ${formatarData(new Date(+periodo.fim - 1))}`;
  const vazioPeriodo = I.totalNoPeriodo === 0;

  return (
    <>
      <FiltrosPainel
        setor={setorFiltro}
        periodo={periodo.chave}
        setores={setores.filter((s) => s.ativo || s.id === setorFiltro).map(({ id, nome }) => ({ id, nome }))}
        intervalo={intervalo}
      />

      <section className="cycle" aria-labelledby="ct">
        <h2 id="ct">Onde as RNCs estão no ciclo</h2>
        <p className="sub">
          {I.abertas} em aberto{setorFiltro ? ` em ${setores.find((s) => s.id === setorFiltro)?.nome}` : ""}. Toque numa etapa para ver os registros
          dela.
        </p>
        <div className="stations">
          {estacoes.map((s) => (
            <Link key={s.k} href={`/registros?etapa=${s.k}${qsSetor}`} className={`station ${s.k === "encerrada" ? "done" : ""}`}>
              <span className="rail" />
              <span className="count">{I.porEtapa[s.k]}</span>
              <span className="name">{s.nome}</span>
              <span className="hint">{s.dica}</span>
            </Link>
          ))}
        </div>
        <p className="loopback">
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
            <path d="M16 2v4a3 3 0 0 1-3 3H4m0 0 3-3M4 9l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Quando a verificação mostra que o problema voltou, a RNC retorna para a análise de causa
          {I.reaberturas ? `. No período, isso aconteceu ${I.reaberturas} ${I.reaberturas === 1 ? "vez" : "vezes"}.` : "."}
        </p>
      </section>

      <section className="kpis" aria-label={`Indicadores: ${periodo.rotulo.toLowerCase()}`}>
        <div className={`kpi ${I.pedemAtencao ? "alert" : ""}`}>
          <div className="v">{I.pedemAtencao}</div>
          <div className="l">Pedem atenção agora</div>
        </div>
        <div className="kpi">
          <div className="v">{I.tempoMedioDias == null ? "—" : `${I.tempoMedioDias} ${I.tempoMedioDias === 1 ? "dia" : "dias"}`}</div>
          <div className="l">Tempo médio até encerrar</div>
        </div>
        <div className="kpi">
          <div className="v">{I.reincidencia == null ? "—" : `${I.reincidencia}%`}</div>
          <div className="l">Reincidência (mesmo tipo e setor)</div>
        </div>
        <div className="kpi">
          <div className="v">{I.origemCliente == null ? "—" : `${I.origemCliente}%`}</div>
          <div className="l">Com origem no cliente</div>
        </div>
        <div className="kpi">
          <div className="v">{formatarMoeda(I.custo.multas)}</div>
          <div className="l">
            Multas e juros
            {I.custo.horas ? `, mais ${I.custo.horas.toLocaleString("pt-BR")} h de retrabalho` : ""}
          </div>
        </div>
      </section>

      <div className="grid2">
        <section className="panel">
          <h3>Pedem atenção</h3>
          <p className="sub">Prazos vencidos, verificações liberadas e críticas sem análise</p>
          {I.atencao.length ? (
            <ul className="attn">
              {I.atencao.slice(0, 8).map((a) => (
                <li key={`${a.codigo}-${a.motivo}`}>
                  <Link href={`/rncs/${a.codigo}`}>
                    <span className="code">{a.codigo}</span>
                    <span className="t">{a.tipoProblema.slice(0, 70)}</span>
                    <span className={`d ${a.motivo === "verificacao" ? "info" : ""}`}>{MOTIVO[a.motivo](a.data)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nada atrasado. Tudo dentro do prazo.</p>
          )}
          {I.atencao.length > 8 && <p className="ajuda">E mais {I.atencao.length - 8}. Veja todos em Registros.</p>}
        </section>

        <section className="panel">
          <h3>Registros por mês</h3>
          <p className="sub">6 meses até {I.meses[5].rotulo}/{I.meses[5].ano}</p>
          <div className="months" role="img" aria-label={`Registros por mês: ${I.meses.map((m) => `${m.rotulo} ${m.total}`).join(", ")}`}>
            {I.meses.map((m) => (
              <div className="month" key={m.chave}>
                <span className="c">{m.total}</span>
                <div className={`bar ${m.total ? "" : "zero"}`} style={{ height: `${Math.max(2, Math.round((100 * m.total) / maxMes))}%` }} data-dica={`${m.rotulo}/${m.ano}: ${m.total}`} />
                <span className="m">{m.rotulo}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid2">
        <section className="panel">
          <h3>Por setor e severidade</h3>
          <p className="sub">{vazioPeriodo ? "Nenhuma RNC registrada no período." : periodo.rotulo}</p>
          {I.porSetor.map((s) => (
            <div className="hbar" key={s.setorId}>
              <span className="rot" title={s.nome}>
                {s.nome}
              </span>
              <span className="track">
                {ORDEM_SEVERIDADE.map((k) =>
                  s[k] ? (
                    <span key={k} className={`seg seg-${k}`} style={{ width: `${(100 * s[k]) / maxSetor}%` }} data-dica={`${SEVERIDADES[k].rotulo}: ${s[k]}`} />
                  ) : null,
                )}
                <span className="fundo" />
              </span>
              <span className="n">{s.total}</span>
            </div>
          ))}
          <div className="legend">
            {ORDEM_SEVERIDADE.map((k) => (
              <span key={k}>
                <i className={`seg-${k}`} />
                {SEVERIDADES[k].rotulo}
              </span>
            ))}
          </div>
          <details className="ver-tabela">
            <summary>Ver em tabela</summary>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Setor</th>
                  {ORDEM_SEVERIDADE.map((k) => (
                    <th key={k}>{SEVERIDADES[k].rotulo}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {I.porSetor.map((s) => (
                  <tr key={s.setorId}>
                    <td>{s.nome}</td>
                    {ORDEM_SEVERIDADE.map((k) => (
                      <td key={k}>{s[k]}</td>
                    ))}
                    <td>{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section className="panel">
          <h3>Por origem</h3>
          <p className="sub">{periodo.rotulo}. Origem no cliente ajuda a conversar sobre prazos de envio.</p>
          {I.porOrigem.map((o) => (
            <div className="hbar" key={o.origem}>
              <span className="rot">{o.rotulo}</span>
              <span className="track">
                {o.total ? <span className="seg seg-marca" style={{ width: `${(100 * o.total) / maxOrigem}%` }} data-dica={`${o.rotulo}: ${o.total}`} /> : null}
                <span className="fundo" />
              </span>
              <span className="n">{o.total}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="panel">
        <h3>Problemas que se repetem</h3>
        <p className="sub">
          Mesmo tipo de problema no mesmo setor, mais de uma vez nos últimos 180 dias. São os melhores candidatos a mudar um POP ou checklist.
        </p>
        {I.recorrentes.length ? (
          I.recorrentes.slice(0, 8).map((x) => (
            <div className="hbar" key={`${x.setor}-${x.tipoProblema}`}>
              <span className="rot">{x.setor}</span>
              <span className="rot">{x.tipoProblema}</span>
              <span className="n">{x.total}×</span>
            </div>
          ))
        ) : (
          <p className="empty">Nenhuma repetição detectada. Preencher o tipo de problema de forma padronizada deixa esta lista mais precisa.</p>
        )}
      </section>
      <p className="ajuda">Os números mostram como o processo está funcionando, não o desempenho de pessoas.</p>
    </>
  );
}
