"use client";

import { useMemo, useState, useTransition } from "react";
import { formatarCnpj, mascararCnpj, normalizarCnpj } from "@/lib/cnpj";
import { criarCliente, editarCliente, juntarClientes, type ResultadoCliente } from "./actions";

export type ClienteLinha = { id: string; nome: string; nomeNormalizado: string; codigoInterno: string | null; cnpj: string | null; ativo: boolean; rncs: number };

const semAcento = (t: string) => t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Clientes({ lista }: { lista: ClienteLinha[] }) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<ClienteLinha | "novo" | null>(null);
  const [juntando, setJuntando] = useState<ClienteLinha | null>(null);
  const [aviso, setAviso] = useState("");

  const filtrada = useMemo(() => {
    const q = semAcento(busca);
    const qCnpj = normalizarCnpj(busca);
    return q
      ? lista.filter(
          (c) => c.nomeNormalizado.includes(q) || (c.codigoInterno ?? "").toLowerCase().includes(q) || (qCnpj.length >= 3 && (c.cnpj ?? "").includes(qCnpj)),
        )
      : lista;
  }, [busca, lista]);

  const concluir = (r: ResultadoCliente) => {
    setEditando(null);
    setJuntando(null);
    if (r.ok) setAviso(r.ok);
  };

  return (
    <>
      <div className="titulo-pagina">
        <p className="suave">
          Clientes do escritório citados nas RNCs: nome, CNPJ e código no sistema contábil. Nada de CPF ou dados de funcionários (LGPD).
        </p>
        <button type="button" className="btn primary" onClick={() => setEditando("novo")}>
          + Novo cliente
        </button>
      </div>
      {aviso && (
        <p className="notice ok" role="status">
          {aviso}
        </p>
      )}
      <div className="filters">
        <label className="sr" htmlFor="c-busca">
          Buscar cliente
        </label>
        <input id="c-busca" type="search" placeholder="Buscar por nome, CNPJ ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="suave">
          {filtrada.length} de {lista.length}
        </span>
      </div>

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="col-opcional">CNPJ</th>
              <th className="col-opcional">Código interno</th>
              <th>RNCs</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrada.length ? (
              filtrada.map((c) => (
                <tr key={c.id} className={c.ativo ? "" : "inativo"}>
                  <td>
                    {c.nome}
                    {(c.cnpj || c.codigoInterno) && (
                      <span className="sub so-celular">{[c.cnpj && formatarCnpj(c.cnpj), c.codigoInterno && `Cód. ${c.codigoInterno}`].filter(Boolean).join(" · ")}</span>
                    )}
                  </td>
                  <td className="col-opcional mono">{c.cnpj ? formatarCnpj(c.cnpj) : "—"}</td>
                  <td className="col-opcional">{c.codigoInterno ?? "—"}</td>
                  <td>{c.rncs ? <a href={`/registros?etapa=todas&q=${encodeURIComponent(c.nome)}`}>{c.rncs}</a> : "0"}</td>
                  <td>
                    <span className={`pill ${c.ativo ? "ativo" : "off"}`}>{c.ativo ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td>
                    <div className="linha-acoes" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="btn small" onClick={() => setJuntando(c)}>
                        Juntar com outro
                      </button>
                      <button type="button" className="btn small" onClick={() => setEditando(c)}>
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty">
                  {lista.length ? "Nenhum cliente com essa busca." : "Nenhum cliente cadastrado. Eles também são cadastrados ao registrar uma RNC."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="ajuda">
        Cliente inativo não aparece nas sugestões do registro, mas continua nas RNCs antigas. Se o mesmo cliente foi digitado de dois jeitos, use
        &quot;Juntar com outro&quot;: as RNCs passam para o cadastro certo e o duplicado é removido.
      </p>

      {editando && <ModalCliente cliente={editando === "novo" ? null : editando} aoFechar={() => setEditando(null)} aoSalvar={concluir} />}
      {juntando && <ModalJuntar origem={juntando} lista={lista} aoFechar={() => setJuntando(null)} aoSalvar={concluir} />}
    </>
  );
}

function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-fundo" onClick={aoFechar} onKeyDown={(e) => e.key === "Escape" && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

function Rodape({ salvando, aoFechar, rotulo = "Salvar" }: { salvando: boolean; aoFechar: () => void; rotulo?: string }) {
  return (
    <div className="actions">
      <button type="button" className="btn" onClick={aoFechar}>
        Cancelar
      </button>
      <button type="submit" className="btn primary" disabled={salvando}>
        {salvando ? "Salvando…" : rotulo}
      </button>
    </div>
  );
}

function ModalCliente({ cliente: c, aoFechar, aoSalvar }: { cliente: ClienteLinha | null; aoFechar: () => void; aoSalvar: (r: ResultadoCliente) => void }) {
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const [cnpj, setCnpj] = useState(c?.cnpj ? formatarCnpj(c.cnpj) : "");
  return (
    <Modal titulo={c ? "Editar cliente" : "Novo cliente"} aoFechar={aoFechar}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          iniciar(async () => {
            const r = c ? await editarCliente(form) : await criarCliente(form);
            if (r.erro) setErro({ texto: r.erro, campo: r.campo });
            else aoSalvar(r);
          });
        }}
      >
        {c && <input type="hidden" name="id" value={c.id} />}
        <div className={`field ${erro?.campo === "nome" ? "campo-erro" : ""}`}>
          <label htmlFor="cl-nome">Nome</label>
          <input id="cl-nome" name="nome" defaultValue={c?.nome} maxLength={160} autoFocus required />
        </div>
        <div className={`field ${erro?.campo === "cnpj" ? "campo-erro" : ""}`}>
          <label htmlFor="cl-cnpj">
            CNPJ <small>(opcional; aceita o CNPJ alfanumérico)</small>
          </label>
          <input
            id="cl-cnpj"
            name="cnpj"
            className="mono"
            value={cnpj}
            onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            autoComplete="off"
            maxLength={18}
          />
        </div>
        <div className={`field ${erro?.campo === "codigoInterno" ? "campo-erro" : ""}`}>
          <label htmlFor="cl-cod">
            Código interno <small>(opcional, o do sistema contábil)</small>
          </label>
          <input id="cl-cod" name="codigoInterno" defaultValue={c?.codigoInterno ?? ""} maxLength={40} />
        </div>
        {c && (
          <label className="check-inline">
            <input type="checkbox" name="ativo" defaultChecked={c.ativo} /> Ativo
          </label>
        )}
        {erro && (
          <p className="err" role="alert">
            {erro.texto}
          </p>
        )}
        <Rodape salvando={salvando} aoFechar={aoFechar} />
      </form>
    </Modal>
  );
}

function ModalJuntar({ origem, lista, aoFechar, aoSalvar }: { origem: ClienteLinha; lista: ClienteLinha[]; aoFechar: () => void; aoSalvar: (r: ResultadoCliente) => void }) {
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const outros = lista.filter((c) => c.id !== origem.id);
  return (
    <Modal titulo={`Juntar "${origem.nome}"`} aoFechar={aoFechar}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          iniciar(async () => {
            const r = await juntarClientes(form);
            if (r.erro) setErro(r.erro);
            else aoSalvar(r);
          });
        }}
      >
        <input type="hidden" name="origemId" value={origem.id} />
        <p className="suave">
          Use quando o mesmo cliente foi cadastrado duas vezes. {origem.rncs ? `As ${origem.rncs} RNC(s) de "${origem.nome}"` : "As RNCs"} passam para o
          cliente escolhido, cada uma com um registro no histórico, e &quot;{origem.nome}&quot; é removido.
        </p>
        <div className="field">
          <label htmlFor="j-destino">Cliente certo</label>
          <select id="j-destino" name="destinoId" defaultValue="" required>
            <option value="" disabled>
              Escolha o cliente
            </option>
            {outros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.cnpj ? ` (${formatarCnpj(c.cnpj)})` : c.codigoInterno ? ` (cód. ${c.codigoInterno})` : ""}
                {c.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </div>
        {erro && (
          <p className="err" role="alert">
            {erro}
          </p>
        )}
        <Rodape salvando={salvando} aoFechar={aoFechar} rotulo="Juntar" />
      </form>
    </Modal>
  );
}
