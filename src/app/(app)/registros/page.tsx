import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth/sessao";
import { podeExportar } from "@/lib/auth/permissoes";
import { formatarData } from "@/lib/formato";
import { hojeEmBrasilia } from "@/lib/rnc/codigo";
import { condicaoLista, lerFiltros } from "@/lib/rnc/filtros";
import { escopoDoUsuario } from "@/lib/rnc/escopo-servidor";
import { SeloSeveridade, TrilhaCiclo } from "@/components/Rnc";
import { FiltrosLista } from "./FiltrosLista";

export const metadata: Metadata = { title: "Registros" };

const LIMITE = 300;

// Data (coluna DATE) como "AAAA-MM-DD", sem deslocamento de fuso
const diaIso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function Registros({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirUsuario();
  const filtros = lerFiltros(await searchParams);
  // Só as RNCs que esta pessoa pode ver (colaborador: as dele; líder: setor e equipe)
  const escopo = await escopoDoUsuario(usuario);
  const where = { AND: [escopo, condicaoLista(filtros)] };

  const [setores, rncs, total, existeAlguma] = await Promise.all([
    prisma.setor.findMany({ orderBy: [{ ativo: "desc" }, { ordem: "asc" }], select: { id: true, nome: true } }),
    prisma.rnc.findMany({
      where,
      orderBy: { criadaEm: "desc" },
      take: LIMITE,
      select: {
        id: true,
        codigo: true,
        dataOcorrencia: true,
        tipoProblema: true,
        descricao: true,
        severidade: true,
        status: true,
        setor: { select: { nome: true } },
        cliente: { select: { nome: true } },
        // Ação do ciclo mais recente: prazo e verificação
        acoes: { orderBy: { ciclo: "desc" }, take: 1, select: { prazo: true, verificarEm: true, responsavel: { select: { nome: true } } } },
      },
    }),
    prisma.rnc.count({ where }),
    prisma.rnc.count({ where: escopo, take: 1 }),
  ]);

  const hoje = hojeEmBrasilia();

  return (
    <>
      <FiltrosLista filtros={filtros} setores={setores} podeExportar={podeExportar(usuario)} />
      <div className="list" role="list" aria-label="Registros">
        <div className="row head" aria-hidden="true">
          <span>Código</span>
          <span>Data</span>
          <span>Setor e cliente</span>
          <span>Problema</span>
          <span>Severidade</span>
          <span>Etapa</span>
          <span>Prazo</span>
        </div>
        {rncs.length ? (
          rncs.map((r) => {
            const acao = r.acoes[0];
            const prazo = diaIso(acao?.prazo);
            const verificarEm = diaIso(acao?.verificarEm);
            const atrasada = r.status === "acao" && !!prazo && prazo < hoje;
            return (
              <Link key={r.id} href={`/rncs/${r.codigo}`} className="row" role="listitem">
                <span className="code">{r.codigo}</span>
                <span>{formatarData(diaIso(r.dataOcorrencia))}</span>
                <span>
                  {r.setor.nome}
                  <span className="cat">{r.cliente?.nome ?? "Sem cliente"}</span>
                </span>
                <span>
                  {r.tipoProblema}
                  <span className="cat">{r.descricao.slice(0, 80)}</span>
                </span>
                <span>
                  <SeloSeveridade severidade={r.severidade} />
                </span>
                <span>
                  <TrilhaCiclo status={r.status} />
                </span>
                <span className={atrasada ? "late" : ""}>
                  {r.status === "acao" && prazo
                    ? formatarData(prazo)
                    : r.status === "verificacao" && verificarEm
                      ? `Verif. ${formatarData(verificarEm)}`
                      : ""}
                </span>
              </Link>
            );
          })
        ) : (
          <div className="row" style={{ cursor: "default" }}>
            <span className="empty" style={{ gridColumn: "1/-1" }}>
              {existeAlguma ? "Nenhum registro com esses filtros." : "Nenhuma RNC registrada ainda."}{" "}
              {!existeAlguma && <Link href="/registrar">Registrar a primeira</Link>}
            </span>
          </div>
        )}
      </div>
      <p className="ajuda">
        {total === 0
          ? ""
          : total > LIMITE
            ? `Mostrando as ${LIMITE} mais recentes de ${total.toLocaleString("pt-BR")}. Use a busca ou os filtros para encontrar as demais.`
            : `${total.toLocaleString("pt-BR")} ${total === 1 ? "registro" : "registros"}.`}
      </p>
    </>
  );
}
