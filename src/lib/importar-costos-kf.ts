import { prisma } from "@/lib/prisma";

// Importador de la lista de precios de KF (proveedor sin web, todo por excel).
// A diferencia de HYM, este excel no tiene ningún código/SKU propio por
// producto: viene en ~15 hojas (una por marca/línea), cada fila es solo
// "NOMBRE COMPLETO xPESO" + precio, en texto libre y con formato inconsistente
// (a veces con "x", a veces sin, coma o punto decimal, mayúsculas variables).
//
// Como KF y HYM suelen vender los MISMOS productos (sobre todo alimento), la
// idea NO es crear un producto nuevo por cada fila de KF: es que cada fila
// quede como una fila más de HistorialStockMayorista (proveedorId = KF) con
// su propio costo, y Daniel la vincule a mano al Producto ya existente (que
// probablemente ya tiene su fila de HYM) desde la ficha del producto
// ("Agregar proveedor" en /inventario/productos/[id]/editar). Por eso acá
// NUNCA se crea un Producto nuevo ni se actualiza su precioCostoUnitario —
// solo se guarda/actualiza el costo de KF en su propia fila de historial,
// dejando que la web siga usando el costo de HYM como fuente de verdad.
//
// Como no hay código estable, la clave sintética de cada fila (guardada en
// HistorialStockMayorista.sku) se arma a partir del texto normalizado de
// hoja + bloque (encabezado de marca/línea dentro de la hoja) + nombre de la
// fila. Es estable mientras KF no cambie ese texto; si lo cambian, la fila
// vieja queda inactiva y la nueva aparece como "sin vincular" en
// /inventario/vinculaciones para volver a emparejarla a mano.

const HOJAS_ANTIPARASITARIOS = new Set(["PIPETAS", "COMPRIMIDOS"]);

