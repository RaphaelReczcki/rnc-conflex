import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/auth/sessao";
import { FormSenha } from "@/components/FormSenha";
import { trocarSenha } from "./actions";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function PaginaSenha() {
  const usuario = await exigirUsuario({ permitirTrocaPendente: true });
  return (
    <section className="card" style={{ maxWidth: 520 }}>
      <h2>{usuario.deveTrocarSenha ? "Crie a sua senha" : "Trocar senha"}</h2>
      <p className="sub">
        {usuario.deveTrocarSenha
          ? "Este é o seu primeiro acesso com uma senha provisória. Escolha uma senha só sua para continuar."
          : "Depois da troca, as sessões abertas em outros aparelhos são encerradas."}
      </p>
      <FormSenha acao={trocarSenha} pedirSenhaAtual textoBotao="Salvar senha" />
    </section>
  );
}
