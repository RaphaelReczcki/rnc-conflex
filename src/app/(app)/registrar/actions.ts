"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth/sessao";
import { podeRegistrarRnc } from "@/lib/auth/permissoes";
import { CAMPOS_REGISTRO, esquemaRegistro, type ValoresRegistro } from "@/lib/rnc/validacao";
import { ErroRegistro, registrarRnc } from "@/lib/rnc/registro";

export type EstadoRegistro = { erro?: string; campo?: string; valores?: ValoresRegistro; chave?: number };

export async function registrar(anterior: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  const usuario = await exigirUsuario();
  const chave = (anterior.chave ?? 0) + 1;
  const valores: ValoresRegistro = Object.fromEntries(CAMPOS_REGISTRO.map((c) => [c, String(form.get(c) ?? "")]));
  if (!podeRegistrarRnc(usuario)) return { erro: "Seu acesso não permite registrar RNCs.", valores, chave };

  const dados = esquemaRegistro().safeParse(valores);
  if (!dados.success) {
    const problema = dados.error.issues[0];
    return { erro: problema?.message ?? "Confira os campos.", campo: String(problema?.path[0] ?? ""), valores, chave };
  }

  let codigo: string;
  let clienteNovo: string | null;
  try {
    ({ codigo, clienteNovo } = await registrarRnc(dados.data, usuario.id));
  } catch (e) {
    if (e instanceof ErroRegistro) return { erro: e.message, valores, chave };
    throw e;
  }

  revalidatePath("/registros");
  revalidatePath("/");
  redirect(`/rncs/${codigo}?registrada=1${clienteNovo ? "&cliente_novo=1" : ""}`);
}
