import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth/sessao";
import {
  podeConcluirAcao,
  podeConcluirAnalise,
  podeEditarAcao,
  podeEditarAnalise,
  podeEditarImpacto,
  podeVerificar,
  type RncAcesso,
} from "@/lib/auth/permissoes";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formato";
import { diaIso, hojeEmBrasilia, somarDias } from "@/lib/datas";
import { ETAPAS, ORIGENS, PASSOS } from "@/lib/rnc/dominio";
import { PADRAO_CODIGO } from "@/lib/rnc/codigo";
import { CAMPOS_ISHIKAWA, CAMPOS_PORQUE, cicloAtual, type CampoIshikawa } from "@/lib/rnc/ciclo";
import { AtalhoAjuda, SeloSeveridade } from "@/components/Rnc";
import { FormAcao, FormAnalise, FormImpacto, FormVerificacao } from "./FormsEtapas";

type Params = { params: Promise<{ codigo: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: (await params).codigo };
}

const AVISOS: Record<string, string> = {
  analise_concluida: "Análise concluída. O próximo passo é definir a ação corretiva.",
  acao_concluida: "Ação concluída. A verificação de eficácia fica liberada na data prevista, ou antes se já houver evidência.",
  verificacao_eficaz: "RNC encerrada. O aprendizado fica registrado para a equipe.",
  verificacao_ineficaz: "A RNC voltou para a análise de causa. A análise e a ação anteriores continuam guardadas logo abaixo.",
};

type AnaliseDb = Awaited<ReturnType<typeof prisma.analise.findMany>>[number];

function LeituraAnalise({ a }: { a: AnaliseDb }) {
  const porques = CAMPOS_PORQUE.map((c) => a[c]).filter(Boolean);
  const ish = (Object.keys(CAMPOS_ISHIKAWA) as CampoIshikawa[]).filter((c) => a[c]);
  return (
    <>
      <dt>Método</dt>
      <dd>{a.metodo === "ishikawa" ? "Ishikawa" : "5 Porquês"}</dd>
      {a.metodo === "ishikawa"
        ? ish.map((c) => (
            <div key={c}>
              <dt>{CAMPOS_ISHIKAWA[c].rotulo}</dt>
              <dd>{a[c]}</dd>
            </div>
          ))
        : porques.map((p, k) => (
            <div key={k}>
              <dt>{k + 1}º por quê</dt>
              <dd>{p}</dd>
            </div>
          ))}
      <dt>Causa raiz</dt>
      <dd>{a.causaRaiz}</dd>
    </>
  );
}

