import { PrismaClient } from "@prisma/client";

const cockroach = new PrismaClient({
  datasources: { db: { url: "postgresql://em_sysadmin:vZ6oi4baqjoxuhRf3hluxA@estacionmascotera-27518.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full" } },
});

const neon = new PrismaClient({
  datasources: { db: { url: "postgresql://neondb_owner:npg_lCsV9rtzog6T@ep-spring-snow-ahqcq0l1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" } },
});

async function main() {
  const [cVentas, nVentas] = await Promise.all([cockroach.venta.count(), neon.venta.count()]);
  const [cCompras, nCompras] = await Promise.all([cockroach.compra.count(), neon.compra.count()]);
  const [cGastos, nGastos] = await Promise.all([cockroach.gasto.count(), neon.gasto.count()]);
  const [cProductos, nProductos] = await Promise.all([cockroach.producto.count(), neon.producto.count()]);
  const [cClientes, nClientes] = await Promise.all([cockroach.cliente.count(), neon.cliente.count()]);

  console.log("                  CockroachDB  |  Neon");
  console.log(`Ventas:           ${String(cVentas).padStart(11)}  |  ${nVentas}`);
  console.log(`Compras:          ${String(cCompras).padStart(11)}  |  ${nCompras}`);
  console.log(`Gastos:           ${String(cGastos).padStart(11)}  |  ${nGastos}`);
  console.log(`Productos:        ${String(cProductos).padStart(11)}  |  ${nProductos}`);
  console.log(`Clientes:         ${String(cClientes).padStart(11)}  |  ${nClientes}`);

  // Mostrar ventas nuevas en Cockroach que no están en Neon
  const ventasCockroach = await cockroach.venta.findMany({ orderBy: { id: "desc" }, take: 5, include: { cliente: true } });
  const ventasNeon = await neon.venta.findMany({ orderBy: { id: "desc" }, take: 5, include: { cliente: true } });

  console.log("\nÚltimas ventas en CockroachDB:");
  ventasCockroach.forEach(v => console.log(`  #${v.id} - ${v.cliente.nombre} ${v.cliente.apellido} - ${new Date(v.fechaVenta).toLocaleDateString("es-AR")}`));

  console.log("\nÚltimas ventas en Neon:");
  ventasNeon.forEach(v => console.log(`  #${v.id} - ${v.cliente.nombre} ${v.cliente.apellido} - ${new Date(v.fechaVenta).toLocaleDateString("es-AR")}`));
}

main().catch(console.error).finally(async () => {
  await cockroach.$disconnect();
  await neon.$disconnect();
});