function normalizarClave(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sin acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extrae el peso en gramos del texto libre de la fila, si lo tiene. Soporta
// los formatos reales de KF: "x20KG", "X 3KG", "x7,5KG", "x7.5KG",
// "X21.6KG", "x3.8 LITROS", "X7.6LTS" (litros ~ 1kg). No matchea "x12UN"/
// "X12U."/"X250" (esas son cantidades de unidades, no peso — ver
// extraerCantidadUnidades).
function extraerPesoGramos(nombreRaw: string): number | null {
  const t = nombreRaw.toLowerCase();
  const m = t.match(/x?\s*(\d+[.,]?\d*)\s*(kgs?|kg|litros?|lts?|l)\b/);
  if (!m) return null;
  const valor = Number(m[1].replace(",", "."));
  if (Number.isNaN(valor)) return null;
  return Math.round(valor * 1000);
}

// Cantidad de unidades en caja/pack, cuando el producto se vende así en vez
// de por peso (ej. "POUCH x12UN", "CAJA POUCH X15", "OREJAS MEDIANAS X 250").
function extraerCantidadUnidades(nombreRaw: string): number | null {
  const t = nombreRaw.toLowerCase();
  const m = t.match(/x\s*(\d+)\s*(un\.?|uni\.?|u\.?)?(?!\w)/);
  if (!m) return null;
  return Number(m[1]);
}

// Una fila es "encabezado de bloque" (marca/línea, ej. "ROYAL CANIN DOG") y
// no un producto cuando la columna de precio dice literalmente "UNIDAD".
function esEncabezadoBloque(fila: unknown[]): boolean {
  const col1 = String(fila[1] ?? "").trim().toUpperCase();
  return col1 === "UNIDAD";
}

type FilaParseada = {
  skuSintetico: string;
  nombreCompleto: string;
  tamanios: string | null;
  precio: number | null;
};

function parsearHojaAlimento(nombreHoja: string, rows: unknown[][]): FilaParseada[] {
  const filas: FilaParseada[] = [];
  let bloqueActual: string | null = null;

  for (const row of rows) {
    const col0 = String(row[0] ?? "").trim();
    if (!col0) continue;

    if (esEncabezadoBloque(row)) {
      bloqueActual = col0;
      continue;
    }

    const precioRaw = row[1];
    const precio = typeof precioRaw === "number" ? precioRaw : precioRaw ? Number(precioRaw) : null;
    const precioValido = precio !== null && !Number.isNaN(precio) ? precio : null;

    const pesoGramos = extraerPesoGramos(col0);
    const cantidadUnidades = pesoGramos === null ? extraerCantidadUnidades(col0) : null;
    const tamanios = pesoGramos !== null ? `${pesoGramos}g` : cantidadUnidades !== null ? `x${cantidadUnidades}` : null;

    const claveBloque = normalizarClave(bloqueActual ?? "");
    const claveNombre = normalizarClave(col0);
    const skuSintetico = `${normalizarClave(nombreHoja)}::${claveBloque}::${claveNombre}`;

    filas.push({ skuSintetico, nombreCompleto: col0, tamanios, precio: precioValido });
  }
  return filas;
}

// PIPETAS y COMPRIMIDOS: el nombre de marca/producto está en el encabezado de
// bloque (ej. "PIPETA OSPRETT", "BRAVECTO") y cada fila es solo el rango de
// peso del animal (ej. "GATO 0 A 4KG"). Hay que concatenar ambos para tener
// el nombre completo. No son alimento por peso propio: se importan como
// UNIDAD (ver categoría "Antipulgas y Antigarrapatas" en importarCostosKfCore).
function parsearHojaAntiparasitario(nombreHoja: string, rows: unknown[][]): FilaParseada[] {
  const filas: FilaParseada[] = [];
  let bloqueActual: string | null = null;

  for (const row of rows) {
    const col0 = String(row[0] ?? "").trim();
    if (!col0) continue;

    if (esEncabezadoBloque(row)) {
      bloqueActual = col0;
      continue;
    }
    if (!bloqueActual) continue; // fila huérfana sin bloque; no debería ocurrir

    const precioRaw = row[1];
    const precio = typeof precioRaw === "number" ? precioRaw : precioRaw ? Number(precioRaw) : null;
    const precioValido = precio !== null && !Number.isNaN(precio) ? precio : null;

    const nombreCompleto = `${bloqueActual} - ${col0}`;
    const claveNombre = normalizarClave(nombreCompleto);
    const skuSintetico = `${normalizarClave(nombreHoja)}::${claveNombre}`;

    filas.push({ skuSintetico, nombreCompleto, tamanios: null, precio: precioValido });
  }
  return filas;
}

export async function importarCostosKfCore(
  buffer: Buffer,
  proveedorId: number
): Promise<{ total: number; actualizados: number; nuevos: number; sinPrecio: number }> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const filasPorSku = new Map<string, FilaParseada>();
  for (const nombreHoja of workbook.SheetNames) {
    const sheet = workbook.Sheets[nombreHoja];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const esAntiparasitario = HOJAS_ANTIPARASITARIOS.has(nombreHoja.trim());
    const filas = esAntiparasitario
      ? parsearHojaAntiparasitario(nombreHoja, rows)
      : parsearHojaAlimento(nombreHoja, rows);

    for (const fila of filas) {
      if (!filasPorSku.has(fila.skuSintetico)) filasPorSku.set(fila.skuSintetico, fila);
    }
  }

  const skusImportados = new Set(filasPorSku.keys());
  const ahora = new Date();

  await prisma.historialStockMayorista.updateMany({
    where: { proveedorId, activo: true, sku: { notIn: [...skusImportados] } },
    data: { activo: false },
  });
  await prisma.historialStockMayorista.updateMany({
    where: { proveedorId, activo: false, sku: { in: [...skusImportados] } },
    data: { activo: true },
  });

  const existentes = await prisma.historialStockMayorista.findMany({
    where: { proveedorId, sku: { in: [...skusImportados] } },
    select: { sku: true, productoId: true },
  });
  const productoIdPorSku = new Map(existentes.map((e) => [e.sku, e.productoId]));

  let actualizados = 0;
  let nuevos = 0;
  let sinPrecio = 0;

  for (const [sku, fila] of filasPorSku) {
    if (fila.precio === null) sinPrecio++;

    const yaExiste = productoIdPorSku.has(sku);

    // Nunca se toca Producto.precioCostoUnitario/precioVenta acá: KF es un
    // proveedor "de referencia" (backup de HYM), no la fuente de costo que
    // usa la web. Solo se guarda el costo de KF en su propia fila de
    // historial; Daniel decide manualmente cuándo mirar/usar ese costo.
    await prisma.historialStockMayorista.upsert({
      where: { proveedorId_sku: { proveedorId, sku } },
      update: {
        nombre: fila.nombreCompleto,
        tamanios: fila.tamanios,
        activo: true,
        fechaImportacion: ahora,
        // Si esta corrida no trae precio para la fila, no se pisa el costo
        // ya guardado (celda vacía en el excel de KF != costo 0).
        ...(fila.precio !== null ? { precioCostoScraped: fila.precio } : {}),
      },
      create: {
        proveedorId,
        sku,
        nombre: fila.nombreCompleto,
        precioCostoScraped: fila.precio ?? 0,
        tamanios: fila.tamanios,
        activo: true,
        fechaImportacion: ahora,
      },
    });

    if (yaExiste) actualizados++;
    else nuevos++;
  }

  return { total: filasPorSku.size, actualizados, nuevos, sinPrecio };
}
