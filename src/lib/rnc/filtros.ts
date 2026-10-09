// Filtros da lista de registros, lidos da URL (?q=&etapa=&setor=&sev=).
import type { Prisma } from "@/generated/prisma/client";
import { normalizar } from "@/lib/normalizar";
import { ETAPAS, SEVERIDADES, type Severidade, type Status } from "./dominio";

export type Filtros = {
  q: string;
  etapa: "abertas" | "todas" | Status;
  setor: string;
  sev: Severidade | "";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerFiltros(params: Record<string, string | string[] | undefined>): Filtros {
  const um = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v ?? "").trim();
  };
  const etapa = um("etapa");
  const sev = um("sev");
  const setor = um("setor");
  return {
    q: um("q").slice(0, 100),
    etapa: etapa === "todas" || etapa in ETAPAS ? (etapa as Filtros["etapa"]) : "abertas",
    setor: UUID.test(setor) ? setor : "",
    sev: sev in SEVERIDADES ? (sev as Severidade) : "",
  };
}

export function condicaoLista(f: Filtros): Prisma.RncWhereInput {
  const e: Prisma.RncWhereInput[] = [];
  if (f.etapa === "abertas") e.push({ status: { not: "encerrada" } });
  else if (f.etapa !== "todas") e.push({ status: f.etapa });
  if (f.setor) e.push({ setorId: f.setor });
  if (f.sev) e.push({ severidade: f.sev });

  const q = normalizar(f.q);
  if (q) {
    e.push({
      OR: [
        { codigo: { contains: f.q.trim().toUpperCase() } },
        { tipoProblemaNorm: { contains: q } },
        { cliente: { nomeNormalizado: { contains: q } } },
        { acoes: { some: { responsavel: { nome: { contains: f.q.trim(), mode: "insensitive" } } } } },
      ],
    });
  }
  return e.length ? { AND: e } : {};
}