export default async function DetalheRnc({ params, searchParams }: Params) {
  const usuario = await exigirUsuario();
  const { codigo } = await params;
  const { registrada, cliente_novo, feito } = await searchParams;
  if (!PADRAO_CODIGO.test(codigo)) notFound();

  const rnc = await prisma.rnc.findUnique({
    where: { codigo },
    include: {
      setor: true,
      cliente: true,
      autor: { select: { id: true, nome: true } },
      analises: { orderBy: { ciclo: "asc" }, include: { concluidaPor: { select: { id: true, nome: true } } } },
      acoes: {
        orderBy: { ciclo: "asc" },
        include: { responsavel: { select: { id: true, nome: true } }, concluidaPor: { select: { id: true, nome: true } } },
      },
      verificacoes: { orderBy: { ciclo: "asc" }, include: { verificadoPor: { select: { id: true, nome: true } } } },
      historico: { orderBy: { id: "desc" }, include: { usuario: { select: { id: true, nome: true } } } },
    },
  });
  if (!rnc) notFound();

  const pessoas = await prisma.usuario.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, setor: { select: { nome: true } } },
  });

  const hoje = hojeEmBrasilia();
  const ciclo = cicloAtual(rnc.reaberturas);
  const analise = rnc.analises.find((a) => a.ciclo === ciclo);
  const acao = rnc.acoes.find((a) => a.ciclo === ciclo);
  const verificacao = rnc.verificacoes.find((v) => v.ciclo === ciclo);
  const anteriores = Array.from({ length: ciclo - 1 }, (_, i) => i + 1).reverse();

  const acesso: RncAcesso = { setorId: rnc.setorId, autorId: rnc.autorId, responsavelAcaoId: acao?.responsavelId ?? null };
  const etapa = ETAPAS[rnc.status].indice;
  const classe = (indice: number) => (indice < etapa ? "done" : indice === etapa ? "cur" : "locked");
  const quem = (u: { id: string; nome: string } | null | undefined) => (!u ? "sistema" : u.id === usuario.id ? "você" : u.nome);
  const prazo = diaIso(acao?.prazo);
  const verificarEm = diaIso(acao?.verificarEm);
  const ocorrencia = diaIso(rnc.dataOcorrencia);

  const aviso = feito && AVISOS[feito] ? AVISOS[feito] : registrada ? `RNC registrada. O próximo passo é a análise de causa.${cliente_novo ? " O cliente foi incluído no cadastro." : ""}` : null;

  return (
    <>
      <Link href="/registros" className="back">
        ← Voltar para registros
      </Link>

      {aviso && (
        <div className="notice ok" role="status">
          {aviso}
        </div>
      )}

      <div className="dhead">
        <div>
          <h2>
            {rnc.codigo} <SeloSeveridade severidade={rnc.severidade} />
          </h2>
          <div className="meta">
            {rnc.setor.nome}
            {rnc.cliente ? `, ${rnc.cliente.nome}` : ""}. Registrada em {formatarData(rnc.criadaEm)} por {quem(rnc.autor)}.
            {rnc.reaberturas > 0 && ` Ciclo ${ciclo}: voltou para a análise ${rnc.reaberturas === 1 ? "uma vez" : `${rnc.reaberturas} vezes`}.`}
          </div>
        </div>
      </div>

      <ol className="steps">
        {PASSOS.map((nome, k) => (
          <li key={nome} className={k < etapa ? "done" : k === etapa ? "cur" : ""}>
            {nome}
          </li>
        ))}
      </ol>

      {/* Registro */}
      <section className="card stage done">
        <h3>Registro</h3>
        <dl className="ro">
          <dt>Tipo de problema</dt>
          <dd>{rnc.tipoProblema}</dd>
          <dt>Origem</dt>
          <dd>{ORIGENS[rnc.origem]}</dd>
          <dt>Data da ocorrência</dt>
          <dd>{formatarData(ocorrencia)}</dd>
          <dt>O que aconteceu</dt>
          <dd>{rnc.descricao}</dd>
          <dt>Correção imediata</dt>
          <dd>{rnc.correcaoImediata || "—"}</dd>
        </dl>
        <FormImpacto
          codigo={rnc.codigo}
          multas={Number(rnc.multasJuros) ? Number(rnc.multasJuros).toFixed(2).replace(".", ",") : ""}
          horas={Number(rnc.horasRetrabalho) ? String(Number(rnc.horasRetrabalho)).replace(".", ",") : ""}
          pode={podeEditarImpacto(usuario, acesso)}
        />
      </section>

      {/* Análise de causa */}
      <section className={`card stage ${classe(1)}`}>
        <h3 className="titulo-etapa">
          Análise de causa raiz <AtalhoAjuda ancora="analise" />
        </h3>
        {classe(1) === "done" && analise ? (
          <>
            <p className="sub">
              Concluída em {formatarData(analise.concluidaEm)} por {quem(analise.concluidaPor)}.
            </p>
            <dl className="ro">
              <LeituraAnalise a={analise} />
            </dl>
          </>
        ) : (
          <>
            <p className="sub">
              {rnc.reaberturas > 0
                ? "A ação anterior não resolveu. Olhe de novo para o processo: o que a primeira análise não enxergou?"
                : "Corrigir o efeito não basta. Pergunte por que o problema aconteceu até chegar a algo que o processo possa mudar."}
            </p>
            <FormAnalise
              codigo={rnc.codigo}
              inicial={{
                metodo: analise?.metodo ?? "cinco_porques",
                porques: CAMPOS_PORQUE.map((c) => analise?.[c] ?? null),
                ishikawa: Object.fromEntries((Object.keys(CAMPOS_ISHIKAWA) as CampoIshikawa[]).map((c) => [c, analise?.[c] ?? null])),
                causaRaiz: analise?.causaRaiz ?? null,
              }}
              podeEditar={podeEditarAnalise(usuario, acesso)}
              podeConcluir={podeConcluirAnalise(usuario, acesso)}
            />
          </>
        )}
      </section>

      {/* Ação corretiva */}
      <section className={`card stage ${classe(2)}`}>
        <h3 className="titulo-etapa">
          Ação corretiva <AtalhoAjuda ancora="acao" />
        </h3>
        {classe(2) === "locked" ? (
          <p className="sub" style={{ marginBottom: 0 }}>
            Liberada depois da análise de causa.
          </p>
        ) : classe(2) === "done" && acao ? (
          <>
            <p className="sub">
              Concluída em {formatarData(acao.concluidaEm)} por {quem(acao.concluidaPor)}.
            </p>
            <dl className="ro">
              <dt>Ação</dt>
              <dd>{acao.descricao}</dd>
              <dt>Responsável</dt>
              <dd>{acao.responsavel?.nome ?? "—"}</dd>
              <dt>Prazo</dt>
              <dd>{formatarData(prazo) || "—"}</dd>
              {acao.exigeAtualizarDocumento && (
                <>
                  <dt>Documentação</dt>
                  <dd>Exigiu atualizar POP, checklist ou modelo</dd>
                </>
              )}
            </dl>
          </>
        ) : (
          <>
            <p className="sub">
              O que muda no processo para a causa raiz não se repetir.
              {prazo && prazo < hoje && ` O prazo combinado era ${formatarData(prazo)}. Se precisar de mais tempo, ajuste o prazo.`}
            </p>
            <FormAcao
              codigo={rnc.codigo}
              inicial={{
                descricao: acao?.descricao ?? null,
                responsavelId: acao?.responsavelId ?? null,
                prazo,
                exigeAtualizarDocumento: acao?.exigeAtualizarDocumento ?? false,
                verificarEm: verificarEm || somarDias(hoje, 30),
              }}
              pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome, setor: p.setor?.nome ?? null }))}
              podeEditar={podeEditarAcao(usuario, acesso)}
              podeConcluir={podeConcluirAcao(usuario, acesso) || podeEditarAcao(usuario, acesso)}
              minimo={ocorrencia}
            />
          </>
        )}
      </section>

      {/* Verificação de eficácia */}
      <section className={`card stage ${classe(3)}`}>
        <h3 className="titulo-etapa">
          Verificação de eficácia <AtalhoAjuda ancora="verificacao" />
        </h3>
        {classe(3) === "locked" ? (
          <p className="sub" style={{ marginBottom: 0 }}>
            Liberada depois que a ação corretiva for concluída.
          </p>
        ) : classe(3) === "done" && verificacao ? (
          <>
            <p className="sub">
              Encerrada em {formatarData(rnc.encerradaEm)} por {quem(verificacao.verificadoPor)}.
            </p>
            <dl className="ro">
              <dt>Resultado</dt>
              <dd>Eficaz, o problema não voltou</dd>
              <dt>Evidência e aprendizado</dt>
              <dd>{verificacao.evidencia || "—"}</dd>
            </dl>
          </>
        ) : (
          <>
            <p className="sub">
              {verificarEm && verificarEm > hoje
                ? `Prevista para ${formatarData(verificarEm)}. Você pode verificar antes, se já houver evidência.`
                : "Confira se o problema voltou a acontecer desde a ação."}
            </p>
            <FormVerificacao codigo={rnc.codigo} pode={podeVerificar(usuario, acesso)} />
          </>
        )}
      </section>

      {/* Ciclos anteriores (verificações ineficazes) */}
      {anteriores.length > 0 && (
        <section className="card">
          <h3>Ciclos anteriores</h3>
          <p className="sub">O que já foi tentado. Serve de ponto de partida para a nova análise.</p>
          {anteriores.map((n) => {
            const an = rnc.analises.find((a) => a.ciclo === n);
            const ac = rnc.acoes.find((a) => a.ciclo === n);
            const ve = rnc.verificacoes.find((v) => v.ciclo === n);
            return (
              <div key={n} className="ciclo-anterior">
                <h4>Ciclo {n}</h4>
                <dl className="ro">
                  {an && <LeituraAnalise a={an} />}
                  <dt>Ação</dt>
                  <dd>{ac?.descricao ?? "—"}</dd>
                  <dt>Responsável</dt>
                  <dd>{ac?.responsavel?.nome ?? "—"}</dd>
                  <dt>Verificação</dt>
                  <dd>
                    Ineficaz, em {formatarData(ve?.verificadoEm)} por {quem(ve?.verificadoPor)}
                    {ve?.evidencia ? `: ${ve.evidencia}` : "."}
                  </dd>
                </dl>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <h3>Histórico</h3>
        <ul className="hist" style={{ marginTop: 10 }}>
          {rnc.historico.map((h) => (
            <li key={h.id.toString()}>
              <b>{h.texto}</b>, {formatarDataHora(h.criadoEm)}, por {quem(h.usuario)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
