"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { registrarLog } from "@/lib/log";
import { Presentacion, UnidadMedida } from "@prisma/client";

export async function crearCompra(formData: FormData) {
  const session = await requireAdmin();

  let proveedorId = formData.get("proveedorId")?.toString();
  if (proveedorId === "nuevo") {
    const nombre = formData.get("proveedorNombre")?.toString().trim();
    if (!nombre) throw new Error("Falta el nombre del proveedor.");
    const direccion = formData.get("proveedorDireccion")?.toString().trim() || null;
    const contacto = formData.get("proveedorContacto")?.toString().trim() || null;

    const proveedor = await prisma.proveedor.create({
      data: { nombre, direccion, contacto },
    });
    proveedorId = String(proveedor.id);
  }
  if (!proveedorId) throw new Error("Debe seleccionar un proveedor.");

  const costoEnvio = Number(formData.get("costoEnvio") || 0);
  const numeroPedido = formData.get("numeroPedido")?.toString().trim() || null;
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;
  const pagadoPorId = formData.get("pagadoPorId") ? Number(formData.get("pagadoPorId")) : null;
  const fechaCompraStr = formData.get("fechaCompra")?.toString();
  const fechaCompra = fechaCompraStr ? new Date(fechaCompraStr) : new Date();

  const skus = formData.getAll("itemSku").map((v) => v.toString().trim());
  const nombres = formData.getAll("itemNombre").map((v) => v.toString().trim());
  const cantidades = formData.getAll("itemCantidad").map((v) => Number(v));
  const precios = formData.getAll("itemPrecio").map((v) => Number(v));
  const descuentos = formData.getAll("itemDescuento").map((v) => Number(v) || 0);

  const items = skus
    .map((sku, i) => ({
      sku,
      nombre: nombres[i] || sku,
      cantidad: cantidades[i],
      precioLista: precios[i],
      descuentoPct: descuentos[i],
      precioCosto: precios[i] * (1 - descuentos[i] / 100),
    }))
    .filter((item) => item.sku && item.cantidad > 0 && item.precioLista >= 0);

  if (items.length === 0) throw new Error("Agregá al menos un producto.");

  await prisma.$transaction(async (tx) => {
    const tipoDefault = await tx.tipoProducto.findFirst({ orderBy: { nombre: "asc" } });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      let producto = await tx.producto.findFirst({ where: { sku: item.sku } });
      if (!producto) {
        producto = await tx.producto.create({
          data: {
            sku: item.sku,
            nombre: item.nombre,
            marca: "-",
            categoria: tipoDefault?.nombre ?? "General",
            presentacion: "BOLSA_CERRADA" as Presentacion,
            unidadMedida: "KILOGRAMOS" as UnidadMedida,
            contenido: 1,
            margenPorcentaje: 30,
            precioCostoUnitario: item.precioCosto,
            precioVenta: item.precioCosto * 1.3,
            stockActual: item.cantidad,
          },
        });
      } else {
        const precioVenta = item.precioCosto * (1 + Number(producto.margenPorcentaje) / 100);
        await tx.producto.update({
          where: { id: producto.id },
          data: { precioCostoUnitario: item.precioCosto, precioVenta, stockActual: { increment: item.cantidad } },
        });
      }

      const compra = await tx.compra.create({
        data: {
          proveedorId: Number(proveedorId),
          productoId: producto.id,
          cantidad: item.cantidad,
          precioCostoUnitario: item.precioCosto,
          descuentoPorcentaje: item.descuentoPct,
          costoEnvio: i === 0 ? costoEnvio : 0,
          numeroPedido,
          facturado,
          numeroFactura,
          pagadoPorId,
          fechaCompra,
          usuarioId: Number(session.user.id),
        },
        include: { producto: true, proveedor: true },
      });

      await registrarLog(tx, {
        usuarioId: Number(session.user.id),
        accion: "CREAR",
        entidad: "COMPRA",
        entidadId: compra.id,
        detalle: `${compra.producto.nombre} x${compra.cantidad} - ${compra.proveedor.nombre}`,
      });
    }
  });

  revalidatePath("/inventario");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");
  redirect("/inventario");
}

