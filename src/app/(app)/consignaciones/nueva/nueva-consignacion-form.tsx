"use client";

import { useState } from "react";
import { crearConsignacion } from "../actions";

type Socio = { id: number; nombre: string; proveedorId: number | null };
type Producto = { id: number; nombre: string; marca: string; stockActual: number };
type Proveedor = { id: number; nombre: string; prefijo: string; siguienteNumero: number };
type TipoProducto = { id: number; nombre: string };

const ITEM_VACIO = {
  productoId: "",
  esNuevo: false,
  descripcion: "",
  cantidad: 1,
  costo: 0,
  piso: 0,
  nuevoSku: "",
  nuevoNombre: "",
  nuevoMarca: "",
  nuevoCategoria: "",
  nuevoPresentacion: "",
  nuevoUnidadMedida: "UNIDAD",
  nuevoContenido: 1,
  nuevoProveedorId: "",
};

export function NuevaConsignacionForm({
  socios, productos, proveedores, tipos,
}: { socios: Socio[]; productos: Producto[]; proveedores: Proveedor[]; tipos: TipoProducto[] }) {
  const today = new Date().toISOString().split("T")[0];
  const [direccion, setDireccion] = useState<"ENTREGAMOS" | "RECIBIMOS">("ENTREGAMOS");
  const [socioId, setSocioId] = useState("");
  const [items, setItems] = useState([{ ...ITEM_VACIO }]);

  const socioSeleccionado = socios.find((s) => String(s.id) === socioId);

  const addItem = () => setItems([...items, { ...ITEM_VACIO }]);
  const removeItem = (i: number) => setItems(items.filter((_, j) => j !== i));
  const updateItem = (i: number, field: string, value: string | number | boolean) =>
    setItems(items.map((it, j) => (j === i ? { ...it, [field]: value } : it)));

  const proveedorIdDeItem = (it: typeof ITEM_VACIO) =>
    socioSeleccionado?.proveedorId ?? (it.nuevoProveedorId ? Number(it.nuevoProveedorId) : null);

  const sugerirSku = (proveedorId: number | null, hastaIndice: number) => {
    const prov = proveedores.find((p) => p.id === proveedorId);
    if (!prov) return "";
    let n = prov.siguienteNumero;
    for (let j = 0; j < hastaIndice; j++) {
      if (items[j].esNuevo && proveedorIdDeItem(items[j]) === proveedorId) n++;
    }
    return `${prov.prefijo}${String(n).padStart(4, "0")}`;
  };

  return (
    <form action={crearConsignacion} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Socio *</label>
          <select
            name="socioId"
            required
            value={socioId}
            onChange={(e) => setSocioId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar...</option>
            {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <input name="fecha" type="date" defaultValue={today} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Dirección *</label>
        <div className="flex gap-4">
          {(["ENTREGAMOS", "RECIBIMOS"] as const).map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="direccion" value={d} checked={direccion === d} onChange={() => {
                setDireccion(d);
                if (d === "ENTREGAMOS") setItems(items.map((it) => (it.esNuevo ? { ...ITEM_VACIO } : it)));
              }} />
              {d === "ENTREGAMOS" ? "Nosotros entregamos mercadería al socio" : "El socio nos entrega mercadería a nosotros"}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {direccion === "ENTREGAMOS"
            ? "El socio la vende por nosotros. Al registrar ventas, el socio nos paga el precio piso."
            : "Nosotros la vendemos por el socio. Al registrar ventas, le pagamos el precio piso al socio."}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Productos</label>
          <button type="button" onClick={addItem}
            className="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">
            + Agregar ítem
          </button>
        </div>

        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-lg bg-gray-50 p-3">
            <div className="col-span-7 space-y-1">
              <label className="text-xs text-gray-500">Producto del catálogo</label>
              <select
                value={item.esNuevo ? "__nuevo__" : item.productoId}
                onChange={(e) => {
                  if (e.target.value === "__nuevo__") {
                    const proveedorId = socioSeleccionado?.proveedorId ?? null;
                    setItems(items.map((it, j) => j === i ? {
                      ...it, esNuevo: true, productoId: "",
                      nuevoSku: proveedorId ? sugerirSku(proveedorId, i) : it.nuevoSku,
                    } : it));
                  } else {
                    updateItem(i, "esNuevo", false);
                    updateItem(i, "productoId", e.target.value);
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="">— Sin vincular (no afecta stock) —</option>
                {direccion === "RECIBIMOS" && (
                  <option value="__nuevo__">+ Crear producto nuevo en Inventario</option>
                )}
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.marca}) — stock: {p.stockActual}</option>
                ))}
              </select>
              <input type="hidden" name="itemProductoId" value={item.esNuevo ? "" : item.productoId} />
            </div>
            {!item.esNuevo && (
              <div className="col-span-1 space-y-1">
                <label className="text-xs text-gray-500">Descripción</label>
                <input
                  name="itemDescripcion"
                  value={item.descripcion}
                  onChange={(e) => updateItem(i, "descripcion", e.target.value)}
                  placeholder="opcional"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                />
              </div>
            )}
            {item.esNuevo && <input type="hidden" name="itemDescripcion" value="" />}
            <div className="col-span-1 space-y-1">
              <label className="text-xs text-gray-500">Cant.</label>
              <input
                name="itemCantidad"
                type="number"
                min={1}
                step={1}
                value={item.cantidad}
                onChange={(e) => updateItem(i, "cantidad", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-gray-500">Costo real</label>
              <input
                name="itemCosto"
                type="number"
                min={0}
                step={0.01}
                value={item.costo}
                onChange={(e) => updateItem(i, "costo", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-gray-500">Precio piso</label>
              <input
                name="itemPiso"
                type="number"
                min={0}
                step={0.01}
                value={item.piso}
                onChange={(e) => updateItem(i, "piso", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </div>
            {item.esNuevo && (
              <div className="col-span-12 grid grid-cols-12 gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="col-span-12 text-xs font-medium text-blue-700">Datos del producto nuevo (se va a crear en Inventario)</p>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-500">SKU</label>
                  <input
                    name="itemNuevoSku"
                    required={item.esNuevo}
                    value={item.nuevoSku}
                    onChange={(e) => updateItem(i, "nuevoSku", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-4 space-y-1">
                  <label className="text-xs text-gray-500">Nombre</label>
                  <input
                    name="itemNuevoNombre"
                    required={item.esNuevo}
                    value={item.nuevoNombre}
                    onChange={(e) => updateItem(i, "nuevoNombre", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-500">Marca</label>
                  <input
                    name="itemNuevoMarca"
                    required={item.esNuevo}
                    value={item.nuevoMarca}
                    onChange={(e) => updateItem(i, "nuevoMarca", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-gray-500">Categoría</label>
                  <select
                    name="itemNuevoCategoria"
                    required={item.esNuevo}
                    value={item.nuevoCategoria}
                    onChange={(e) => updateItem(i, "nuevoCategoria", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {tipos.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-500">Presentación</label>
                  <select
                    name="itemNuevoPresentacion"
                    required={item.esNuevo}
                    value={item.nuevoPresentacion}
                    onChange={(e) => updateItem(i, "nuevoPresentacion", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="" disabled>Seleccionar...</option>
                    <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
                    <option value="CAJA_CERRADA">Caja Cerrada</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-500">Unidad de medida</label>
                  <select
                    name="itemNuevoUnidadMedida"
                    value={item.nuevoUnidadMedida}
                    onChange={(e) => updateItem(i, "nuevoUnidadMedida", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="KILOGRAMOS">Kilogramos</option>
                    <option value="GRAMOS">Gramos</option>
                    <option value="LITROS">Litros</option>
                    <option value="MILILITROS">Mililitros</option>
                    <option value="UNIDAD">Unidad</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-gray-500">Contenido</label>
                  <input
                    name="itemNuevoContenido"
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.nuevoContenido}
                    onChange={(e) => updateItem(i, "nuevoContenido", Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-4 space-y-1">
                  <label className="text-xs text-gray-500">Proveedor</label>
                  {socioSeleccionado?.proveedorId ? (
                    <>
                      <input type="hidden" name="itemNuevoProveedorId" value={socioSeleccionado.proveedorId} />
                      <p className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600">
                        {proveedores.find((p) => p.id === socioSeleccionado.proveedorId)?.nombre ?? "—"} (del socio)
                      </p>
                    </>
                  ) : (
                    <select
                      name="itemNuevoProveedorId"
                      required={item.esNuevo}
                      value={item.nuevoProveedorId}
                      onChange={(e) => {
                        const proveedorId = e.target.value ? Number(e.target.value) : null;
                        setItems(items.map((it, j) => j === i ? {
                          ...it, nuevoProveedorId: e.target.value,
                          nuevoSku: proveedorId ? sugerirSku(proveedorId, i) : it.nuevoSku,
                        } : it));
                      }}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      <option value="" disabled>Seleccionar...</option>
                      {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  )}
                </div>
              </div>
            )}
            {!item.esNuevo && (
              <>
                <input type="hidden" name="itemNuevoSku" value="" />
                <input type="hidden" name="itemNuevoNombre" value="" />
                <input type="hidden" name="itemNuevoMarca" value="" />
                <input type="hidden" name="itemNuevoCategoria" value="" />
                <input type="hidden" name="itemNuevoPresentacion" value="" />
                <input type="hidden" name="itemNuevoUnidadMedida" value="" />
                <input type="hidden" name="itemNuevoContenido" value="" />
                <input type="hidden" name="itemNuevoProveedorId" value="" />
              </>
            )}
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)}
                className="col-span-12 text-right text-xs text-red-400 hover:text-red-600">
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Notas</label>
        <textarea name="notas" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Registrar consignación
      </button>
    </form>
  );
}
