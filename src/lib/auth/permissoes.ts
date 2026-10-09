// Quem pode fazer o quê. Funções puras: recebem o usuário e a RNC e
// respondem sim ou não. A interface usa para mostrar ou esconder botões;
// as ações do servidor usam de novo antes de gravar.

export type Perfil = "colaborador" | "lider_setor" | "gestao";

export const PERFIS: Record<Perfil, { rotulo: string; descricao: string }> = {
  colaborador: {
    rotulo: "Colaborador",
    descricao: "Registra RNCs e trata as que estão sob sua responsabilidade.",
  },
  lider_setor: {
    rotulo: "Líder de setor",
    descricao: "Trata qualquer RNC do seu setor e conclui análises e verificações.",
  },
  gestao: {
    rotulo: "Gestão da qualidade",
    descricao: "Acesso total: painel consolidado, exportação e cadastros.",
  },
};

export type UsuarioAcesso = {
  id: string;
  perfil: Perfil;
  setorId: string | null;
  ativo: boolean;
};

export type RncAcesso = {
  setorId: string;
  autorId: string;
  // Responsável pela ação corretiva do ciclo atual, se já definido
  responsavelAcaoId: string | null;
};

const ativo = (u: UsuarioAcesso | null | undefined): u is UsuarioAcesso => !!u && u.ativo;

export function ehGestao(u: UsuarioAcesso | null | undefined): boolean {
  return ativo(u) && u.perfil === "gestao";
}

export function ehLiderDoSetor(u: UsuarioAcesso | null | undefined, setorId: string): boolean {
  return ativo(u) && u.perfil === "lider_setor" && u.setorId === setorId;
}

// "Sob sua responsabilidade": quem registrou ou quem responde pela ação.
export function ehResponsavel(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return ativo(u) && (rnc.autorId === u.id || rnc.responsavelAcaoId === u.id);
}

const gestaoOuLider = (u: UsuarioAcesso | null | undefined, rnc: RncAcesso) =>
  ehGestao(u) || ehLiderDoSetor(u, rnc.setorId);

export function podeRegistrarRnc(u: UsuarioAcesso | null | undefined): boolean {
  return ativo(u);
}

// Preencher e salvar rascunho da análise de causa
export function podeEditarAnalise(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return gestaoOuLider(u, rnc) || ehResponsavel(u, rnc);
}

export function podeConcluirAnalise(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return gestaoOuLider(u, rnc);
}

// Preencher e salvar rascunho da ação corretiva
export function podeEditarAcao(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return gestaoOuLider(u, rnc) || ehResponsavel(u, rnc);
}

export function podeConcluirAcao(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return gestaoOuLider(u, rnc) || (ativo(u) && rnc.responsavelAcaoId === u.id);
}

export function podeVerificar(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return gestaoOuLider(u, rnc);
}

// Multas, juros e horas de retrabalho, editáveis depois do registro
export function podeEditarImpacto(u: UsuarioAcesso | null | undefined, rnc: RncAcesso): boolean {
  return gestaoOuLider(u, rnc) || ehResponsavel(u, rnc);
}

export function podeGerenciarUsuarios(u: UsuarioAcesso | null | undefined): boolean {
  return ehGestao(u);
}

export function podeGerenciarCadastros(u: UsuarioAcesso | null | undefined): boolean {
  return ehGestao(u);
}

export function podeExportar(u: UsuarioAcesso | null | undefined): boolean {
  return ehGestao(u);
}
