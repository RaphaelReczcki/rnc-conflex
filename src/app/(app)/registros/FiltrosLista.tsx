"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ETAPAS, ORDEM_SEVERIDADE, SEVERIDADES } from "@/lib/rnc/dominio";
import type { Filtros } from "@/lib/rnc/filtros";

function parametros(f: Filtros): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.etapa !== "abertas") p.set("etapa", f.etapa);
  if (f.setor) p.set("setor", f.setor);
  if (f.sev) p.set("sev", f.sev);
  return p.toString();
}

// Os filtros ficam na URL: dá para voltar, recarregar e compartilhar o link.
export function FiltrosLista({
  filtros,
  setores,
  podeExportar,
}: {
  filtros: Filtros;
  setores: { id: string; nome: string }[];
  podeExportar: boolean;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const [busca, setBusca] = useState(filtros.q);
  const [, iniciar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  function aplicar(mudanca: Partial<Filtros>) {
    const qs = parametros({ ...filtros, q: busca, ...mudanca });
    iniciar(() => router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(espera.current), []);

  return (
    <form className="filters" role="search" onSubmit={(e) => (e.preventDefault(), aplicar({}))}>
      <label className="sr" htmlFor="fq">
        Buscar
      </label>
      <input
        id="fq"
        type="search"
        placeholder="Buscar por cliente, código, tipo ou responsável"
        value={busca}
        onChange={(e) => {
          const q = e.target.value;
          setBusca(q);
          clearTimeout(espera.current);
          espera.current = setTimeout(() => aplicar({ q }), 300);
        }}
      />
      <label className="sr" htmlFor="fe">
        Etapa
      </label>
      <select id="fe" value={filtros.etapa} onChange={(e) => aplicar({ etapa: e.target.value as Filtros["etapa"] })}>
        <option value="abertas">Em aberto</option>
        <option value="todas">Todas</option>
        {(Object.keys(ETAPAS) as (keyof typeof ETAPAS)[]).map((k) => (
          <option key={k} value={k}>
            {ETAPAS[k].curto}
          </option>
        ))}
      </select>
      <label className="sr" htmlFor="fs">
        Setor
      </label>
      <select id="fs" value={filtros.setor} onChange={(e) => aplicar({ setor: e.target.value })}>
        <option value="">Todos os setores</option>
        {setores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      <label className="sr" htmlFor="fv">
        Severidade
      </label>
      <select id="fv" value={filtros.sev} onChange={(e) => aplicar({ sev: e.target.value as Filtros["sev"] })}>
        <option value="">Todas as severidades</option>
        {ORDEM_SEVERIDADE.map((k) => (
          <option key={k} value={k}>
            {SEVERIDADES[k].rotulo}
          </option>
        ))}
      </select>
      {podeExportar && (
        // Exporta exatamente o que a lista mostra (filtros já aplicados)
        <a className="btn small" href={`/registros/exportar${parametros(filtros) ? `?${parametros(filtros)}` : ""}`} download>
          Exportar CSV
        </a>
      )}
    </form>
  );
}
