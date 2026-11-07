import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NuevaConsignacionForm } from "./nueva-consignacion-form";

function prefijoDe(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 4) || "PR";
}

export default async function NuevaConsignacionPage() {
  const [socios, productos, proveedoresRaw, tipos, todosSkus] = await Promise.all([
    prisma.socioConsignacion.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, marca: true, stockActual: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.tipoProducto.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({ where: { activo: true }, select: { skuInterno: true } }),
  ]);

  void todosSkus; // ya no se usa para generar SKUs
  const proveedores = proveedoresRaw.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    prefijo: "",
    siguienteNumero: 1,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/consignaciones" className="text-xs text-gray-400 hover:text-gray-600">← Consignaciones</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Nueva consignación</h1>
      </div>
      <NuevaConsignacionForm socios={socios} productos={productos} proveedores={proveedores} tipos={tipos} />
    </div>
  );
}
