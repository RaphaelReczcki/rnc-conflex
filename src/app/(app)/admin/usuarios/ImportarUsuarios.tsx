"use client";

import { useState, useTransition } from "react";
import type { LinhaAnalisada } from "@/lib/importacao/usuarios";
import { analisarImportacao, executarImportacao, type ResultadoImportacao } from "./actions";

const ACAO: Record<LinhaAnalisada["acao"], { rotulo: string; classe: string }> = {
  criar: { rotulo: "Novo", classe: "ativo" },
  atualizar: { rotulo: "Atualizar", classe: "atencao" },
  ignorar: { rotulo: "Ignorar", classe: "off" },
  erro: { rotulo: "Erro", classe: "erro" },
};
const PERFIL: Record<string, string> = { colaborador: "Colaborador", lider_setor: "Líder de setor", gestao: "Gestão da qualidade" };

// Importação de usuários: baixar modelo → validar (prévia, nada é gravado) → importar.
export function ImportarUsuarios({ aoFechar, aoImportar }: { aoFechar: () => void; aoImportar: (r: ResultadoImportacao) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [atualizar, setAtualizar] = useState(false);
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState("");
  const [soProblemas, setSoProblemas] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const montar = (f: File, atu: boolean) => {
    const form = new FormData();
    form.set("arquivo", f);
    if (atu) form.set("atualizar", "on");
    return form;
  };
  const validar = (f: File, atu: boolean) =>
    iniciar(async () => {
      setErro("");
      setPrevia(null);
      const r = await analisarImportacao(montar(f, atu));
      if (r.erro) setErro(r.erro);
      else setPrevia(r);
    });
  const importar = () =>
    iniciar(async () => {
      setErro("");
      const r = await executarImportacao(montar(arquivo!, atualizar));
      if (r.erro) setErro(r.erro);
      else aoImportar(r);
    });

  const resumo = previa?.resumo;
  const aGravar = (resumo?.criadas ?? 0) + (resumo?.atualizadas ?? 0);
  const visiveis = (previa?.linhas ?? []).filter((l) => !soProblemas || l.acao === "erro" || l.mensagens.length > 0);

  return (
    <div className="modal-fundo">
      <div className="modal modal-largo" role="dialog" aria-modal="true" aria-label="Importar usuários">
        <h2>Importar usuários da planilha</h2>
        <ol className="passos">
          <li>
            Baixe o modelo, preencha uma pessoa por linha e salve.{" "}
            <a href="/admin/usuarios/modelo" download>
              Baixar modelo (.xlsx)
            </a>
            <div className="ajuda" style={{ marginTop: 4 }}>
              Colunas: Nome e E-mail (obrigatórios), Perfil e Setor. Também aceita CSV com essas colunas no cabeçalho.
            </div>
          </li>
          <li>
            Escolha o arquivo para validar. Nada é gravado nesta etapa.
            <div className="linha-acoes" style={{ marginTop: 8, alignItems: "center" }}>
              <input
                type="file"
                accept=".xlsx,.csv"
                aria-label="Planilha de usuários"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setArquivo(f);
                  if (f) validar(f, atualizar);
                }}
              />
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={atualizar}
                  onChange={(e) => {
                    setAtualizar(e.target.checked);
                    if (arquivo) validar(arquivo, e.target.checked);
                  }}
                />
                Atualizar nome, perfil e setor de quem já está cadastrado
              </label>
            </div>
          </li>
          <li>Confira a prévia e clique em Importar. Cada pessoa nova recebe uma senha provisória para você repassar.</li>
        </ol>

        {ocupado && <p className="suave">Processando a planilha…</p>}
        {erro && (
          <p className="err" role="alert">
            {erro}
          </p>
        )}

        {previa && resumo && (
          <>
            <div className="resumo-importacao" role="status">
              <span className="pill ativo">{resumo.criadas} novos</span>
              <span className="pill atencao">{resumo.atualizadas} a atualizar</span>
              <span className="pill off">{resumo.ignoradas} ignorados</span>
              <span className={`pill ${resumo.comErro ? "erro" : "off"}`}>{resumo.comErro} com erro</span>
              <label className="check-inline" style={{ marginLeft: "auto" }}>
                <input type="checkbox" checked={soProblemas} onChange={(e) => setSoProblemas(e.target.checked)} /> Só linhas com aviso ou erro
              </label>
            </div>
            <div className="tabela-wrap tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Pessoa</th>
                    <th>Perfil e setor</th>
                    <th>O que acontece</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => (
                    <tr key={l.linha}>
                      <td className="suave">{l.linha}</td>
                      <td>
                        {l.nome || "—"}
                        <span className="sub">{l.email || "sem e-mail"}</span>
                      </td>
                      <td>
                        {l.perfil ? PERFIL[l.perfil] : "—"}
                        {l.setor && <span className="sub">{l.setor}</span>}
                      </td>
                      <td>
                        <span className={`pill ${ACAO[l.acao].classe}`}>{ACAO[l.acao].rotulo}</span>
                        {l.mensagens.map((m) => (
                          <span key={m} className={`sub ${l.acao === "erro" ? "texto-erro" : ""}`}>
                            {m}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resumo.comErro > 0 && <p className="ajuda">As linhas com erro não serão importadas. Corrija a planilha e escolha o arquivo de novo, ou importe só as outras.</p>}
          </>
        )}

        <div className="actions">
          <button type="button" className="btn" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="btn primary" disabled={ocupado || !aGravar} onClick={importar}>
            {aGravar ? `Importar ${aGravar} ${aGravar === 1 ? "pessoa" : "pessoas"}` : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
