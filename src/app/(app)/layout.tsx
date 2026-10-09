import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { PERFIS, ehGestao } from "@/lib/auth/permissoes";
import { BotaoTema } from "@/components/BotaoTema";
import { Logo } from "@/components/Logo";
import { LinkAtivo, Navegacao } from "@/components/Navegacao";
import { sair } from "../login/actions";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  // Cada página e ação confere a sessão de novo; aqui é só para montar o cabeçalho.
  const usuario = await exigirUsuario({ permitirTrocaPendente: true });
  const itens = [
    { href: "/", rotulo: "Painel" },
    { href: "/registros", rotulo: "Registros" },
  ];

  return (
    <>
      <header className="cabecalho">
        {/* Barra da marca: logo Conflex + usuário */}
        <div className="barra-marca">
          <Link href="/" className="marca" title="Ir para o painel">
            <Logo />
            <span className="marca-produto">
              Não conformidades
              <small>RNC · melhoria de processos</small>
            </span>
          </Link>

          <div className="usuario">
            <span className="usuario-nome" title={usuario.email}>
              <span className="avatar" aria-hidden="true">
                {usuario.nome.trim()[0]?.toUpperCase()}
              </span>
              <span className="nome-completo">
                {usuario.nome}{" "}
                <small>
                  · {PERFIS[usuario.perfil].rotulo}
                  {usuario.setor ? `, ${usuario.setor.nome}` : ""}
                </small>
              </span>
            </span>
            {!usuario.deveTrocarSenha && ehGestao(usuario) && <LinkAtivo href="/admin">Administração</LinkAtivo>}
            {!usuario.deveTrocarSenha && <LinkAtivo href="/conta/senha">Alterar senha</LinkAtivo>}
            <form action={sair}>
              <button type="submit" className="linkbtn">
                Sair
              </button>
            </form>
            <BotaoTema />
          </div>
        </div>

        {/* Faixa de módulos */}
        {!usuario.deveTrocarSenha && (
          <div className="faixa-modulos">
            <Navegacao itens={itens} />
          </div>
        )}
      </header>
      <div className="wrap">
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}
