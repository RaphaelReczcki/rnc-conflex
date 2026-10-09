import { describe, expect, it } from "vitest";
import { formatarCnpj, mascararCnpj, normalizarCnpj, validarCnpj } from "@/lib/cnpj";

describe("CNPJ", () => {
  it("aceita CNPJ numérico válido, com ou sem pontuação", () => {
    expect(validarCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCnpj("11222333000181")).toBe(true);
  });
  it("aceita CNPJ alfanumérico (IN RFB 2.229/2024)", () => {
    // Exemplo publicado pela Receita Federal
    expect(validarCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(validarCnpj("12abc34501de35")).toBe(true); // minúsculas viram maiúsculas
  });
  it("recusa dígito verificador errado, tamanho errado e números repetidos", () => {
    expect(validarCnpj("11.222.333/0001-82")).toBe(false);
    expect(validarCnpj("12.ABC.345/01DE-36")).toBe(false);
    expect(validarCnpj("11.222.333/0001")).toBe(false);
    expect(validarCnpj("00.000.000/0000-00")).toBe(false);
    expect(validarCnpj("12.ABC.345/01DE-3A")).toBe(false); // verificadores são sempre números
  });
  it("guarda só os 14 caracteres e formata para exibir", () => {
    expect(normalizarCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
  it("máscara progressiva enquanto digita", () => {
    expect(mascararCnpj("112")).toBe("11.2");
    expect(mascararCnpj("11222333")).toBe("11.222.333");
    expect(mascararCnpj("112223330001")).toBe("11.222.333/0001");
    expect(mascararCnpj("11222333000181999")).toBe("11.222.333/0001-81");
  });
});
