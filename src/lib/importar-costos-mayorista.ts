import { prisma } from "@/lib/prisma";
import { corregirEncoding, parsearCSV, parsearPrecio } from "@/lib/csv";
import { calcularMargenPorPeso, calificaParaMargenPorPeso } from "@/lib/margen-productos";

// Lógica compartida para importar una lista de precios de mayorista (CSV o
// .xlsx) y actualizar HistorialStockMayorista + costos de Producto (cuando el
// proveedor es HYM, la lista madre). Usada tanto por la importación manual
// desde /inventario (arrastrar archivo) como por el sync automático que
// dispara el servicio local (server.py) cuando el scraper termina.

function normalizarSku(sku: string): string {
  const s = sku.startsWith("0") ? sku.slice(1) : sku;
  return s.toLowerCase();
}

// Normaliza el nombre de un producto para comparar "Nutrique Medium Young Adult"
// con "NUTRIQUE MEDIUM YOUNG ADULT " sin que difieran mayúsculas/espacios.
function normalizarNombreComparacion(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

// Convierte el campo Tamaño (tal como lo manda HYM, con formatos inconsistentes:
// "3 Kg", "3Kg", "3,6kg", "0.350" (decimal sin unidad = kg), "3,8l") a gramos,
// para poder comparar el PESO real de dos filas y no solo el texto. HYM reutiliza
// el mismo nombre de producto para sus distintas variantes de peso (ej. "NUTRIQUE
// MEDIUM YOUNG ADULT" existe en 0.350, 3Kg y 12Kg con códigos distintos), así que
// nombre igual NO alcanza para decir que dos filas son "el mismo producto" — hace
// falta que el peso también coincida.
function normalizarPesoAGramos(tamanioRaw: string): number | null {
  const t = tamanioRaw.trim().toLowerCase().replace(",", ".");
  if (!t) return null;

  const matchKg = t.match(/^([\d.]+)\s*kg$/);
  if (matchKg) return Math.round(Number(matchKg[1]) * 1000);

  const matchG = t.match(/^([\d.]+)\s*g(?:r|rs|ms)?$/);
  if (matchG) return Math.round(Number(matchG[1]));

  const matchLt = t.match(/^([\d.]+)\s*l(?:t|ts)?$/);
  if (matchLt) return Math.round(Number(matchLt[1]) * 1000); // aprox. 1kg por litro

  // Decimal puro sin unidad: convención de HYM = kg (ej. "0.350" = 350g).
  const matchNum = t.match(/^([\d.]+)$/);
  if (matchNum) return Math.round(Number(matchNum[1]) * 1000);

  return null;
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

export type PosibleCodigoReasignado = {
  codigoNuevo: string | null;
  sku: string;
  nombre: string;
  tamanios: string | null;
  codigoViejoCandidato: string | null;
  skuViejoCandidato: string;
  productoExistente: { id: number; skuInterno: string; nombre: string };
};

export async function importarCostosMayoristaCore(
  buffer: Buffer,
  nombreArchivo: string,
  proveedorId: number
): Promise<{ total: number; actualizados: number; nuevos: number; posiblesReasignaciones: PosibleCodigoReasignado[] }> {
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
      producto: { select: { id: true, skuInterno: true, nombre: true, margenPorcentaje: true, unidadMedida: true, contenido: true } },
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
            select: { id: true, skuInterno: true, nombre: true, margenPorcentaje: true, unidadMedida: true, contenido: true },
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

  // Candidatos para detectar "código reasignado": filas HYM inactivas (ya no
  // aparecen en esta importación, incluyendo las recién desactivadas arriba)
  // con Producto vinculado. Si una fila nueva sin match tiene el mismo nombre Y
  // el mismo peso que una de estas, es más probable que sea el mismo producto
  // con código nuevo que un producto realmente nuevo — no lo creamos
  // automático, lo reportamos para revisar. Se consulta DESPUÉS de los
  // updateMany de arriba para que agarre también las bajas de esta misma
  // corrida, no solo las de corridas anteriores.
  const inactivosConProducto = importandoHym
    ? await prisma.historialStockMayorista.findMany({
        where: { proveedorId, activo: false, productoId: { not: null } },
        select: {
          sku: true,
          codigoHym: true,
          nombre: true,
          tamanios: true,
          producto: { select: { id: true, skuInterno: true, nombre: true } },
        },
      })
    : [];
  const inactivosPorNombrePeso = new Map<string, (typeof inactivosConProducto)[number]>();
  for (const h of inactivosConProducto) {
    const peso = h.tamanios ? normalizarPesoAGramos(h.tamanios) : null;
    if (peso === null) continue;
    const clave = `${normalizarNombreComparacion(h.nombre ?? "")}::${peso}`;
    inactivosPorNombrePeso.set(clave, h);
  }

  const posiblesReasignaciones: PosibleCodigoReasignado[] = [];

  for (const [sku, fila] of filasPorSku) {
    const nombre = String(fila["Nombre"] ?? "").trim();
    const precioCosto = parsearPrecio(fila["Precio Lista"]);
    // Cuando HYM no informa descuento para un producto, la columna viene vacía.
    // Guardamos null (no 0) para que la UI pueda hacer `precioConDescuento ?? precioCostoScraped`
    // y caer al precio de lista — si guardáramos 0 el "??" no lo detecta como ausente.
    const precioConDescuentoTexto = String(fila["Precio c/dto"] ?? "").trim();
    const precioConDescuento = precioConDescuentoTexto ? parsearPrecio(precioConDescuentoTexto) : null;
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

    // Antes de tratarlo como producto nuevo: ¿hay una fila HYM inactiva con el
    // mismo nombre Y el mismo peso? Si sí, es más probable que HYM le haya
    // reasignado el código a un producto existente que que sea uno nuevo.
    let posibleReasignacion: (typeof inactivosConProducto)[number] | null = null;
    if (!producto && importandoHym && tamanios) {
      const peso = normalizarPesoAGramos(tamanios);
      if (peso !== null) {
        posibleReasignacion = inactivosPorNombrePeso.get(`${normalizarNombreComparacion(nombre)}::${peso}`) ?? null;
      }
    }

    if (producto) {
      if (importandoHym) {
        const califica = calificaParaMargenPorPeso({
          nombre: producto.nombre,
          unidadMedida: producto.unidadMedida,
          contenido: Number(producto.contenido),
        });
        const margenActualizado = califica
          ? calcularMargenPorPeso({ nombre: producto.nombre, unidadMedida: producto.unidadMedida, contenido: Number(producto.contenido), costo: precioCosto })
          : Number(producto.margenPorcentaje);
        const precioVenta = precioCosto * (1 + margenActualizado / 100);
        await prisma.producto.update({
          where: { id: producto.id },
          data: { precioCostoUnitario: precioCosto, margenPorcentaje: margenActualizado, precioVenta },
        });
      }
      actualizados++;
    } else if (importandoHym && posibleReasignacion) {
      // No lo creamos como producto nuevo automáticamente: queda sin vincular
      // (productoId null) y se reporta para revisión manual.
      posiblesReasignaciones.push({
        codigoNuevo: codigoHym,
        sku,
        nombre,
        tamanios,
        codigoViejoCandidato: posibleReasignacion.codigoHym,
        skuViejoCandidato: posibleReasignacion.sku,
        productoExistente: posibleReasignacion.producto!,
      });
    } else if (importandoHym) {
      const nombreCompleto = [nombre, tamanios].filter(Boolean).join(" · ") || sku;
      const tamanioParseado = tamanios ? parsearTamanio(tamanios) : null;
      const unidadMedidaNueva = (tamanioParseado?.unidad ?? "KILOGRAMOS") as "KILOGRAMOS" | "GRAMOS" | "LITROS" | "MILILITROS" | "UNIDAD";
      const contenidoNuevo = tamanioParseado?.contenido ?? 1;
      const margenNuevo = calcularMargenPorPeso({ nombre: nombreCompleto, unidadMedida: unidadMedidaNueva, contenido: contenidoNuevo, costo: precioCosto });
      producto = await prisma.$transaction(async (tx) => {
        const skuInternoAuto = await siguienteSkuInterno(tx);
        return tx.producto.create({
          data: {
            skuInterno: skuInternoAuto,
            nombre: nombreCompleto,
            marca: tipoProducto ?? "-",
            categoria: tipoProducto ?? "Sin categorizar",
            presentacion: "BOLSA_CERRADA",
            unidadMedida: unidadMedidaNueva,
            contenido: contenidoNuevo,
            margenPorcentaje: margenNuevo,
            precioCostoUnitario: precioCosto,
            precioVenta: precioCosto * (1 + margenNuevo / 100),
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

  return { total: filasPorSku.size, actualizados, nuevos, posiblesReasignaciones };
}
