import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAtual } from "@/lib/auth/sessao";
import { podeGerenciarUsuarios } from "@/lib/auth/permissoes";
import { gerarModeloUsuarios } from "@/lib/importacao/importar-usuarios";

// GET /admin/usuarios/modelo → planilha modelo para importar usuários
export async function GET(req: NextRequest) {
  const usuario = await obterUsuarioAtual();
  if (!usuario || usuario.deveTrocarSenha) return NextResponse.redirect(new URL("/login", req.url));
  if (!podeGerenciarUsuarios(usuario)) return new NextResponse("Só a gestão da qualidade importa usuários.", { status: 403 });
  return new NextResponse(new Uint8Array(await gerarModeloUsuarios()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-usuarios.xlsx"',
      "Cache-Control": "no-store, private",
    },
  });
}
