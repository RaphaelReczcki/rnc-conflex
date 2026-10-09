import Link from "next/link";

export default function RncNaoEncontrada() {
  return (
    <>
      <Link href="/registros" className="back">
        ← Voltar para registros
      </Link>
      <p className="empty">Não encontramos uma RNC com este código. Confira o código ou procure na lista de registros.</p>
    </>
  );
}
