"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirGestao } from "@/lib/auth/sessao";
import { normalizar } from "@/lib/normalizar";
import { contemCpf } from "@/lib/rnc/validacao";
import { formatarCnpj, normalizarCnpj, validarCnpj } from "@/lib/cnpj";
import { juntarClientes as juntar } from "@/lib/clientes/juntar";

export type ResultadoCliente = { ok?: string; erro?: string; campo?: string };

const esquema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente.")
    .max(160, "Nome muito longo.")
    .refine((t) => !contemCpf(t), "Não registre CPF no nome do cliente (LGPD)."),
  codigoInterno: z
    .string()
    .trim()
    .max(40, "Código muito longo.")
    .transform((v) => v || null),
  // Opcional; guardado só com os 14 caracteres (numérico ou alfanumérico)
  cnpj: z
    .string()
    .transform((v) => normalizarCnpj(v) || null)
    .refine((v) => v === null || validarCnpj(v), "CNPJ inválido. Confira os números (aceita o CNPJ alfanumérico)."),
});

const lerForm = (form: FormData) =>
  esquema.safeParse({ nome: form.get("nome") ?? "", codigoInterno: form.get("codigoInterno") ?? "", cnpj: form.get("cnpj") ?? "" });

const erroDe = (e: z.ZodError): ResultadoCliente => ({ erro: e.issues[0]?.message ?? "Confira os campos.", campo: String(e.issues[0]?.path[0] ?? "") });

async function conferirDuplicados(nome: string, codigo: string | null, cnpj: string | null, ignorarId?: string): Promise<ResultadoCliente | null> {
  const nomeNormalizado = normalizar(nome);
  const mesmoNome = await prisma.cliente.findFirst({ where: { nomeNormalizado, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (mesmoNome) return { erro: `Já existe o cliente "${mesmoNome.nome}". Se for o mesmo, use "Juntar com outro".`, campo: "nome" };
  if (codigo) {
    const mesmoCodigo = await prisma.cliente.findFirst({ where: { codigoInterno: codigo, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
    if (mesmoCodigo) return { erro: `O código ${codigo} já é do cliente "${mesmoCodigo.nome}".`, campo: "codigoInterno" };
  }
  if (cnpj) {
    const mesmoCnpj = await prisma.cliente.findFirst({ where: { cnpj, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
    if (mesmoCnpj) return { erro: `O CNPJ ${formatarCnpj(cnpj)} já é do cliente "${mesmoCnpj.nome}". Se for o mesmo, use "Juntar com outro".`, campo: "cnpj" };
  }
  return null;
}

export async function criarCliente(form: FormData): Promise<ResultadoCliente> {
  await exigirGestao();
  const d = lerForm(form);
  if (!d.success) return erroDe(d.error);
  const dup = await conferirDuplicados(d.data.nome, d.data.codigoInterno, d.data.cnpj);
  if (dup) return dup;
  await prisma.cliente.create({ data: { ...d.data, nomeNormalizado: normalizar(d.data.nome) } });
  revalidatePath("/admin/clientes");
  return { ok: `Cliente ${d.data.nome} cadastrado.` };
}

export async function editarCliente(form: FormData): Promise<ResultadoCliente> {
  await exigirGestao();
  const id = String(form.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return { erro: "Cliente não encontrado." };
  const d = lerForm(form);
  if (!d.success) return erroDe(d.error);
  const dup = await conferirDuplicados(d.data.nome, d.data.codigoInterno, d.data.cnpj, id);
  if (dup) return dup;
  await prisma.cliente.update({ where: { id }, data: { ...d.data, nomeNormalizado: normalizar(d.data.nome), ativo: form.get("ativo") === "on" } });
  revalidatePath("/admin/clientes");
  return { ok: `Cliente ${d.data.nome} atualizado.` };
}

export async function juntarClientes(form: FormData): Promise<ResultadoCliente> {
  const gestor = await exigirGestao();
  const origemId = String(form.get("origemId") ?? "");
  const destinoId = String(form.get("destinoId") ?? "");
  if (![origemId, destinoId].every((x) => z.uuid().safeParse(x).success)) return { erro: "Escolha o cliente certo na lista.", campo: "destinoId" };

  const r = await juntar(gestor.id, origemId, destinoId);
  if (!r.ok) return { erro: r.erro, campo: "destinoId" };
  revalidatePath("/admin/clientes");
  revalidatePath("/registros");
  return { ok: `"${r.origem}" foi juntado em "${r.destino}". ${r.rncs} ${r.rncs === 1 ? "RNC passou" : "RNCs passaram"} para o cliente certo.` };
}