export async function actualizarItemMayorista(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Item inválido.");

  const proveedorId = formData.get("proveedorId")?.toString();
  const nombre = formData.get("nombre")?.toString().trim() || null;
  const skuInterno = formData.get("skuInterno")?.toString().trim() || null;
  const precioCostoScraped = Number(formData.get("precioCostoScraped"));
  const precioConDescuentoStr = formData.get("precioConDescuento")?.toString().trim();
  const precioConDescuento = precioConDescuentoStr ? Number(precioConDescuentoStr) : null;
  const tamanios = formData.get("tamanios")?.toString().trim() || null;

  if (precioCostoScraped < 0) throw new Error("El precio no es válido.");

  await prisma.historialStockMayorista.update({
    where: { id },
    data: { nombre, skuInterno, precioCostoScraped, precioConDescuento, tamanios },
  });

  revalidatePath("/inventario/listas");
  revalidatePath("/inventario/compra");
  redirect(`/inventario/listas?proveedorId=${proveedorId}`);
}

export async function vincularItemMayorista(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  const productoId = formData.get("productoId")?.toString().trim();
  const proveedorId = formData.get("proveedorId")?.toString();

  if (!id) throw new Error("Item inválido.");

  await prisma.historialStockMayorista.update({
    where: { id },
    data: { productoId: productoId ? Number(productoId) : null },
  });

  revalidatePath("/inventario/listas");
  revalidatePath("/inventario/compra");
  redirect(`/inventario/listas?proveedorId=${proveedorId}`);
}

export async function eliminarItemMayorista(formData: FormData) {
  const session = await requireAdmin();

  const proveedorId = Number(formData.get("proveedorId"));
  const sku = formData.get("sku")?.toString();
  if (!proveedorId || !sku) throw new Error("Item inválido.");

  await prisma.historialStockMayorista.deleteMany({
    where: { proveedorId, sku },
  });

  revalidatePath("/inventario/listas");
  revalidatePath("/inventario/compra");
}

export async function actualizarCompra(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Compra inválida.");

  const proveedorId = Number(formData.get("proveedorId"));
  const cantidad = Number(formData.get("cantidad"));
  const precioListaUnitario = Number(formData.get("precioCostoUnitario"));
  const descuentoPorcentaje = Number(formData.get("descuentoPorcentaje") || 0);
  const costoEnvio = Number(formData.get("costoEnvio") || 0);
  const numeroPedido = formData.get("numeroPedido")?.toString().trim() || null;
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;

  if (!proveedorId) throw new Error("Debe seleccionar un proveedor.");
  if (!cantidad || cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0.");
  if (precioListaUnitario < 0) throw new Error("El precio de costo no es válido.");
  if (descuentoPorcentaje < 0 || descuentoPorcentaje > 100) {
    throw new Error("El descuento debe estar entre 0 y 100.");
  }

  const precioCostoUnitario = precioListaUnitario * (1 - descuentoPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const compra = await tx.compra.findUniqueOrThrow({ where: { id } });
    const producto = await tx.producto.findUniqueOrThrow({ where: { id: compra.productoId } });

    const deltaCantidad = cantidad - compra.cantidad;
    const precioVenta = precioCostoUnitario * (1 + Number(producto.margenPorcentaje) / 100);

    await tx.producto.update({
      where: { id: producto.id },
      data: {
        stockActual: { increment: deltaCantidad },
        precioCostoUnitario,
        precioVenta,
      },
    });

    await tx.compra.update({
      where: { id },
      data: {
        proveedorId,
        cantidad,
        precioCostoUnitario,
        descuentoPorcentaje,
        costoEnvio,
        numeroPedido,
        facturado,
        numeroFactura,
      },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ACTUALIZAR",
      entidad: "COMPRA",
      entidadId: id,
      detalle: `${producto.nombre} x${cantidad}`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/inventario/compras");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");
  redirect("/inventario/compras");
}

export async function eliminarCompra(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Compra inválida.");

  await prisma.$transaction(async (tx) => {
    const compra = await tx.compra.findUniqueOrThrow({ where: { id }, include: { producto: true } });
    await tx.producto.update({
      where: { id: compra.productoId },
      data: { stockActual: { decrement: compra.cantidad } },
    });
    await tx.compra.delete({ where: { id } });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ELIMINAR",
      entidad: "COMPRA",
      entidadId: id,
      detalle: `${compra.producto.nombre} x${compra.cantidad}`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/inventario/compras");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");
}

export async function eliminarProducto(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Producto inválido.");

  await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { compras: true, detalleVentas: true } },
      },
    });

    if (producto._count.compras > 0 || producto._count.detalleVentas > 0) {
      throw new Error(
        "No se puede eliminar un producto que tiene compras o ventas registradas."
      );
    }

    await tx.historialStockMayorista.updateMany({
      where: { productoId: id },
      data: { productoId: null },
    });

    await tx.producto.delete({ where: { id } });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ELIMINAR",
      entidad: "PRODUCTO",
      entidadId: id,
      detalle: `${producto.nombre} (${producto.sku})`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/ventas/nueva");
}

