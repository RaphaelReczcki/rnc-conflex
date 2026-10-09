"use client";

import { useActionState, useState } from "react";
import { CAMPOS_ISHIKAWA, CAMPOS_PORQUE, type CampoIshikawa } from "@/lib/rnc/ciclo";
import { enviarAcao, enviarAnalise, enviarImpacto, enviarVerificacao, type EstadoEtapa } from "./actions";

type Acao = (anterior: EstadoEtapa, form: FormData) => Promise<EstadoEtapa>;

function useEtapa(acao: Acao) {
  return useActionState<EstadoEtapa, FormData>(acao, {});
}

function Mensagens({ estado }: { estado: EstadoEtapa }) {
  return (
    <>
      {estado.erro && (
        <p className="err" role="alert">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p className="salvo" role="status">
          {estado.ok}
        </p>
      )}
    </>
  );
}

// Valor do campo: o devolvido após um erro, senão o gravado no banco
const valorDe = (estado: EstadoEtapa, campo: string, gravado: string | null | undefined) => estado.valores?.[campo] ?? gravado ?? "";

// ---------- Impacto ----------

export function FormImpacto({ codigo, multas, horas, pode }: { codigo: string; multas: string; horas: string; pode: boolean }) {
  const [estado, acao, enviando] = useEtapa(enviarImpacto);
  return (
    <form action={acao} key={estado.chave} style={{ marginTop: 16 }}>
      <input type="hidden" name="codigo" value={codigo} />
      <div className="fields">
        <div className="field">
          <label htmlFor="d-custo">Multas e juros (R$)</label>
          <input id="d-custo" name="multasJuros" inputMode="decimal" defaultValue={valorDe(estado, "multasJuros", multas)} disabled={!pode} />
        </div>
        <div className="field">
          <label htmlFor="d-horas">Horas de retrabalho</label>
          <input id="d-horas" name="horasRetrabalho" inputMode="decimal" defaultValue={valorDe(estado, "horasRetrabalho", horas)} disabled={!pode} />
        </div>
      </div>
      <Mensagens estado={estado} />
      {pode && (
        <div className="actions">
          <button type="submit" className="btn small" disabled={enviando}>
            Atualizar impacto
          </button>
        </div>
      )}
    </form>
  );
}

// ---------- Análise de causa ----------

export type AnaliseInicial = {
  metodo: "cinco_porques" | "ishikawa";
  porques: (string | null)[];
  ishikawa: Partial<Record<CampoIshikawa, string | null>>;
  causaRaiz: string | null;
};

export function FormAnalise({ codigo, inicial, podeEditar, podeConcluir }: { codigo: string; inicial: AnaliseInicial; podeEditar: boolean; podeConcluir: boolean }) {
  const [estado, acao, enviando] = useEtapa(enviarAnalise);
  const [metodo, setMetodo] = useState(estado.valores?.metodo ?? inicial.metodo);
  const dis = !podeEditar;

  return (
    <form action={acao} key={estado.chave} noValidate>
      <input type="hidden" name="codigo" value={codigo} />
      <div className="fields">
        <div className="field full">
          <label htmlFor="a-met">Método</label>
          <select id="a-met" name="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as AnaliseInicial["metodo"])} disabled={dis}>
            <option value="cinco_porques">5 Porquês, bom para a maioria dos casos</option>
            <option value="ishikawa">Ishikawa, para problemas recorrentes ou com várias causas</option>
          </select>
          {dis && <input type="hidden" name="metodo" value={metodo} />}
        </div>

        {/* Os dois métodos ficam no formulário; o rascunho guarda ambos */}
        <div className="field full" hidden={metodo !== "cinco_porques"}>
          <div className="whys">
            {CAMPOS_PORQUE.map((c, k) => (
              <div className="field" key={c}>
                <span>{k + 1}º por quê</span>
                <input name={c} aria-label={`${k + 1}º por quê`} maxLength={2000} defaultValue={valorDe(estado, c, inicial.porques[k])} disabled={dis} />
              </div>
            ))}
          </div>
        </div>
        <div className="field full" hidden={metodo !== "ishikawa"}>
          <div className="fields">
            {(Object.keys(CAMPOS_ISHIKAWA) as CampoIshikawa[]).map((c) => (
              <div className="field" key={c}>
                <label htmlFor={`a-${c}`}>
                  {CAMPOS_ISHIKAWA[c].rotulo} <small>({CAMPOS_ISHIKAWA[c].dica})</small>
                </label>
                <textarea id={`a-${c}`} name={c} maxLength={2000} style={{ minHeight: 60 }} defaultValue={valorDe(estado, c, inicial.ishikawa[c])} disabled={dis} />
              </div>
            ))}
          </div>
        </div>

        <div className="field full">
          <label htmlFor="a-causa">Causa raiz</label>
          <textarea
            id="a-causa"
            name="causaRaiz"
            maxLength={3000}
            placeholder="Ex.: o checklist de fechamento não tem conferência de vencimentos antecipados por feriado."
            defaultValue={valorDe(estado, "causaRaiz", inicial.causaRaiz)}
            disabled={dis}
          />
          <small>Procure algo que o processo possa mudar: um passo, uma conferência, um modelo, um prazo.</small>
        </div>
      </div>
      <Mensagens estado={estado} />
      {podeEditar ? (
        <div className="actions">
          <button type="submit" name="intencao" value="rascunho" className="btn" disabled={enviando}>
            Salvar rascunho
          </button>
          <button type="submit" name="intencao" value="concluir" className="btn primary" disabled={enviando || !podeConcluir}>
            Concluir análise
          </button>
        </div>
      ) : (
        <p className="ajuda">Quem preenche a análise: quem registrou, o responsável pela ação, o líder do setor ou a gestão da qualidade.</p>
      )}
      {podeEditar && !podeConcluir && (
        <p className="ajuda">Você pode salvar o rascunho. A conclusão fica com o líder do setor ou a gestão da qualidade.</p>
      )}
    </form>
  );
}

