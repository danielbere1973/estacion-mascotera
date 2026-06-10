"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CategoriaProducto, Presentacion } from "@prisma/client";

export async function crearCompra(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

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

  const cantidad = Number(formData.get("cantidad"));
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario"));
  const costoEnvio = Number(formData.get("costoEnvio") || 0);
  const numeroPedido = formData.get("numeroPedido")?.toString().trim() || null;
  const facturado = formData.get("facturado") === "on";
  const numeroFactura = formData.get("numeroFactura")?.toString().trim() || null;

  if (!cantidad || cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0.");
  if (precioCostoUnitario < 0) throw new Error("El precio de costo no es válido.");

  let productoId = formData.get("productoId")?.toString();

  await prisma.$transaction(async (tx) => {
    if (productoId === "nuevo") {
      const sku = formData.get("productoSku")?.toString().trim();
      const nombre = formData.get("productoNombre")?.toString().trim();
      const marca = formData.get("productoMarca")?.toString().trim();
      const categoria = formData.get("productoCategoria")?.toString() as CategoriaProducto;
      const presentacion = formData.get("productoPresentacion")?.toString() as Presentacion;
      const margenPorcentaje = Number(formData.get("productoMargen") || 30);

      if (!sku || !nombre || !marca || !categoria || !presentacion) {
        throw new Error("Faltan datos del producto nuevo.");
      }

      const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

      const producto = await tx.producto.create({
        data: {
          sku,
          nombre,
          marca,
          categoria,
          presentacion,
          margenPorcentaje,
          precioCostoUnitario,
          precioVenta,
          stockActual: cantidad,
        },
      });
      productoId = String(producto.id);
    } else {
      if (!productoId) throw new Error("Debe seleccionar un producto.");

      const producto = await tx.producto.findUniqueOrThrow({
        where: { id: Number(productoId) },
      });

      const precioVenta =
        precioCostoUnitario * (1 + Number(producto.margenPorcentaje) / 100);

      await tx.producto.update({
        where: { id: producto.id },
        data: {
          precioCostoUnitario,
          precioVenta,
          stockActual: { increment: cantidad },
        },
      });
    }

    await tx.compra.create({
      data: {
        proveedorId: Number(proveedorId),
        productoId: Number(productoId),
        cantidad,
        precioCostoUnitario,
        costoEnvio,
        numeroPedido,
        facturado,
        numeroFactura,
        usuarioId: Number(session.user.id),
      },
    });
  });

  revalidatePath("/inventario");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");
  redirect("/inventario");
}

interface FilaExcel {
  SKU?: string;
  sku?: string;
  Nombre?: string;
  nombre?: string;
  Costo?: number;
  costo?: number;
  "Stock Mayorista"?: number;
  stock_mayorista?: number;
}

export async function importarExcel(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Subí un archivo .xlsx o .csv");

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<FilaExcel>(sheet);

  let actualizados = 0;
  let sinCoincidencia = 0;
  const ahora = new Date();

  for (const fila of filas) {
    const sku = String(fila.SKU ?? fila.sku ?? "").trim();
    if (!sku) continue;

    const costo = Number(fila.Costo ?? fila.costo ?? 0);
    const stockMayorista = Number(fila["Stock Mayorista"] ?? fila.stock_mayorista ?? 0);

    const producto = await prisma.producto.findUnique({ where: { sku } });

    if (producto) {
      const precioVenta = costo * (1 + Number(producto.margenPorcentaje) / 100);
      await prisma.producto.update({
        where: { id: producto.id },
        data: { precioCostoUnitario: costo, precioVenta },
      });
      actualizados++;
    } else {
      sinCoincidencia++;
    }

    await prisma.historialStockMayorista.create({
      data: {
        productoId: producto?.id ?? null,
        sku,
        precioCostoScraped: costo,
        stockMayoristaScraped: stockMayorista,
        fechaImportacion: ahora,
      },
    });
  }

  revalidatePath("/inventario");
  revalidatePath("/");
  revalidatePath("/ventas/nueva");

  return { total: filas.length, actualizados, sinCoincidencia };
}