export async function crearProducto(formData: FormData) {
  const session = await requireAdmin();

  const sku = formData.get("sku")?.toString().trim();
  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim();
  const presentacion = formData.get("presentacion")?.toString() as Presentacion;
  const unidadMedida = formData.get("unidadMedida")?.toString() as UnidadMedida;
  const contenido = Number(formData.get("contenido") || 1);
  const margenPorcentaje = Number(formData.get("margenPorcentaje") || 30);
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario") || 0);
  const stockActual = 0; // El stock se mueve solo por compras, no al dar de alta
  const proveedorIdStr = formData.get("proveedorId")?.toString();
  const proveedorId = proveedorIdStr ? Number(proveedorIdStr) : null;

  if (!sku || !nombre || !marca || !categoria || !presentacion || !unidadMedida) {
    throw new Error("Faltan datos del producto.");
  }
  if (!proveedorId) throw new Error("Debe seleccionar un proveedor.");

  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.create({
      data: { sku, nombre, marca, categoria, presentacion, unidadMedida, contenido, margenPorcentaje, precioCostoUnitario, precioVenta, stockActual, proveedorId },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "CREAR",
      entidad: "PRODUCTO",
      entidadId: producto.id,
      detalle: `${nombre} (${sku})`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/ventas/nueva");
  redirect("/inventario");
}

export async function actualizarProducto(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Producto inválido.");

  const sku = formData.get("sku")?.toString().trim();
  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim();
  const presentacion = formData.get("presentacion")?.toString() as Presentacion;
  const unidadMedida = formData.get("unidadMedida")?.toString() as UnidadMedida;
  const contenido = Number(formData.get("contenido"));
  const margenPorcentaje = Number(formData.get("margenPorcentaje"));
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario"));
  const proveedorIdStr = formData.get("proveedorId")?.toString();
  const proveedorId = proveedorIdStr ? Number(proveedorIdStr) : null;

  if (!sku || !nombre || !marca || !categoria || !presentacion || !unidadMedida) {
    throw new Error("Faltan datos del producto.");
  }
  if (!contenido || contenido <= 0) throw new Error("El contenido debe ser mayor a 0.");
  if (margenPorcentaje < 0) throw new Error("El margen no es válido.");

  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    await tx.producto.update({
      where: { id },
      data: {
        sku,
        nombre,
        marca,
        categoria,
        presentacion,
        unidadMedida,
        contenido,
        margenPorcentaje,
        precioCostoUnitario,
        precioVenta,
        proveedorId,
      },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ACTUALIZAR",
      entidad: "PRODUCTO",
      entidadId: id,
      detalle: `${nombre} (${sku})`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/ventas/nueva");
  redirect("/inventario");
}

export async function crearProductoDesdeListaMayorista(formData: FormData) {
  const session = await requireAdmin();

  const listaItemId = Number(formData.get("listaItemId"));
  const proveedorId = Number(formData.get("proveedorId"));
  const sku = formData.get("sku")?.toString().trim();
  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim();
  const presentacion = formData.get("presentacion")?.toString() as Presentacion;
  const unidadMedida = formData.get("unidadMedida")?.toString() as UnidadMedida;
  const contenido = Number(formData.get("contenido"));
  const margenPorcentaje = Number(formData.get("margenPorcentaje"));
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario"));

  if (!sku || !nombre || !marca || !categoria || !presentacion || !unidadMedida) {
    throw new Error("Faltan datos del producto.");
  }
  if (!contenido || contenido <= 0) throw new Error("El contenido debe ser mayor a 0.");
  if (margenPorcentaje < 0) throw new Error("El margen no es válido.");
  if (!precioCostoUnitario || precioCostoUnitario <= 0) throw new Error("El precio de costo no es válido.");

  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.create({
      data: {
        sku,
        nombre,
        marca,
        categoria,
        presentacion,
        unidadMedida,
        contenido,
        margenPorcentaje,
        precioCostoUnitario,
        precioVenta,
        stockActual: 0,
      },
    });

    await tx.historialStockMayorista.updateMany({
      where: { id: listaItemId },
      data: { productoId: producto.id },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "CREAR",
      entidad: "PRODUCTO",
      entidadId: producto.id,
      detalle: `${nombre} (${sku}) desde lista proveedor`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/inventario/listas");
  revalidatePath("/ventas/nueva");
  redirect(`/inventario/listas?proveedorId=${proveedorId}`);
}

// Las listas de precios de los mayoristas suelen venir con problemas de
// codificación (UTF-8 leído como Latin-1, ej: "Tamaños" -> "TamaÃ±os").
// Si detectamos el patrón típico de mojibake, lo corregimos.
function corregirEncoding(s: string): string {
  if (!s.includes("Ã") && !s.includes("Â")) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

// Saca el primer cero de un SKU si empieza con uno (ej: "06443-0.355" → "6443-0.355").
function normalizarSku(sku: string): string {
  return sku.startsWith("0") ? sku.slice(1) : sku;
}

// Convierte precios con formato argentino ("$ 24.100,00") a número (24100).
function parsearPrecio(valor: unknown): number {
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
function parsearCSV(texto: string): Record<string, string>[] {
  const lineas = texto.split(/\r\n|\n|\r/).filter((linea) => linea.length > 0);
  if (lineas.length === 0) return [];

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
      } else if (c === ",") {
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

// Normaliza nombres para poder comparar "RC Urinary Care" con "RC URINARY CARE".
function normalizarNombre(s: string): string {
  // Descompone acentos (NFD) y descarta los caracteres de marca diacrítica
  // (rango Unicode 0x0300-0x036F) para que "Ñ"/"ñ" -> "n", "Ó" -> "O", etc.
  return s
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

export async function importarExcel(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Subí un archivo .xlsx o .csv");

  let proveedorId = formData.get("proveedorId")?.toString();
  if (proveedorId === "nuevo") {
    const nombre = formData.get("proveedorNombre")?.toString().trim();
    if (!nombre) throw new Error("Falta el nombre del proveedor.");
    const direccion = formData.get("proveedorDireccion")?.toString().trim() || null;
    const contacto = formData.get("proveedorContacto")?.toString().trim() || null;

    const proveedor = await prisma.proveedor.create({
      data: { nombre, direccion, contacto },
    });
    proveedorId = String(proveedor.id);
  }
  if (!proveedorId) throw new Error("Debe seleccionar un proveedor.");

  const buffer = Buffer.from(await file.arrayBuffer());

  let filasRaw: Record<string, unknown>[];
  if (file.name.toLowerCase().endsWith(".csv")) {
    const texto = corregirEncoding(buffer.toString("utf8"));
    filasRaw = parsearCSV(texto);
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    filasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  }

  // Corregimos la codificación de claves y valores (por si vienen de un .xlsx
  // con el mismo problema), y deduplicamos por "SKU" (cada variante de
  // tamaño tiene su propio SKU único generado por el scraper).
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

  // Si nuestro producto tiene cargado el SKU del mayorista (Codigo-Tamaño),
  // matcheamos por ahí. Si no, intentamos por nombre normalizado.
  const productos = await prisma.producto.findMany();
  const productosPorSku = new Map(productos.map((producto) => [producto.sku, producto]));
  const productosPorNombre = new Map<string, (typeof productos)[number][]>();
  for (const producto of productos) {
    const clave = normalizarNombre(producto.nombre);
    const lista = productosPorNombre.get(clave) ?? [];
    lista.push(producto);
    productosPorNombre.set(clave, lista);
  }

  let actualizados = 0;
  let sinCoincidencia = 0;
  const ahora = new Date();

  for (const [sku, fila] of filasPorSku) {
    const nombre = String(fila["Nombre"] ?? "").trim();
    const precioCosto = parsearPrecio(fila["Precio Lista"]);
    const precioConDescuento = parsearPrecio(fila["Precio c/dto"]);
    const tamanios = String(fila["Tamaño"] ?? fila["Tamaños"] ?? "").trim() || null;
    const estadoStockMayorista = String(fila["Estado de stock"] ?? "").trim() || null;

    let producto = productosPorSku.get(sku) ?? null;
    if (!producto) {
      const candidatos = productosPorNombre.get(normalizarNombre(nombre)) ?? [];
      producto = candidatos.length === 1 ? candidatos[0] : null;
    }

    if (producto) {
      const precioVenta = precioCosto * (1 + Number(producto.margenPorcentaje) / 100);
      await prisma.producto.update({
        where: { id: producto.id },
        data: { precioCostoUnitario: precioCosto, precioVenta },
      });
      actualizados++;
    } else {
      sinCoincidencia++;
    }

    await prisma.historialStockMayorista.create({
      data: {
        productoId: producto?.id ?? null,
        proveedorId: Number(proveedorId),
        sku,
        nombre,
        precioCostoScraped: precioCosto,
        precioConDescuento,
        tamanios,
        estadoStockMayorista,
        fechaImportacion: ahora,
      },
    });
  }

  revalidatePath("/inventario");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");

  return { total: filasPorSku.size, actualizados, sinCoincidencia };
}
