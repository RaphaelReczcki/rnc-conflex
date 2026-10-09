"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { PERIODOS, type ChavePeriodo } from "@/lib/painel/indicadores";

// Filtros do painel numa linha acima dos gráficos; ficam na URL.
export function FiltrosPainel({ setor, periodo, setores, intervalo }: { setor: string; periodo: ChavePeriodo; setores: { id: string; nome: string }[]; intervalo: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const [carregando, iniciar] = useTransition();

  function aplicar(mudanca: { setor?: string; periodo?: string }) {
    const p = new URLSearchParams();
    const s = mudanca.setor ?? setor;
    const per = mudanca.periodo ?? periodo;
    if (s) p.set("setor", s);
    if (per !== "12m") p.set("periodo", per);
    const qs = p.toString();
    iniciar(() => router.replace(qs ? `${caminho}?${qs}` : caminho, { scroll: false }));
  }

  return (
    <div className="painel-filtros" role="group" aria-label="Filtros do painel" aria-busy={carregando}>
      <label className="sr" htmlFor="p-setor">
        Setor
      </label>
      <select id="p-setor" value={setor} onChange={(e) => aplicar({ setor: e.target.value })}>
        <option value="">Todos os setores</option>
        {setores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      <label className="sr" htmlFor="p-periodo">
        Período
      </label>
      <select id="p-periodo" value={periodo} onChange={(e) => aplicar({ periodo: e.target.value })}>
        {(Object.keys(PERIODOS) as ChavePeriodo[]).map((k) => (
          <option key={k} value={k}>
            {PERIODOS[k]}
          </option>
        ))}
      </select>
      <span className="periodo">{intervalo}</span>
    </div>
  );
}
