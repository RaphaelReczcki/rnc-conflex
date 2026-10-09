// Pequenos elementos visuais da RNC, iguais aos do protótipo.
import Link from "next/link";
import { ETAPAS, SEVERIDADES, type Severidade, type Status } from "@/lib/rnc/dominio";

// Atalho para o trecho do tutorial "Como preencher" (abre em outra aba para não perder o que foi digitado)
export function AtalhoAjuda({ ancora, texto = "Como preencher" }: { ancora: string; texto?: string }) {
  return (
    <Link href={`/ajuda#${ancora}`} className="atalho-ajuda" target="_blank" rel="noopener">
      {texto}
    </Link>
  );
}

export function SeloSeveridade({ severidade }: { severidade: Severidade }) {
  return <span className={`sev ${severidade}`}>{SEVERIDADES[severidade].rotulo}</span>;
}

// Trilha curta do ciclo: etapas concluídas em verde, a atual em azul.
export function TrilhaCiclo({ status }: { status: Status }) {
  const atual = ETAPAS[status].indice;
  return (
    <span className="mini" role="img" aria-label={ETAPAS[status].rotulo} title={ETAPAS[status].rotulo}>
      {[0, 1, 2, 3].map((n) => (
        <span key={n} className={n < atual ? "done" : n === atual ? "cur" : ""} />
      ))}
    </span>
  );
}
