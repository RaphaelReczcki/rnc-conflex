import { z } from "zod";
import { ORIGENS, SEVERIDADES, type Origem, type Severidade } from "./dominio";
import { hojeEmBrasilia } from "./codigo";

// Aceita "1.234,56", "1234,56" e "1234.56". Vazio vale zero.
export function lerDecimal(valor: unknown): number | null {
  const texto = String(valor ?? "").trim().replace(/^R\$\s*/i, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  return Number(normalizado);
}

// CPF formatado (000.000.000-00). LGPD: não deve ir para os campos livres.
const PADRAO_CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
export function contemCpf(texto: string | null | undefined): boolean {
  return PADRAO_CPF.test(texto ?? "");
}

const AVISO_CPF = "Parece haver um CPF no texto. Para proteger os dados pessoais (LGPD), retire-o antes de registrar.";

const textoLivre = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .refine((t) => !contemCpf(t), AVISO_CPF);

export function esquemaRegistro(hoje = hojeEmBrasilia()) {
  return z.object({
    setorId: z.uuid({ message: "Escolha o setor." }),
    dataOcorrencia: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da ocorrência.")
      .refine((d) => d <= hoje, "A data da ocorrência não pode estar no futuro.")
      .refine((d) => d >= "2000-01-01", "Confira a data da ocorrência."),
    cliente: textoLivre(160),
    tipoProblema: textoLivre(160).pipe(z.string().min(2, "Informe o tipo de problema.")),
    origem: z.enum(Object.keys(ORIGENS) as [Origem, ...Origem[]], { message: "Escolha a origem." }),
    severidade: z.enum(Object.keys(SEVERIDADES) as [Severidade, ...Severidade[]], { message: "Escolha a severidade." }),
    descricao: textoLivre(5000).pipe(z.string().min(1, "Descreva o que aconteceu.")),
    correcaoImediata: textoLivre(5000),
    multasJuros: z
      .unknown()
      .transform(lerDecimal)
      .refine((n): n is number => n !== null && n >= 0 && n < 10_000_000_000, "Informe multas e juros em reais, ex.: 1.234,56."),
    horasRetrabalho: z
      .unknown()
      .transform(lerDecimal)
      .refine((n): n is number => n !== null && n >= 0 && n <= 99_999, "Informe as horas de retrabalho, ex.: 2,5."),
  });
}

export type DadosRegistro = z.output<ReturnType<typeof esquemaRegistro>>;

export const CAMPOS_REGISTRO = [
  "setorId",
  "dataOcorrencia",
  "cliente",
  "tipoProblema",
  "origem",
  "severidade",
  "descricao",
  "correcaoImediata",
  "multasJuros",
  "horasRetrabalho",
] as const;
export type ValoresRegistro = Partial<Record<(typeof CAMPOS_REGISTRO)[number], string>>;
