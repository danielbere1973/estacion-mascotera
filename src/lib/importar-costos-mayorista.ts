import { prisma } from "@/lib/prisma";
import { corregirEncoding, parsearCSV, parsearPrecio } from "@/lib/csv";

// Lógica compartida para importar una lista de precios de mayorista (CSV o
// .xlsx) y actualizar HistorialStockMayorista + costos de Producto (cuando el
// proveedor es HYM, la lista madre). Usada tanto por la importación manual
// desde /inventario (arrastrar archivo) como por el sync automático que
// dispara el servicio local (server.py) cuando el scraper termina.

function normalizarSku(sku: string): string {
  const s = sku.startsWith("0") ? sku.slice(1) : sku;
  return s.toLowerCase();
}

// Parsea el campo Tamaño del CSV de HYM y retorna contenido y unidadMedida.
// Ejemplos: "12 Kg" → {contenido: 12, unidad: KILOGRAMOS}
//           "1.5 Kg" → {contenido: 1.5, unidad: KILOGRAMOS}
//           "0.355"  → {contenido: 355, unidad: GRAMOS} (decimal sin unidad = kg, convertimos a g si < 1)
//           "0.340"  → {contenido: 340, unidad: GRAMOS}
//           "7.5 Kg" → {contenido: 7.5, unidad: KILOGRAMOS}
function parsearTamanio(tamanio: string): { contenido: number; unidad: string } | null {
  const t = tamanio.trim();
  if (!t) return null;

  const matchKg = t.match(/^([\d.]+)\s*[Kk][Gg]$/);
  if (matchKg) {
    return { contenido: Number(matchKg[1]), unidad: "KILOGRAMOS" };
  }

  const matchLt = t.match(/^([\d.]+)\s*[Ll][Tt]$/);
  if (matchLt) {
    return { contenido: Number(matchLt[1]), unidad: "LITROS" };
  }

  const matchNum = t.match(/^([\d.]+)$/);
  if (matchNum) {
    const val = Number(matchNum[1]);
    if (val < 1) {
      return { contenido: Math.round(val * 1000), unidad: "GRAMOS" };
    }
    return { contenido: val, unidad: "KILOGRAMOS" };
  }

  return null;
}

async function siguienteSkuInterno(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const ultimo = await tx.producto.findFirst({
    where: {},
    orderBy: { skuInterno: "desc" },
    select: { skuInterno: true },
  });

  if (!ultimo?.skuInterno || !/^[A-Z]{2}\d{2}$/.test(ultimo.skuInterno)) return "AA00";

  const letras = ultimo.skuInterno.slice(0, 2);
  const num = parseInt(ultimo.skuInterno.slice(2), 10);

  if (num < 99) return `${letras}${String(num + 1).padStart(2, "0")}`;

  const l2 = letras[1];
  const l1 = letras[0];
  if (l2 < "Z") return `${l1}${String.fromCharCode(l2.charCodeAt(0) + 1)}00`;
  if (l1 < "Z") return `${String.fromCharCode(l1.charCodeAt(0) + 1)}A00`;

  throw new Error("Se agotaron los SKU internos disponibles (ZZ99).");
}

