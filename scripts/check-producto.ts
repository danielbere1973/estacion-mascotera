import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const p = await db.producto.findFirst({
    where: { sku: "6502-1.5KG" },
    include: {
      compras: { orderBy: { id: "desc" } },
      detalleVentas: { orderBy: { id: "desc" } },
    },
  });
  if (!p) { console.log("Producto no encontrado"); return; }
  console.log(`Producto: ${p.nombre} | SKU: ${p.sku} | stock: ${p.stockActual}`);
  console.log(`\nCompras (${p.compras.length}):`);
  p.compras.forEach(c => console.log(`  #${c.id} | cantidad: ${c.cantidad} | fecha: ${new Date(c.fechaCompra).toLocaleDateString("es-AR")}`));
  console.log(`\nVentas (${p.detalleVentas.length}):`);
  p.detalleVentas.forEach(d => console.log(`  detalle #${d.id} | cantidad: ${d.cantidad}`));

  const totalComprado = p.compras.reduce((s, c) => s + c.cantidad, 0);
  const totalVendido = p.detalleVentas.reduce((s, d) => s + d.cantidad, 0);
  console.log(`\nTotal comprado: ${totalComprado} | Total vendido: ${totalVendido} | Stock esperado: ${totalComprado - totalVendido}`);
}
main().catch(console.error).finally(() => db.$disconnect());
