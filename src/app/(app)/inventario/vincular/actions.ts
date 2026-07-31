"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { Presentacion, UnidadMedida } from "@prisma/client";

export async function vincularItem(formData: FormData) {
  await requireAdmin();

  const historialId = Number(formData.get("historialId"));
  const productoId = Number(formData.get("productoId"));
  if (!historialId || !productoId) throw new Error("Datos inválidos.");

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId },
  });

  revalidatePath("/inventario/vincular");
}

export async function desvincularItem(formData: FormData) {
  await requireAdmin();

  const historialId = Number(formData.get("historialId"));
  if (!historialId) throw new Error("Datos inválidos.");

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId: null },
  });

  revalidatePath("/inventario/vincular");
}

export async function crearYVincularProducto(formData: FormData) {
  await requireAdmin();

  const historialId = Number(formData.get("historialId"));
  const nombre = formData.get("nombre")?.toString().trim();
  const marca = formData.get("marca")?.toString().trim();
  const categoria = formData.get("categoria")?.toString().trim() || "Sin categorizar";
  const precioCostoUnitario = Number(formData.get("precioCostoUnitario") || 0);
  const margenPorcentaje = Number(formData.get("margenPorcentaje") || 30);

  if (!historialId || !nombre || !marca) throw new Error("Faltan datos obligatorios.");

  // Generar skuInterno correlativo AA00 → AA01 → ... → ZZ99
  const ultimo = await prisma.producto.findFirst({
    where: { skuInterno: { not: null } },
    orderBy: { skuInterno: "desc" },
    select: { skuInterno: true },
  });

  const skuInterno = generarSiguienteSkuInterno(ultimo?.skuInterno ?? null);
  const precioVenta = precioCostoUnitario * (1 + margenPorcentaje / 100);

  const item = await prisma.historialStockMayorista.findUnique({
    where: { id: historialId },
    select: { sku: true, proveedorId: true },
  });
  if (!item) throw new Error("Item no encontrado.");

  const producto = await prisma.producto.create({
    data: {
      sku: item.sku,
      skuInterno,
      nombre,
      marca,
      categoria,
      presentacion: "INDIVIDUAL" as Presentacion,
      unidadMedida: "KILOGRAMOS" as UnidadMedida,
      contenido: 1,
      margenPorcentaje,
      precioCostoUnitario,
      precioVenta,
      stockActual: 0,
    },
  });

  await prisma.historialStockMayorista.update({
    where: { id: historialId },
    data: { productoId: producto.id },
  });

  revalidatePath("/inventario/vincular");
}

function generarSiguienteSkuInterno(ultimo: string | null | undefined): string {
  if (!ultimo || !/^[A-Z]{2}\d{2}$/.test(ultimo)) return "AA00";

  const letras = ultimo.slice(0, 2);
  const nums = parseInt(ultimo.slice(2), 10);

  if (nums < 99) {
    return `${letras}${String(nums + 1).padStart(2, "0")}`;
  }

  // Incrementar letras
  const l2 = letras[1];
  const l1 = letras[0];
  if (l2 < "Z") return `${l1}${String.fromCharCode(l2.charCodeAt(0) + 1)}00`;
  if (l1 < "Z") return `${String.fromCharCode(l1.charCodeAt(0) + 1)}A00`;
  throw new Error("Se agotaron los códigos internos.");
}
