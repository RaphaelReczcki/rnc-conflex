import type { Metadata } from "next";
import { TelaEntrada } from "@/components/TelaEntrada";
import { FormEsqueci } from "./FormEsqueci";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueci() {
  return (
    <TelaEntrada>
      <h2>Esqueci minha senha</h2>
      <p className="sub">Informe o e-mail que você usa para entrar. Enviaremos um link para criar uma nova senha.</p>
      <FormEsqueci />
    </TelaEntrada>
  );
}
