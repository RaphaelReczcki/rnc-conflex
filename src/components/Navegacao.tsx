"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; rotulo: string };

// Faixa de módulos (padrão e-LALUR): itens à esquerda, "Registrar RNC" à direita.
export function Navegacao({ itens }: { itens: Item[] }) {
  const caminho = usePathname();
  const atual = (href: string) =>
    href === "/" ? caminho === "/" : caminho.startsWith(href) || (href === "/registros" && caminho.startsWith("/rncs/"));
  return (
    <nav className="menu-modulos" aria-label="Módulos">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} className="modulo" aria-current={atual(i.href) ? "page" : undefined}>
          {i.rotulo}
        </Link>
      ))}
      <span className="menu-espaco" />
      <Link href="/registrar" className="registrar" aria-current={atual("/registrar") ? "page" : undefined}>
        + Registrar<span className="so-desktop"> RNC</span>
      </Link>
    </nav>
  );
}

// Link da barra do usuário, sublinhado quando a página atual é dele.
export function LinkAtivo({ href, children }: { href: string; children: React.ReactNode }) {
  const caminho = usePathname();
  return (
    <Link href={href} aria-current={caminho.startsWith(href) ? "page" : undefined}>
      {children}
    </Link>
  );
}