// ---------- Ação corretiva ----------

export type AcaoInicial = {
  descricao: string | null;
  responsavelId: string | null;
  prazo: string;
  exigeAtualizarDocumento: boolean;
  verificarEm: string;
};

export function FormAcao({
  codigo,
  inicial,
  pessoas,
  podeEditar,
  podeConcluir,
  minimo,
}: {
  codigo: string;
  inicial: AcaoInicial;
  pessoas: { id: string; nome: string; setor: string | null }[];
  podeEditar: boolean;
  podeConcluir: boolean;
  minimo: string;
}) {
  const [estado, acao, enviando] = useEtapa(enviarAcao);
  const dis = !podeEditar;
  const v = (c: string, g: string | null) => valorDe(estado, c, g);
  const exige = estado.valores ? estado.valores.exigeAtualizarDocumento === "on" : inicial.exigeAtualizarDocumento;

  return (
    <form action={acao} key={estado.chave} noValidate>
      <input type="hidden" name="codigo" value={codigo} />
      <div className="fields">
        <div className="field full">
          <label htmlFor="c-acao">Ação</label>
          <textarea
            id="c-acao"
            name="descricao"
            maxLength={3000}
            placeholder="Ex.: incluir no checklist fiscal a conferência de vencimentos com feriados, revisada pelo líder do setor."
            defaultValue={v("descricao", inicial.descricao)}
            disabled={dis}
          />
        </div>
        <div className="field">
          <label htmlFor="c-resp">Responsável</label>
          <select id="c-resp" name="responsavelId" defaultValue={v("responsavelId", inicial.responsavelId)} disabled={dis}>
            <option value="">Escolha quem executa</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.setor ? ` (${p.setor})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-prazo">Prazo</label>
          <input id="c-prazo" name="prazo" type="date" min={minimo} defaultValue={v("prazo", inicial.prazo)} disabled={dis} />
        </div>
        <div className="field full">
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}>
            <input type="checkbox" name="exigeAtualizarDocumento" defaultChecked={exige} disabled={dis} style={{ width: "auto" }} />A ação exige
            atualizar um POP, checklist ou modelo
          </label>
        </div>
        <div className="field">
          <label htmlFor="c-verif">Verificar a eficácia em</label>
          <input id="c-verif" name="verificarEm" type="date" min={minimo} defaultValue={v("verificarEm", inicial.verificarEm)} disabled={dis} />
          <small>Entre 30 e 60 dias costuma bastar. Para obrigações mensais, espere ao menos um ciclo.</small>
        </div>
      </div>
      <Mensagens estado={estado} />
      {podeEditar ? (
        <div className="actions">
          <button type="submit" name="intencao" value="rascunho" className="btn" disabled={enviando}>
            Salvar rascunho
          </button>
          <button type="submit" name="intencao" value="concluir" className="btn primary" disabled={enviando || !podeConcluir}>
            Concluir ação
          </button>
        </div>
      ) : (
        <p className="ajuda">Quem preenche a ação: quem registrou, o responsável por ela, o líder do setor ou a gestão da qualidade.</p>
      )}
      {podeEditar && !podeConcluir && (
        <p className="ajuda">Quem conclui é o responsável pela ação, o líder do setor ou a gestão. Se for você, escolha seu nome em Responsável.</p>
      )}
    </form>
  );
}

// ---------- Verificação de eficácia ----------

export function FormVerificacao({ codigo, pode }: { codigo: string; pode: boolean }) {
  const [estado, acao, enviando] = useEtapa(enviarVerificacao);
  const res = estado.valores?.resultado;
  return (
    <form action={acao} key={estado.chave} noValidate>
      <input type="hidden" name="codigo" value={codigo} />
      <div className="fields">
        <div className="field full">
          <span className="lab" id="v-lab">
            Resultado
          </span>
          <div className="result" role="radiogroup" aria-labelledby="v-lab">
            <label>
              <input type="radio" name="resultado" value="eficaz" defaultChecked={res === "eficaz"} disabled={!pode} /> Eficaz, o problema não voltou
            </label>
            <label>
              <input type="radio" name="resultado" value="ineficaz" defaultChecked={res === "ineficaz"} disabled={!pode} /> Ineficaz, o problema voltou
            </label>
          </div>
        </div>
        <div className="field full">
          <label htmlFor="v-lic">Evidência e aprendizado</label>
          <textarea
            id="v-lic"
            name="evidencia"
            maxLength={3000}
            placeholder="Ex.: três fechamentos sem atraso; checklist v2 publicado na pasta de procedimentos."
            defaultValue={estado.valores?.evidencia}
            disabled={!pode}
          />
          <small>Se o problema voltou, a RNC retorna para a análise de causa. A análise e a ação deste ciclo ficam guardadas.</small>
        </div>
      </div>
      <Mensagens estado={estado} />
      {pode ? (
        <div className="actions">
          <button type="submit" className="btn primary" disabled={enviando}>
            Registrar verificação
          </button>
        </div>
      ) : (
        <p className="ajuda">Quem verifica a eficácia é o líder do setor ou a gestão da qualidade.</p>
      )}
    </form>
  );
}
