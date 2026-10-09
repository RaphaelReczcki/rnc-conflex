"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ORIGENS, ORDEM_SEVERIDADE, SEVERIDADES } from "@/lib/rnc/dominio";
import { AtalhoAjuda } from "@/components/Rnc";
import { registrar, type EstadoRegistro } from "./actions";

type Props = {
  setores: { id: string; nome: string }[];
  categorias: string[];
  clientes: string[];
  setorPadrao: string;
  hoje: string;
};

export function FormRegistro({ setores, categorias, clientes, setorPadrao, hoje }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoRegistro, FormData>(registrar, {});
  const v = estado.valores ?? {};
  const invalido = (campo: string) => (estado.campo === campo ? true : undefined);

  return (
    // A chave remonta o formulário com os valores devolvidos após um erro
    <form action={acao} className="card" noValidate key={estado.chave}>
      <h2 className="titulo-etapa">
        Registrar não conformidade <AtalhoAjuda ancora="registro" />
      </h2>
      <p className="sub">Registre assim que perceber o problema. O objetivo é melhorar o processo, não apontar culpados.</p>
      <div className="fields">
        <div className="field">
          <label htmlFor="n-setor">Setor</label>
          <select id="n-setor" name="setorId" required defaultValue={v.setorId ?? setorPadrao} aria-invalid={invalido("setorId")}>
            <option value="">Escolha o setor</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="n-data">Data da ocorrência</label>
          <input id="n-data" name="dataOcorrencia" type="date" max={hoje} defaultValue={v.dataOcorrencia ?? hoje} aria-invalid={invalido("dataOcorrencia")} />
        </div>
        <div className="field">
          <label htmlFor="n-cliente">Cliente afetado</label>
          <input id="n-cliente" name="cliente" list="clientes" maxLength={160} autoComplete="off" placeholder="Deixe vazio se for um processo interno" defaultValue={v.cliente} aria-invalid={invalido("cliente")} />
          <datalist id="clientes">
            {clientes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <small>Se o cliente ainda não estiver na lista, ele é cadastrado ao registrar.</small>
        </div>
        <div className="field">
          <label htmlFor="n-cat">Tipo de problema</label>
          <input id="n-cat" name="tipoProblema" list="cats" maxLength={160} autoComplete="off" placeholder="Ex.: Guia paga em atraso" required defaultValue={v.tipoProblema} aria-invalid={invalido("tipoProblema")} />
          <datalist id="cats">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <small>Use sempre o mesmo nome para o mesmo tipo. É assim que o painel encontra repetições.</small>
        </div>
        <div className="field">
          <label htmlFor="n-origem">Origem</label>
          <select id="n-origem" name="origem" required defaultValue={v.origem ?? ""} aria-invalid={invalido("origem")}>
            <option value="">De onde veio o problema?</option>
            {Object.entries(ORIGENS).map(([k, rotulo]) => (
              <option key={k} value={k}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <span className="lab" id="sevlab">
            Severidade
          </span>
          <div className="sevpick" role="radiogroup" aria-labelledby="sevlab">
            {ORDEM_SEVERIDADE.map((k) => (
              <label key={k} className={k}>
                <input type="radio" name="severidade" value={k} defaultChecked={v.severidade === k} />
                <span className="nm">{SEVERIDADES[k].rotulo}</span>
                <span className="ds">{SEVERIDADES[k].descricao}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field full">
          <label htmlFor="n-desc">O que aconteceu</label>
          <textarea id="n-desc" name="descricao" required maxLength={5000} placeholder="Descreva os fatos: o quê, quando, qual obrigação ou documento, como foi percebido." defaultValue={v.descricao} aria-invalid={invalido("descricao")} />
        </div>
        <div className="field full">
          <label htmlFor="n-corr">Correção imediata</label>
          <textarea id="n-corr" name="correcaoImediata" maxLength={5000} placeholder="O que já foi feito para resolver o efeito. Ex.: guia reemitida e paga com juros em 10/10." defaultValue={v.correcaoImediata} aria-invalid={invalido("correcaoImediata")} />
        </div>
        <div className="field">
          <label htmlFor="n-custo">Multas e juros (R$)</label>
          <input id="n-custo" name="multasJuros" inputMode="decimal" placeholder="0,00" defaultValue={v.multasJuros} aria-invalid={invalido("multasJuros")} />
        </div>
        <div className="field">
          <label htmlFor="n-horas">Horas de retrabalho</label>
          <input id="n-horas" name="horasRetrabalho" inputMode="decimal" placeholder="0" defaultValue={v.horasRetrabalho} aria-invalid={invalido("horasRetrabalho")} />
        </div>
      </div>
      <p className="lgpd">
        Proteção de dados: não registre CPF, dados bancários ou de saúde de funcionários dos clientes. Descreva o fato sem
        esses dados.
      </p>
      {estado.erro && (
        <p className="err" role="alert">
          {estado.erro}
        </p>
      )}
      <div className="actions">
        <Link href="/" className="btn">
          Cancelar
        </Link>
        <button type="submit" className="btn primary" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar RNC"}
        </button>
      </div>
    </form>
  );
}
