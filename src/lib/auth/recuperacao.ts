import "server-only";
import { prisma } from "@/lib/db";
import { emailRedefinicaoSenha } from "@/lib/email/modelos";
import { transportePadrao, type Transporte } from "@/lib/email/transporte";
import { urlSistema } from "@/lib/notificacoes/fila";
import { MAX_TENTATIVAS } from "@/lib/notificacoes/regras";
import { criarLinkSenha } from "./convites";

export const VALIDADE_HORAS_RECUPERACAO = 1;
export const LIMITE_PEDIDOS_POR_HORA = 3;

// Mensagem igual para todos: não revela se o e-mail está cadastrado.
export const MENSAGEM_PEDIDO =
  "Se este e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o lixo eletrônico.";

export type ResultadoPedido = "enviado" | "ignorado" | "limite" | "falhou";

// "Esqueci minha senha": cria um link de 1 hora (o anterior deixa de valer) e
// envia direto por e-mail. O link não fica guardado no banco: o registro do
// envio guarda o e-mail sem ele.
export async function solicitarRedefinicao(emailInformado: string, transporte?: Transporte | null): Promise<ResultadoPedido> {
  const email = emailInformado.trim().toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) return "ignorado";

  const umaHora = new Date(Date.now() - 3_600_000);
  const recentes = await prisma.tokenSenha.count({ where: { usuarioId: usuario.id, tipo: "redefinicao", criadoPorId: null, criadoEm: { gte: umaHora } } });
  if (recentes >= LIMITE_PEDIDOS_POR_HORA) return "limite";

  const { token } = await criarLinkSenha(usuario.id, "redefinicao", null, VALIDADE_HORAS_RECUPERACAO);
  const link = urlSistema(`/convite/${token}`);
  const email_ = emailRedefinicaoSenha({ para: usuario.nome, link });

  let status: "enviada" | "falhou" = "enviada";
  let erro: string | null = null;
  try {
    const t = transporte === undefined ? transportePadrao() : transporte;
    if (!t) throw new Error("Envio de e-mails desligado (EMAIL_MODO=desligado).");
    await t.enviar({ para: [usuario.email], assunto: email_.assunto, html: email_.html, texto: email_.texto, referencia: "redefinicao_senha" });
  } catch (e) {
    status = "falhou";
    erro = (e instanceof Error ? e.message : String(e)).slice(0, 500);
  }

  // Registro para a gestão acompanhar em Administração → E-mails (sem o link)
  const semLink = (t: string) => t.split(link).join("[link de uso único, não guardado]");
  await prisma.notificacao.create({
    data: {
      chave: `redefinicao_senha:${usuario.id}:${Date.now()}`,
      tipo: "redefinicao_senha",
      assunto: email_.assunto,
      html: semLink(email_.html),
      texto: semLink(email_.texto),
      status,
      // Falha não volta para a fila (o e-mail guardado está sem o link)
      tentativas: status === "falhou" ? MAX_TENTATIVAS : 1,
      ultimoErro: erro,
      enviadaEm: status === "enviada" ? new Date() : null,
      // Não reenviar pela fila: sem o link, o e-mail não serviria
      proximaTentativaEm: new Date(Date.now() + 365 * 86_400_000),
      destinatarios: { create: [{ usuarioId: usuario.id, email: usuario.email }] },
    },
  });
  return status === "enviada" ? "enviado" : "falhou";
}
