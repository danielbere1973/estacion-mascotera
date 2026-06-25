import { PrismaClient } from "@prisma/client";
const neon = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } } });

// Pedidos a asignar: [numeroPedido, fecha, SKU, precioAproximado]
const pedidos: [string, string, string, number][] = [
  // Pedido 733
  ["733", "2026-06-13", "02152",        195600],
  ["733", "2026-06-12", "2156-1.5KG",   23721.88],

  // Pedido 496
  ["496", "2026-06-16", "2055-0.195",   62328],
  ["496", "2026-06-16", "02152",        146700],
  ["496", "2026-06-16", "112-7.5KG",    64190],
  ["496", "2026-06-16", "112-3KG",      30086],

  // Pedido 555
  ["555", "2026-06-16", "2156-1.5KG",   24700],
  ["555", "2026-06-16", "1331-1.5KG",   23337.72],

  // Pedido 572
  ["572", "2026-06-16", "4294-15KG",    53500],
  ["572", "2026-06-16", "4136-1.5KG",   23400],
  ["572", "2026-06-16", "191-2KG",      32400],
  ["572", "2026-06-16", "30004220",     31900],
  ["572", "2026-06-16", "6502-1.5KG",   23000],
  ["572", "2026-06-16", "2156-1.5KG",   24700],
  ["572", "2026-06-16", "1331-1.5KG",   23337.72],
];

async function main() {
  // Primero mostramos lo que encontramos antes de tocar nada
  console.log("=== Vista previa ===\n");

  const asignaciones: { id: number; pedido: string; sku: string; nombre: string; precio: number }[] = [];
  const yaUsados = new Set<number>();

  for (const [pedido, fecha, sku, precio] of pedidos) {
    const desde = new Date(fecha + "T00:00:00-03:00");
    const hasta = new Date(fecha + "T23:59:59-03:00");

    const compras = await neon.compra.findMany({
      where: {
        fechaCompra: { gte: desde, lte: hasta },
        producto: { sku },
      },
      include: { producto: { select: { sku: true, nombre: true } } },
    });

    // Si hay varias (duplicados SKU en mismo pedido), tomar la que no fue usada aún y cuyo precio sea más cercano
    const candidatos = compras
      .filter(c => !yaUsados.has(c.id))
      .sort((a, b) => Math.abs(Number(a.precioCostoUnitario) - precio) - Math.abs(Number(b.precioCostoUnitario) - precio));

    if (candidatos.length === 0) {
      console.log(`⚠ No encontré: pedido ${pedido} / ${sku} / ${fecha} / $${precio}`);
      continue;
    }

    const c = candidatos[0];
    yaUsados.add(c.id);
    asignaciones.push({ id: c.id, pedido, sku: c.producto.sku, nombre: c.producto.nombre, precio: Number(c.precioCostoUnitario) });
    console.log(`  Pedido ${pedido} → Compra #${c.id} | ${c.producto.sku} · ${c.producto.nombre} | precio=$${Number(c.precioCostoUnitario)}`);
  }

  console.log(`\nTotal a actualizar: ${asignaciones.length}`);
  console.log("\n¿Aplicar? Cambiá DRY_RUN a false para confirmar.");

  const DRY_RUN = false;

  if (!DRY_RUN) {
    for (const a of asignaciones) {
      await neon.compra.update({ where: { id: a.id }, data: { numeroPedido: a.pedido } });
    }
    console.log("✅ Numeración de pedidos aplicada.");
  }
}

main().catch(console.error).finally(() => neon.$disconnect());
