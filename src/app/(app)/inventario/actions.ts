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

  const proveedorIdRaw = formData.get("proveedorId")?.toString();
  const esProveedorNuevo = proveedorIdRaw === "nuevo";
  const proveedorNombre = formData.get("proveedorNombre")?.toString().trim();
  const proveedorDireccion = formData.get("proveedorDireccion")?.toString().trim() || null;
  const proveedorContacto = formData.get("proveedorContacto")?.toString().trim() || null;
  if (esProveedorNuevo && !proveedorNombre) throw new Error("Falta el nombre del proveedor.");
  if (!esProveedorNuevo && !proveedorIdRaw) throw new Error("Debe seleccionar un proveedor.");

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
    let proveedorId = proveedorIdRaw;
    if (esProveedorNuevo) {
      const proveedor = await tx.proveedor.create({
        data: { nombre: proveedorNombre!, direccion: proveedorDireccion, contacto: proveedorContacto },
      });
      proveedorId = String(proveedor.id);
    }

    const tipoDefault = await tx.tipoProducto.findFirst({ orderBy: { nombre: "asc" } });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Buscar producto vinculado a este SKU de proveedor en el historial
      const historialItem = await tx.historialStockMayorista.findFirst({
        where: { sku: item.sku, proveedorId: Number(proveedorId) },
        select: { productoId: true },
      });
      let producto = historialItem?.productoId
        ? await tx.producto.findUnique({ where: { id: historialItem.productoId } })
        : null;

      if (!producto) {
        const skuInternoAuto = await siguienteSkuInterno(tx);
        producto = await tx.producto.create({
          data: {
            skuInterno: skuInternoAuto,
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
        // Vincular al historial
        await tx.historialStockMayorista.upsert({
          where: { proveedorId_sku: { proveedorId: Number(proveedorId), sku: item.sku } },
          update: { productoId: producto.id, activo: true },
          create: { proveedorId: Number(proveedorId), sku: item.sku, nombre: item.nombre, precioCostoScraped: item.precioCosto, productoId: producto.id },
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
  const tipoProducto = formData.get("tipoProducto")?.toString().trim() || null;

  if (precioCostoScraped < 0) throw new Error("El precio no es válido.");

  await prisma.historialStockMayorista.update({
    where: { id },
    data: { nombre, skuInterno, precioCostoScraped, precioConDescuento, tamanios, tipoProducto },
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

  const itemSku = formData.get("itemSku")?.toString().trim() || null;
  let nuevoProductoId: number | null = null;

  if (itemSku) {
    // Buscar si ya existe en el catálogo vía historialStockMayorista
    const mayorItem = await prisma.historialStockMayorista.findFirst({
      where: { sku: itemSku, proveedorId },
      select: { productoId: true, nombre: true, tamanios: true, precioCostoScraped: true, precioConDescuento: true, tipoProducto: true },
    });

    if (mayorItem?.productoId) {
      nuevoProductoId = mayorItem.productoId;
    } else {
      // Crear el producto automáticamente con los datos de la lista
      const proveedor = await prisma.proveedor.findUniqueOrThrow({ where: { id: proveedorId } });
      const precioBase = Number(mayorItem?.precioConDescuento ?? mayorItem?.precioCostoScraped ?? precioListaUnitario);
      const nombre = [mayorItem?.nombre, mayorItem?.tamanios].filter(Boolean).join(" · ") || itemSku;
      const categoria = mayorItem?.tipoProducto ?? "Sin categorizar";
      const skuInternoAuto = await (async () => {
        const ultimo = await prisma.producto.findFirst({ where: {}, orderBy: { skuInterno: "desc" }, select: { skuInterno: true } });
        if (!ultimo?.skuInterno || !/^[A-Z]{2}\d{2}$/.test(ultimo.skuInterno)) return "AA00";
        const letras = ultimo.skuInterno.slice(0, 2);
        const num = parseInt(ultimo.skuInterno.slice(2), 10);
        if (num < 99) return `${letras}${String(num + 1).padStart(2, "0")}`;
        const nextLetras = letras[1] < "Z" ? letras[0] + String.fromCharCode(letras.charCodeAt(1) + 1) : String.fromCharCode(letras.charCodeAt(0) + 1) + "A";
        return `${nextLetras}00`;
      })();
      const nuevo = await prisma.producto.create({
        data: {
          skuInterno: skuInternoAuto,
          nombre,
          marca: proveedor.nombre,
          categoria,
          presentacion: "INDIVIDUAL",
          precioCostoUnitario: precioBase,
          precioVenta: precioBase * 1.3,
        },
      });
      nuevoProductoId = nuevo.id;
      await prisma.historialStockMayorista.updateMany({
        where: { sku: itemSku, proveedorId },
        data: { productoId: nuevo.id },
      });
    }
  }

  const precioCostoUnitario = precioListaUnitario * (1 - descuentoPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const compra = await tx.compra.findUniqueOrThrow({ where: { id } });
    const productoFinalId = nuevoProductoId ?? compra.productoId;

    if (nuevoProductoId && nuevoProductoId !== compra.productoId) {
      // Revertir stock del producto original
      await tx.producto.update({
        where: { id: compra.productoId },
        data: { stockActual: { decrement: compra.cantidad } },
      });
      // Agregar stock y actualizar precio en el nuevo producto
      const nuevoProducto = await tx.producto.findUniqueOrThrow({ where: { id: nuevoProductoId } });
      const precioVenta = precioCostoUnitario * (1 + Number(nuevoProducto.margenPorcentaje) / 100);
      await tx.producto.update({
        where: { id: nuevoProductoId },
        data: { stockActual: { increment: cantidad }, precioCostoUnitario, precioVenta },
      });
    } else {
      // Mismo producto: ajustar delta y actualizar precio
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: compra.productoId } });
      const deltaCantidad = cantidad - compra.cantidad;
      const precioVenta = precioCostoUnitario * (1 + Number(producto.margenPorcentaje) / 100);
      await tx.producto.update({
        where: { id: compra.productoId },
        data: { stockActual: { increment: deltaCantidad }, precioCostoUnitario, precioVenta },
      });
    }

    const productoFinal = await tx.producto.findUniqueOrThrow({ where: { id: productoFinalId } });

    await tx.compra.update({
      where: { id },
      data: {
        productoId: productoFinalId,
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
      detalle: `${productoFinal.nombre} x${cantidad}`,
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
      detalle: `${producto.nombre} (${producto.skuInterno})`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/ventas/nueva");
}

// Genera el siguiente skuInterno correlativo (AA00 → AA01 → ... → ZZ99).
// Busca el máximo actual en la DB y devuelve el siguiente.
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

  // Incrementar letras
  const l2 = letras[1];
  const l1 = letras[0];
  if (l2 < "Z") return `${l1}${String.fromCharCode(l2.charCodeAt(0) + 1)}00`;
  if (l1 < "Z") return `${String.fromCharCode(l1.charCodeAt(0) + 1)}A00`;

  throw new Error("Se agotaron los SKU internos disponibles (ZZ99).");
}

export async function crearProducto(formData: FormData) {
  const session = await requireAdmin();

  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim();
  const presentacion = formData.get("presentacion")?.toString() as Presentacion;
  const unidadMedida = formData.get("unidadMedida")?.toString() as UnidadMedida;
  const contenido = Number(formData.get("contenido") || 1);
  const margenPorcentaje = Number(formData.get("margenPorcentaje") || 30);
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario") || 0);
  const stockActual = 0;

  if (!nombre || !marca || !categoria || !presentacion || !unidadMedida) {
    throw new Error("Faltan datos del producto.");
  }

  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const skuInternoAuto = await siguienteSkuInterno(tx);
    const producto = await tx.producto.create({
      data: { skuInterno: skuInternoAuto, nombre, marca, categoria, presentacion, unidadMedida, contenido, margenPorcentaje, precioCostoUnitario, precioVenta, stockActual },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "CREAR",
      entidad: "PRODUCTO",
      entidadId: producto.id,
      detalle: `${nombre} (${skuInternoAuto})`,
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/ventas/nueva");
  redirect("/inventario");
}

export async function reactivarProducto(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) throw new Error("Producto inválido.");
  await prisma.producto.update({ where: { id }, data: { activo: true } });
  revalidatePath("/inventario");
}

export async function actualizarProducto(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!id) throw new Error("Producto inválido.");

  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim();
  const presentacion = formData.get("presentacion")?.toString() as Presentacion;
  const unidadMedida = formData.get("unidadMedida")?.toString() as UnidadMedida;
  const contenido = Number(formData.get("contenido"));
  const margenPorcentaje = Number(formData.get("margenPorcentaje"));
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario"));

  if (!nombre || !marca || !categoria || !presentacion || !unidadMedida) {
    throw new Error("Faltan datos del producto.");
  }
  if (!contenido || contenido <= 0) throw new Error("El contenido debe ser mayor a 0.");
  if (margenPorcentaje < 0) throw new Error("El margen no es válido.");

  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const prod = await tx.producto.update({
      where: { id },
      data: { nombre, marca, categoria, presentacion, unidadMedida, contenido, margenPorcentaje, precioCostoUnitario, precioVenta },
    });

    await registrarLog(tx, {
      usuarioId: Number(session.user.id),
      accion: "ACTUALIZAR",
      entidad: "PRODUCTO",
      entidadId: id,
      detalle: `${nombre} (${prod.skuInterno})`,
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
  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim();
  const presentacion = formData.get("presentacion")?.toString() as Presentacion;
  const unidadMedida = formData.get("unidadMedida")?.toString() as UnidadMedida;
  const contenido = Number(formData.get("contenido"));
  const margenPorcentaje = Number(formData.get("margenPorcentaje"));
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario"));

  if (!nombre || !marca || !categoria || !presentacion || !unidadMedida) {
    throw new Error("Faltan datos del producto.");
  }
  if (!contenido || contenido <= 0) throw new Error("El contenido debe ser mayor a 0.");
  if (margenPorcentaje < 0) throw new Error("El margen no es válido.");
  if (!precioCostoUnitario || precioCostoUnitario <= 0) throw new Error("El precio de costo no es válido.");

  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  await prisma.$transaction(async (tx) => {
    const skuInternoAuto = await siguienteSkuInterno(tx);
    const producto = await tx.producto.create({
      data: {
        skuInterno: skuInternoAuto,
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
      detalle: `${nombre} (${skuInternoAuto}) desde lista proveedor`,
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

// Normaliza un SKU: saca el primer cero si empieza con uno y convierte a minúsculas.
// Así "06443-0.355" → "6443-0.355" y "6410-12KG" → "6410-12kg" (evita duplicados por capitalización).
function normalizarSku(sku: string): string {
  const s = sku.startsWith("0") ? sku.slice(1) : sku;
  return s.toLowerCase();
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
// Detecta automáticamente si el separador es ";" o ",".
function parsearCSV(texto: string): Record<string, string>[] {
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

// Parsea el campo Tamaño del CSV de HYM y retorna contenido y unidadMedida.
// Ejemplos: "12 Kg" → {contenido: 12, unidad: KILOGRAMOS}
//           "1.5 Kg" → {contenido: 1.5, unidad: KILOGRAMOS}
//           "0.355"  → {contenido: 355, unidad: GRAMOS} (decimal sin unidad = kg, convertimos a g si < 1)
//           "0.340"  → {contenido: 340, unidad: GRAMOS}
//           "7.5 Kg" → {contenido: 7.5, unidad: KILOGRAMOS}
function parsearTamanio(tamanio: string): { contenido: number; unidad: string } | null {
  const t = tamanio.trim();
  if (!t) return null;

  // Formato "X.X Kg" o "X Kg"
  const matchKg = t.match(/^([\d.]+)\s*[Kk][Gg]$/);
  if (matchKg) {
    return { contenido: Number(matchKg[1]), unidad: "KILOGRAMOS" };
  }

  // Formato "X.X Lt" o "X Lt"
  const matchLt = t.match(/^([\d.]+)\s*[Ll][Tt]$/);
  if (matchLt) {
    return { contenido: Number(matchLt[1]), unidad: "LITROS" };
  }

  // Formato numérico puro (decimal sin unidad = kg implícito en el CSV de HYM)
  // Si es < 1 lo convertimos a gramos
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

  const esHym = await prisma.proveedor.findUnique({
    where: { id: Number(proveedorId) },
    select: { nombre: true },
  });
  const importandoHym = esHym?.nombre?.toUpperCase() === "HYM";

  // Matching por SKU de proveedor a través del historial
  const historialItems = await prisma.historialStockMayorista.findMany({
    where: { proveedorId: Number(proveedorId), productoId: { not: null } },
    select: { sku: true, productoId: true, producto: { select: { id: true, skuInterno: true, nombre: true, margenPorcentaje: true } } },
  });
  const productosPorSku = new Map(
    historialItems
      .filter((h) => h.producto)
      .map((h) => [h.sku, h.producto!])
  );

  let actualizados = 0;
  let nuevos = 0;
  const ahora = new Date();

  // Marcar como inactivos los items que ya no aparecen en esta importación
  const skusImportados = new Set(filasPorSku.keys());
  await prisma.historialStockMayorista.updateMany({
    where: {
      proveedorId: Number(proveedorId),
      activo: true,
      sku: { notIn: [...skusImportados] },
    },
    data: { activo: false },
  });

  // Reactivar items que vuelven a aparecer
  await prisma.historialStockMayorista.updateMany({
    where: {
      proveedorId: Number(proveedorId),
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

    let producto = productosPorSku.get(sku) ?? null;

    if (producto) {
      // Producto ya existe — actualizar precio si es HYM (lista madre)
      if (importandoHym) {
        const precioVenta = precioCosto * (1 + Number(producto.margenPorcentaje) / 100);
        await prisma.producto.update({
          where: { id: producto.id },
          data: { precioCostoUnitario: precioCosto, precioVenta },
        });
      }
      actualizados++;
    } else if (importandoHym) {
      // Producto nuevo en HYM → crear en catálogo y vincular
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
    // Para otros proveedores: si no hay producto, queda sin vincular (productoId null)

    await prisma.historialStockMayorista.upsert({
      where: { proveedorId_sku: { proveedorId: Number(proveedorId), sku } },
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
      },
      create: {
        productoId: producto?.id ?? null,
        proveedorId: Number(proveedorId),
        sku,
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

  revalidatePath("/inventario");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");

  return { total: filasPorSku.size, actualizados, nuevos };
}
