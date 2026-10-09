// Lê a primeira aba de um .xlsx ou um .csv (separador ; ou ,) como linhas de texto.
import ExcelJS from "exceljs";

export const LIMITE_BYTES = 1024 * 1024; // 1 MB
export const LIMITE_LINHAS = 500;

export class ErroPlanilha extends Error {}

function textoDaCelula(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // hiperlink (e-mail vira link no Excel)
    if ("richText" in v) return v.richText.map((p) => p.text).join("");
    if ("result" in v) return String(v.result ?? ""); // fórmula: usa o valor calculado
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

async function lerXlsx(dados: ArrayBuffer): Promise<string[][]> {
  const livro = new ExcelJS.Workbook();
  try {
    await livro.xlsx.load(dados);
  } catch {
    throw new ErroPlanilha("Não foi possível ler o arquivo. Salve como Excel (.xlsx) ou CSV e tente de novo.");
  }
  const aba = livro.worksheets[0];
  if (!aba) throw new ErroPlanilha("A planilha está vazia.");
  const linhas: string[][] = [];
  aba.eachRow({ includeEmpty: false }, (linha) => {
    const valores: string[] = [];
    for (let c = 1; c <= Math.max(linha.cellCount, 1); c++) valores.push(textoDaCelula(linha.getCell(c).value).trim());
    linhas.push(valores);
  });
  return linhas;
}

// CSV simples com aspas ("a; b" e "" dentro de aspas). Detecta ; ou , pela 1ª linha.
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') (celula += '"'), i++;
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) linha.push(celula.trim()), (celula = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(celula.trim());
      if (linha.some((x) => x)) linhas.push(linha);
      (linha = []), (celula = "");
    } else celula += c;
  }
  linha.push(celula.trim());
  if (linha.some((x) => x)) linhas.push(linha);
  return linhas;
}

export async function lerPlanilha(arquivo: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<string[][]> {
  if (!arquivo.size) throw new ErroPlanilha("Escolha um arquivo.");
  if (arquivo.size > LIMITE_BYTES) throw new ErroPlanilha("Arquivo muito grande (limite de 1 MB).");
  const nome = arquivo.name.toLowerCase();
  const dados = await arquivo.arrayBuffer();
  let linhas: string[][];
  if (nome.endsWith(".xlsx")) linhas = await lerXlsx(dados);
  else if (nome.endsWith(".csv") || nome.endsWith(".txt")) linhas = lerCsv(new TextDecoder("utf-8").decode(dados));
  else throw new ErroPlanilha("Use um arquivo Excel (.xlsx) ou CSV. O formato .xls antigo não é aceito: salve como .xlsx.");
  if (linhas.length > LIMITE_LINHAS + 1) throw new ErroPlanilha(`São no máximo ${LIMITE_LINHAS} linhas por importação.`);
  return linhas;
}
