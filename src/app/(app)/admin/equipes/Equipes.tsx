"use client";

import { useState, useTransition } from "react";
import { criarEquipe, editarEquipe, type ResultadoEquipe } from "./actions";

export type EquipeLinha = { id: string; nome: string; liderId: string; lider: string; ativo: boolean; membros: string[] };
export type LiderOpcao = { id: string; nome: string; perfil: string; setor: string | null };

export function Equipes({ lista, lideres }: { lista: EquipeLinha[]; lideres: LiderOpcao[] }) {
  const [editando, setEditando] = useState<EquipeLinha | "nova" | null>(null);
  const [aviso, setAviso] = useState("");

  return (
    <>
      <div className="titulo-pagina">
        <p className="suave">
          O líder de cada equipe vê as RNCs registradas pelas pessoas da equipe, ou com ação delas, mesmo em outro setor. A pessoa entra na equipe em
          Usuários → Editar.
        </p>
        <button type="button" className="btn primary" onClick={() => setEditando("nova")}>
          + Nova equipe
        </button>
      </div>
      {aviso && (
        <p className="notice ok" role="status">
          {aviso}
        </p>
      )}
      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Equipe</th>
              <th>Líder</th>
              <th>Pessoas</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length ? (
              lista.map((e) => (
                <tr key={e.id} className={e.ativo ? "" : "inativo"}>
                  <td>{e.nome}</td>
                  <td>{e.lider}</td>
                  <td>
                    {e.membros.length}
                    {e.membros.length > 0 && <span className="sub">{e.membros.slice(0, 4).join(", ") + (e.membros.length > 4 ? ` e mais ${e.membros.length - 4}` : "")}</span>}
                  </td>
                  <td>
                    <span className={`pill ${e.ativo ? "ativo" : "off"}`}>{e.ativo ? "Ativa" : "Inativa"}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn small" onClick={() => setEditando(e)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="empty">
                  Nenhuma equipe ainda. Crie as equipes e depois coloque cada pessoa na sua, em Usuários.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="ajuda">
        Quem vê o quê: o colaborador vê só as RNCs dele; o líder de setor vê as do setor dele e as da equipe dele; a gestão vê todas.
      </p>

      {editando && (
        <ModalEquipe
          equipe={editando === "nova" ? null : editando}
          lideres={lideres}
          aoFechar={() => setEditando(null)}
          aoSalvar={(r) => {
            setEditando(null);
            if (r.ok) setAviso(r.ok);
          }}
        />
      )}
    </>
  );
}

function ModalEquipe({ equipe: e, lideres, aoFechar, aoSalvar }: { equipe: EquipeLinha | null; lideres: LiderOpcao[]; aoFechar: () => void; aoSalvar: (r: ResultadoEquipe) => void }) {
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={e ? "Editar equipe" : "Nova equipe"} onClick={(ev) => ev.stopPropagation()}>
        <h2>{e ? "Editar equipe" : "Nova equipe"}</h2>
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            const form = new FormData(ev.currentTarget);
            iniciar(async () => {
              const r = e ? await editarEquipe(form) : await criarEquipe(form);
              if (r.erro) setErro({ texto: r.erro, campo: r.campo });
              else aoSalvar(r);
            });
          }}
        >
          {e && <input type="hidden" name="id" value={e.id} />}
          <div className={`field ${erro?.campo === "nome" ? "campo-erro" : ""}`}>
            <label htmlFor="eq-nome">Nome</label>
            <input id="eq-nome" name="nome" defaultValue={e?.nome} maxLength={80} placeholder="Ex.: Fiscal – Equipe Ana" autoFocus required />
          </div>
          <div className={`field ${erro?.campo === "liderId" ? "campo-erro" : ""}`}>
            <label htmlFor="eq-lider">Líder</label>
            <select id="eq-lider" name="liderId" defaultValue={e?.liderId ?? ""} required>
              <option value="" disabled>
                Escolha o líder
              </option>
              {lideres.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} ({l.perfil === "gestao" ? "gestão" : "líder"}
                  {l.setor ? `, ${l.setor}` : ""})
                </option>
              ))}
            </select>
            <small>Só aparecem pessoas com perfil Líder de setor ou Gestão.</small>
          </div>
          {e && (
            <label className="check-inline">
              <input type="checkbox" name="ativo" defaultChecked={e.ativo} /> Ativa
            </label>
          )}
          {erro && (
            <p className="err" role="alert">
              {erro.texto}
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn" onClick={aoFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