export async function importarCostosMayoristaCore(
  buffer: Buffer,
  nombreArchivo: string,
  proveedorId: number
): Promise<{ total: number; actualizados: number; nuevos: number }> {
  let filasRaw: Record<string, unknown>[];
  if (nombreArchivo.toLowerCase().endsWith(".csv")) {
    const texto = corregirEncoding(buffer.toString("utf8"));
    filasRaw = parsearCSV(texto);
  } else {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    filasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  }

  const filasPorSku = new Map<string, Record<string, unknown>>();
  for (const filaRaw of filasRaw) {
    const fila: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(filaRaw)) {
      const claveCorregida = corregirEncoding(clave);
      fila[claveCorregida] = typeof valor === "string" ? corregirEncoding(valor) : valor;
    }

    const sku = normalizarSku(String(fila["SKU"] ?? fila["Codigo"] ?? "").trim());
    if (!sku) continue;
    if (!filasPorSku.has(sku)) filasPorSku.set(sku, fila);
  }

  const proveedor = await prisma.proveedor.findUnique({
    where: { id: proveedorId },
    select: { nombre: true },
  });
  const importandoHym = proveedor?.nombre?.toUpperCase() === "HYM";

  const historialItems = await prisma.historialStockMayorista.findMany({
    where: { proveedorId, productoId: { not: null } },
    select: {
      sku: true,
      codigoHym: true,
      productoId: true,
      producto: { select: { id: true, skuInterno: true, nombre: true, margenPorcentaje: true } },
    },
  });
  const productosPorSku = new Map(
    historialItems.filter((h) => h.producto).map((h) => [h.sku, h.producto!])
  );

  const productosPorCodigoHym = new Map(
    historialItems
      .filter((h) => h.producto && h.codigoHym)
      .map((h) => [h.codigoHym!, h.producto!])
  );
  const historialConSkuInternoManual = await prisma.historialStockMayorista.findMany({
    where: { proveedorId, skuInterno: { not: null } },
    select: { sku: true, skuInterno: true },
  });
  const skusInternoManualesUnicos = [...new Set(historialConSkuInternoManual.map((h) => h.skuInterno!))];
  const productosPorSkuInterno = new Map(
    skusInternoManualesUnicos.length > 0
      ? (
          await prisma.producto.findMany({
            where: { skuInterno: { in: skusInternoManualesUnicos } },
            select: { id: true, skuInterno: true, nombre: true, margenPorcentaje: true },
          })
        ).map((p) => [p.skuInterno, p])
      : []
  );
  const productoPorSkuViaMapeoManual = new Map(
    historialConSkuInternoManual
      .map((h) => [h.sku, productosPorSkuInterno.get(h.skuInterno!)] as const)
      .filter((entrada): entrada is [string, NonNullable<(typeof entrada)[1]>] => Boolean(entrada[1]))
  );

  let actualizados = 0;
  let nuevos = 0;
  const ahora = new Date();

  const skusImportados = new Set(filasPorSku.keys());
  await prisma.historialStockMayorista.updateMany({
    where: {
      proveedorId,
      activo: true,
      sku: { notIn: [...skusImportados] },
    },
    data: { activo: false },
  });

  await prisma.historialStockMayorista.updateMany({
    where: {
      proveedorId,
      activo: false,
      sku: { in: [...skusImportados] },
    },
    data: { activo: true },
  });

  for (const [sku, fila] of filasPorSku) {
    const nombre = String(fila["Nombre"] ?? "").trim();
    const precioCosto = parsearPrecio(fila["Precio Lista"]);
    const precioConDescuento = parsearPrecio(fila["Precio c/dto"]);
    const tamanios = String(fila["Tamaño"] ?? fila["Tamaños"] ?? "").trim() || null;
    const estadoStockMayorista = String(fila["Estado de stock"] ?? "").trim() || null;
    const tipoProducto = String(fila["Tipo"] ?? fila["Categoria"] ?? "").trim() || null;
    const codigoHym = String(fila["Codigo"] ?? "").trim() || null;

    let producto = productosPorSku.get(sku) ?? null;
    if (!producto && importandoHym && codigoHym) {
      producto = productosPorCodigoHym.get(codigoHym) ?? null;
    }
    if (!producto && importandoHym) {
      producto = productoPorSkuViaMapeoManual.get(sku) ?? null;
    }

    if (producto) {
      if (importandoHym) {
        const precioVenta = precioCosto * (1 + Number(producto.margenPorcentaje) / 100);
        await prisma.producto.update({
          where: { id: producto.id },
          data: { precioCostoUnitario: precioCosto, precioVenta },
        });
      }
      actualizados++;
    } else if (importandoHym) {
      const nombreCompleto = [nombre, tamanios].filter(Boolean).join(" · ") || sku;
      const tamanioParseado = tamanios ? parsearTamanio(tamanios) : null;
      producto = await prisma.$transaction(async (tx) => {
        const skuInternoAuto = await siguienteSkuInterno(tx);
        return tx.producto.create({
          data: {
            skuInterno: skuInternoAuto,
            nombre: nombreCompleto,
            marca: tipoProducto ?? "-",
            categoria: tipoProducto ?? "Sin categorizar",
            presentacion: "BOLSA_CERRADA",
            unidadMedida: (tamanioParseado?.unidad ?? "KILOGRAMOS") as "KILOGRAMOS" | "GRAMOS" | "LITROS" | "MILILITROS" | "UNIDAD",
            contenido: tamanioParseado?.contenido ?? 1,
            margenPorcentaje: 30,
            precioCostoUnitario: precioCosto,
            precioVenta: precioCosto * 1.3,
            stockActual: 0,
          },
        });
      });
      productosPorSku.set(sku, producto);
      nuevos++;
    }

    await prisma.historialStockMayorista.upsert({
      where: { proveedorId_sku: { proveedorId, sku } },
      update: {
        nombre,
        precioCostoScraped: precioCosto,
        precioConDescuento,
        tamanios,
        estadoStockMayorista,
        tipoProducto,
        activo: true,
        fechaImportacion: ahora,
        ...(producto?.id ? { productoId: producto.id } : {}),
        ...(codigoHym ? { codigoHym } : {}),
      },
      create: {
        productoId: producto?.id ?? null,
        proveedorId,
        sku,
        codigoHym,
        nombre,
        precioCostoScraped: precioCosto,
        precioConDescuento,
        tamanios,
        estadoStockMayorista,
        tipoProducto,
        activo: true,
        fechaImportacion: ahora,
      },
    });
  }

  return { total: filasPorSku.size, actualizados, nuevos };
}
