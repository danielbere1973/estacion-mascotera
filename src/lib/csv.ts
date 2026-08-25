// Corrige texto mal decodificado (UTF-8 leído como latin1, ej. "TamaÃ±o" -> "Tamaño").
export function corregirEncoding(s: string): string {
  if (!s.includes("Ã") && !s.includes("Â")) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

// Convierte precios con formato argentino ("$ 24.100,00") a número (24100).
export function parsearPrecio(valor: unknown): number {
  if (typeof valor === "number") return valor;
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const limpio = texto.replace(/[^0-9.,]/g, "");
  const normalizado = limpio.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isNaN(numero) ? 0 : numero;
}

// Parser de CSV simple (soporta campos entre comillas con comas y comillas escapadas).
// No usamos XLSX para CSV porque convierte automáticamente celdas como
// "$ 24.100,00" en números (perdiendo datos, ej: termina en 24.1).
// Detecta automáticamente si el separador es ";" o ",".
export function parsearCSV(texto: string): Record<string, string>[] {
  const lineas = texto.split(/\r\n|\n|\r/).filter((linea) => linea.length > 0);
  if (lineas.length === 0) return [];

  // Detectar separador: si la primera línea tiene más ";" que "," usamos ";"
  const sep = (lineas[0].split(";").length > lineas[0].split(",").length) ? ";" : ",";

  const parsearLinea = (linea: string): string[] => {
    const campos: string[] = [];
    let actual = "";
    let dentroComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (dentroComillas) {
        if (c === '"') {
          if (linea[i + 1] === '"') {
            actual += '"';
            i++;
          } else {
            dentroComillas = false;
          }
        } else {
          actual += c;
        }
      } else if (c === '"') {
        dentroComillas = true;
      } else if (c === sep) {
        campos.push(actual);
        actual = "";
      } else {
        actual += c;
      }
    }
    campos.push(actual);
    return campos;
  };

  const encabezados = parsearLinea(lineas[0]);
  return lineas.slice(1).map((linea) => {
    const valores = parsearLinea(linea);
    const fila: Record<string, string> = {};
    encabezados.forEach((encabezado, i) => {
      fila[encabezado] = valores[i] ?? "";
    });
    return fila;
  });
}
