"use client";

import { useState, useTransition } from "react";
import { criarUsuario, editarUsuario, redefinirSenha, type ResultadoUsuario } from "./actions";
import { ImportarUsuarios } from "./ImportarUsuarios";

type Perfil = "colaborador" | "lider_setor" | "gestao";
const PERFIS: Record<Perfil, string> = { colaborador: "Colaborador", lider_setor: "Líder de setor", gestao: "Gestão da qualidade" };

export type UsuarioLinha = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  setorId: string | null;
  setor: string | null;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ultimoAcesso: string | null;
};

type Credencial = { nome: string; email: string; senha: string; quando: string };

export function Usuarios({ lista, setores, meuId, endereco }: { lista: UsuarioLinha[]; setores: { id: string; nome: string }[]; meuId: string; endereco: string }) {
  const [editando, setEditando] = useState<UsuarioLinha | "novo" | null>(null);
  const [senhaDe, setSenhaDe] = useState<UsuarioLinha | null>(null);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState("");
  // Senhas geradas nesta tela: ficam visíveis até a gestão fechar o quadro.
  // Só vale a mais recente de cada pessoa.
  const [credenciais, setCredenciais] = useState<Credencial[]>([]);

  function guardarCredenciais(novas: { nome: string; email: string; senha: string }[]) {
    const quando = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const emails = new Set(novas.map((n) => n.email));
    setCredenciais((l) => [...novas.map((n) => ({ ...n, quando })), ...l.filter((x) => !emails.has(x.email))]);
  }
  function registrar(r: ResultadoUsuario) {
    if (r.ok) setAviso(r.ok);
    if (r.credencial) guardarCredenciais([r.credencial]);
  }
  const texto = (c: Credencial) => `Acesso ao sistema de não conformidades: ${endereco} | e-mail: ${c.email} | senha provisória: ${c.senha} (troque no primeiro acesso)`;
  const copiar = (t: string) => navigator.clipboard?.writeText(t).catch(() => {});

  return (
    <>
      <div className="titulo-pagina">
        <p className="suave">Cada pessoa tem o próprio acesso: o histórico das RNCs registra quem fez cada passo.</p>
        <div className="linha-acoes">
          <button type="button" className="btn" onClick={() => setImportando(true)}>
            Importar planilha
          </button>
          <button type="button" className="btn primary" onClick={() => setEditando("novo")}>
            + Novo usuário
          </button>
        </div>
      </div>
      {aviso && (
        <p className="notice ok" role="status">
          {aviso}
        </p>
      )}

      {credenciais.length > 0 && (
        <section className="panel painel-credenciais">
          <div className="painel-titulo">
            <h3>Senhas provisórias para repassar</h3>
            <div className="linha-acoes">
              <button type="button" className="btn small" onClick={() => copiar(credenciais.map(texto).join("\n"))}>
                Copiar todas
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => confirm("Fechar o quadro? As senhas não poderão ser vistas de novo, só redefinidas.") && setCredenciais([])}
              >
                Fechar
              </button>
            </div>
          </div>
          <table className="tabela">
            <tbody>
              {credenciais.map((c) => (
                <tr key={c.email}>
                  <td>{c.nome}</td>
                  <td>{c.email}</td>
                  <td className="mono forte">{c.senha}</td>
                  <td className="suave">{c.quando}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn small" onClick={() => copiar(texto(c))}>
                      Copiar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ajuda">
            Endereço para os colegas: <span className="mono">{endereco}</span>. Vale só a senha mais recente de cada pessoa: redefinir de novo gera outra e
            invalida a anterior. A pessoa troca a senha no primeiro acesso.
          </p>
        </section>
      )}

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th className="col-opcional">E-mail</th>
              <th>Perfil</th>
              <th>Situação</th>
              <th className="col-opcional">Último acesso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className={u.ativo ? "" : "inativo"}>
                <td>
                  {u.nome}
                  {u.id === meuId && <span className="pill" style={{ marginLeft: 6 }}>você</span>}
                  <span className="sub so-celular">{u.email}</span>
                </td>
                <td className="col-opcional">{u.email}</td>
                <td>
                  {PERFIS[u.perfil]}
                  {u.setor && <span className="sub">{u.setor}</span>}
                </td>
                <td>
                  <span className={`pill ${u.ativo ? "ativo" : "off"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                  {u.ativo && u.deveTrocarSenha && <span className="sub">{u.ultimoAcesso ? "senha provisória" : "aguardando primeiro acesso"}</span>}
                </td>
                <td className="col-opcional suave">{u.ultimoAcesso ?? "nunca"}</td>
                <td>
                  <div className="linha-acoes" style={{ justifyContent: "flex-end" }}>
                    {u.id !== meuId && u.ativo && (
                      <button type="button" className="btn small" onClick={() => setSenhaDe(u)}>
                        Redefinir senha
                      </button>
                    )}
                    <button type="button" className="btn small" onClick={() => setEditando(u)}>
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ajuda">
        Colaborador: registra RNCs e trata as que estão sob sua responsabilidade. Líder de setor: trata as RNCs do seu setor e conclui análises e
        verificações. Gestão da qualidade: tudo, inclusive usuários, exportação e e-mails. Ninguém é apagado: quem sai da equipe é desativado e
        continua no histórico.
      </p>

      {editando && (
        <ModalUsuario
          usuario={editando === "novo" ? null : editando}
          setores={setores}
          aoFechar={() => setEditando(null)}
          aoSalvar={(r) => {
            setEditando(null);
            registrar(r);
          }}
        />
      )}
      {importando && (
        <ImportarUsuarios
          aoFechar={() => setImportando(false)}
          aoImportar={(r) => {
            setImportando(false);
            const s = r.resumo!;
            setAviso(
              `Importação concluída: ${s.criadas} ${s.criadas === 1 ? "pessoa nova" : "pessoas novas"}, ${s.atualizadas} ${s.atualizadas === 1 ? "atualizada" : "atualizadas"}, ${s.ignoradas} ${s.ignoradas === 1 ? "ignorada" : "ignoradas"}${s.comErro ? `, ${s.comErro} com erro (não importadas)` : ""}.${s.criadas ? " As senhas provisórias estão no quadro abaixo." : ""}`,
            );
            guardarCredenciais(r.credenciais ?? []);
          }}
        />
      )}
      {senhaDe && (
        <ModalSenha
          usuario={senhaDe}
          aoFechar={() => setSenhaDe(null)}
          aoSalvar={(r) => {
            setSenhaDe(null);
            registrar(r);
          }}
        />
      )}
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

function ModalUsuario({
  usuario: u,
  setores,
  aoFechar,
  aoSalvar,
}: {
  usuario: UsuarioLinha | null;
  setores: { id: string; nome: string }[];
  aoFechar: () => void;
  aoSalvar: (r: ResultadoUsuario) => void;
}) {
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const marca = (campo: string) => (erro?.campo === campo ? "campo-erro" : "");

  return (
    <Modal titulo={u ? "Editar usuário" : "Novo usuário"} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          iniciar(async () => {
            const r = u ? await editarUsuario(form) : await criarUsuario(form);
            if (r.erro) setErro({ texto: r.erro, campo: r.campo });
            else aoSalvar(r);
          });
        }}
        noValidate
      >
        {u && <input type="hidden" name="id" value={u.id} />}
        <div className={`field ${marca("nome")}`}>
          <label htmlFor="u-nome">Nome</label>
          <input id="u-nome" name="nome" defaultValue={u?.nome} maxLength={120} autoFocus required />
        </div>
        <div className={`field ${marca("email")}`}>
          <label htmlFor="u-email">E-mail (login)</label>
          <input id="u-email" name="email" type="email" defaultValue={u?.email} placeholder="nome@conflex.com.br" required />
        </div>
        <div className="fields">
          <div className={`field ${marca("perfil")}`}>
            <label htmlFor="u-perfil">Perfil</label>
            <select id="u-perfil" name="perfil" defaultValue={u?.perfil ?? "colaborador"}>
              {(Object.keys(PERFIS) as Perfil[]).map((p) => (
                <option key={p} value={p}>
                  {PERFIS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className={`field ${marca("setorId")}`}>
            <label htmlFor="u-setor">Setor</label>
            <select id="u-setor" name="setorId" defaultValue={u?.setorId ?? ""}>
              <option value="">Sem setor</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {u ? (
          <label className="check-inline" style={{ marginTop: 12 }}>
            <input type="checkbox" name="ativo" defaultChecked={u.ativo} /> Ativo
          </label>
        ) : (
          <p className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
            O sistema gera uma senha provisória ao salvar. Ela aparece no quadro de senhas para repassar, e a pessoa troca no primeiro acesso.
          </p>
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
    </Modal>
  );
}

function ModalSenha({ usuario, aoFechar, aoSalvar }: { usuario: UsuarioLinha; aoFechar: () => void; aoSalvar: (r: ResultadoUsuario) => void }) {
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  return (
    <Modal titulo={`Redefinir senha de ${usuario.nome}`} aoFechar={aoFechar}>
      <p className="suave">
        O sistema gera uma nova senha provisória. A senha anterior, inclusive outra provisória já repassada, <strong>deixa de valer</strong>. As
        sessões abertas de {usuario.nome.split(" ")[0]} são encerradas, o bloqueio por tentativas erradas é liberado e a pessoa define uma senha
        pessoal no próximo acesso.
      </p>
      {erro && (
        <p className="err" role="alert">
          {erro}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={salvando}
          onClick={() => {
            const form = new FormData();
            form.set("id", usuario.id);
            iniciar(async () => {
              const r = await redefinirSenha(form);
              if (r.erro) setErro(r.erro);
              else aoSalvar(r);
            });
          }}
        >
          {salvando ? "Redefinindo…" : "Redefinir"}
        </button>
      </div>
    </Modal>
  );
}
