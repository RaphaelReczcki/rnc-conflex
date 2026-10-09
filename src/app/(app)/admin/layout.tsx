import { exigirGestao } from "@/lib/auth/sessao";
import { SubnavAdmin } from "./SubnavAdmin";

// Administração (padrão e-LALUR): só a gestão da qualidade.
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirGestao();
  return (
    <section>
      <div className="titulo-pagina">
        <h1>Administração</h1>
      </div>
      <SubnavAdmin />
      {children}
    </section>
  );
}
