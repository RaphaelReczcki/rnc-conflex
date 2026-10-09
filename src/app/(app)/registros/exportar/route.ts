import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeExportar } from "@/lib/auth/permissoes";
import { hojeEmBrasilia } from "@/lib/datas";
import { lerFiltros } from "@/lib/rnc/filtros";
import { exportarRegistros } from "@/lib/rnc/exportacao";

// GET /registros/exportar?q=&etapa=&setor=&sev= → CSV com os mesmos filtros da lista
export async function GET(req: NextRequest) {
  const usuario = await obterUsuarioAtual();
  if (!usuario || usuario.deveTrocarSenha) return NextResponse.redirect(new URL("/login", req.url));
  if (!podeExportar(usuario)) {
    return new NextResponse("A exportação é feita pela gestão da qualidade.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const filtros = lerFiltros(Object.fromEntries(req.nextUrl.searchParams));
  const { csv } = await exportarRegistros(filtros);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rnc-conflex-${hojeEmBrasilia()}.csv"`,
      // Dados de clientes: não guardar em cache de navegador ou de proxy
      "Cache-Control": "no-store, private",
    },
  });
}
