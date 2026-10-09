import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { TelaEntrada } from "@/components/TelaEntrada";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  if (await obterUsuarioAtual()) redirect("/");
  return (
    <TelaEntrada>
      <h2>Entrar</h2>
      <p className="sub">Use o seu e-mail da Conflex e a senha que você criou.</p>
      <FormLogin />
      <p className="ajuda">Esqueceu a senha ou ainda não tem acesso? Peça um link à gestão da qualidade.</p>
    </TelaEntrada>
  );
}
