"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin/usuarios", rotulo: "Usuários" },
  { href: "/admin/clientes", rotulo: "Clientes" },
  { href: "/admin/emails", rotulo: "E-mails" },
];

export function SubnavAdmin() {
  const caminho = usePathname();
  return (
    <nav className="subnav" aria-label="Administração">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href} aria-current={caminho.startsWith(a.href) ? "page" : undefined}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
