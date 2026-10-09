import type { Metadata } from "next";
import Link from "next/link";
import { FormSenha } from "@/components/FormSenha";
import { TelaEntrada } from "@/components/TelaEntrada";
import { buscarTokenValido } from "@/lib/auth/convites";
import { definirSenha } from "./actions";

export const metadata: Metadata = { title: "Definir senha" };

export default async function PaginaConvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const registro = await buscarTokenValido(token);

  return (
    <TelaEntrada>
      {registro ? (
        <>
          <h2>{registro.tipo === "convite" ? `Boas-vindas, ${registro.usuario.nome.split(" ")[0]}` : "Nova senha"}</h2>
          <p className="sub">
            Crie a senha para entrar com <strong>{registro.usuario.email}</strong>.
          </p>
          <FormSenha acao={definirSenha} token={token} textoBotao="Salvar e entrar" />
        </>
      ) : (
        <>
          <h2>Link expirado ou já usado</h2>
          <p className="sub">Cada link de acesso vale uma vez só e por tempo limitado. Peça um novo à gestão da qualidade.</p>
          <Link href="/login" className="btn">
            Ir para o login
          </Link>
        </>
      )}
    </TelaEntrada>
  );
}
