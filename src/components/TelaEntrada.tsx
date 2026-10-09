import { BotaoTema } from "./BotaoTema";

// Telas fora do sistema (login, convite), no padrão do e-LALUR:
// marca à esquerda, formulário à direita. No celular, só o formulário.
export function TelaEntrada({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-tela">
      <aside className="login-marca">
        <img src="/marca/logo-conflex-branco.png" alt="Conflex assessoria contábil" width={727} height={214} />
        <div className="login-chamada">
          <h1>Não conformidades</h1>
          <ul>
            <li>Registre erros, atrasos e falhas de processo assim que perceber</li>
            <li>Análise de causa, ação corretiva e verificação de eficácia</li>
            <li>Indicadores para melhorar o processo, não para apontar culpados</li>
          </ul>
        </div>
        <span className="login-rodape">Uso interno · Conflex assessoria contábil</span>
      </aside>

      <main className="login-formulario">
        <div className="login-tema">
          <BotaoTema />
        </div>
        <div className="login">
          <span className="login-logo-movel">
            <img className="logo-claro" src="/marca/logo-conflex.png" alt="Conflex" width={150} height={44} />
            <img className="logo-escuro" src="/marca/logo-conflex-branco.png" alt="Conflex" width={150} height={44} />
          </span>
          {children}
        </div>
      </main>
    </div>
  );
}
