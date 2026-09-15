import { prisma } from "@/lib/prisma";
import { crearUsoInterno } from "./actions";
import { UsoInternoForm } from "./uso-interno-form";

export default async function UsoInternoPage() {
  const [productos, usuarios] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, skuInterno: true, nombre: true, stockActual: true, precioCostoUnitario: true },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, apellido: true },
    }),
  ]);

  const productosPlain = productos.map((p) => ({
    ...p,
    precioCostoUnitario: p.precioCostoUnitario.toString(),
  }));

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Uso interno / Contenido</h1>
        <p className="mt-1 text-sm text-gray-500">
          Para productos que se entregan a costo (por ejemplo, a la community manager para grabar contenido).
          Se descuenta el stock y se registra automáticamente como gasto de Marketing — no genera una venta ni
          entra dinero.
        </p>
      </div>

      <form action={crearUsoInterno} className="rounded-xl border border-gray-200 bg-white p-4">
        <UsoInternoForm productos={productosPlain} usuarios={usuarios} fechaDefault={hoy} />
      </form>
    </div>
  );
}
