"use client";

import { useMemo } from "react";
import { formatARS } from "@/lib/reporte-utils";
import { TablaRanking, type Columna } from "./tabla-ranking";

export type ProductoRanking = { sku: string; nombre: string; unidades: number; total: number; ventas: number };
export type ClienteRanking = { nombre: string; compras: number; unidades: number; total: number };
export type GastoCategoria = { categoria: string; cantidad: number; total: number };

const sumar = <T,>(items: T[], f: (t: T) => number) => items.reduce((a, t) => a + f(t), 0);

// ---- Productos ----
const columnasProductos: Columna<ProductoRanking>[] = [
  { key: "sku", label: "SKU", valor: (p) => p.sku, ocultarMobile: true, render: (p) => <span className="text-gray-500">{p.sku}</span> },
  {
    key: "nombre",
    label: "Producto",
    valor: (p) => p.nombre,
    render: (p) => (
      <>
        {p.nombre}
        <span className="block text-xs text-gray-400 sm:hidden">{p.sku}</span>
      </>
    ),
  },
  { key: "unidades", label: "Unidades", valor: (p) => p.unidades, align: "right", destacada: true, total: (ps) => sumar(ps, (p) => p.unidades) },
  { key: "total", label: "Total", valor: (p) => p.total, align: "right", render: (p) => formatARS(p.total), total: (ps) => formatARS(sumar(ps, (p) => p.total)) },
];
const textoProducto = (p: ProductoRanking) => `${p.nombre} ${p.sku}`;

export function ProductosMasVendidos({ productos }: { productos: ProductoRanking[] }) {
  return (
    <TablaRanking
      items={productos}
      columnas={columnasProductos}
      textoBusqueda={textoProducto}
      placeholder="Buscar por nombre o SKU…"
      vacio="Sin ventas en el período"
      sinCoincidencias="Ningún producto coincide con la búsqueda"
      nombrePlural="productos"
      criterio="ranking por unidades vendidas"
    />
  );
}

// ---- Clientes ----
const columnasClientes: Columna<ClienteRanking>[] = [
  { key: "nombre", label: "Cliente", valor: (c) => c.nombre },
  { key: "compras", label: "Compras", valor: (c) => c.compras, align: "right", total: (cs) => sumar(cs, (c) => c.compras) },
  { key: "unidades", label: "Unidades", valor: (c) => c.unidades, align: "right", ocultarMobile: true, total: (cs) => sumar(cs, (c) => c.unidades) },
  { key: "total", label: "Total", valor: (c) => c.total, align: "right", destacada: true, render: (c) => formatARS(c.total), total: (cs) => formatARS(sumar(cs, (c) => c.total)) },
];
const textoCliente = (c: ClienteRanking) => c.nombre;

export function ClientesMasCompras({ clientes }: { clientes: ClienteRanking[] }) {
  return (
    <TablaRanking
      items={clientes}
      columnas={columnasClientes}
      textoBusqueda={textoCliente}
      placeholder="Buscar cliente…"
      vacio="Sin ventas en el período"
      sinCoincidencias="Ningún cliente coincide con la búsqueda"
      nombrePlural="clientes"
      criterio="ranking por total comprado"
    />
  );
}

// ---- Gastos por categoría ----
const textoGasto = (g: GastoCategoria) => g.categoria;

export function GastosPorCategoria({ categorias }: { categorias: GastoCategoria[] }) {
  // El % es siempre sobre el total general del período, aunque se filtre.
  const columnas = useMemo<Columna<GastoCategoria>[]>(() => {
    const totalGeneral = sumar(categorias, (c) => c.total);
    const pct = (n: number) => (totalGeneral > 0 ? `${((n / totalGeneral) * 100).toFixed(1)}%` : "-");
    return [
      { key: "categoria", label: "Categoría", valor: (c) => c.categoria },
      { key: "cantidad", label: "Gastos", valor: (c) => c.cantidad, align: "right", total: (cs) => sumar(cs, (c) => c.cantidad) },
      { key: "pct", label: "% del total", valor: (c) => c.total, align: "right", ocultarMobile: true, render: (c) => pct(c.total), total: (cs) => pct(sumar(cs, (c) => c.total)) },
      { key: "total", label: "Total", valor: (c) => c.total, align: "right", destacada: true, render: (c) => formatARS(c.total), total: (cs) => formatARS(sumar(cs, (c) => c.total)) },
    ];
  }, [categorias]);

  return (
    <TablaRanking
      items={categorias}
      columnas={columnas}
      textoBusqueda={textoGasto}
      placeholder="Buscar categoría…"
      vacio="Sin gastos en el período"
      sinCoincidencias="Ninguna categoría coincide con la búsqueda"
      nombrePlural="categorías"
      criterio="ranking por monto"
    />
  );
}
