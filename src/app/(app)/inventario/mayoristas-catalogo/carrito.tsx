"use client";

import Image from "next/image";
import { createContext, useContext, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import type { CanalVenta } from "@prisma/client";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { formatCurrency } from "@/lib/format";
import { confirmarCarritoMayorista } from "./actions";

// Carrito del Catálogo mayorista. Se guarda en este navegador (localStorage) hasta confirmarlo.

export type ProductoCarrito = {
  productoId: number;
  nombre: string;
  marca: string;
  foto: string | null;
  precio: number; // precio mayorista al momento de agregarlo (al confirmar se recalcula en el servidor)
};

type ItemCarrito = ProductoCarrito & { cantidad: number };

type ContextoCarrito = {
  items: ItemCarrito[];
  agregar: (producto: ProductoCarrito, cantidad: number) => void;
  cambiarCantidad: (productoId: number, cantidad: number) => void;
  quitar: (productoId: number) => void;
  vaciar: () => void;
};

const CLAVE_STORAGE = "carrito-mayorista";
const Carrito = createContext<ContextoCarrito | null>(null);

function useCarrito() {
  const ctx = useContext(Carrito);
  if (!ctx) throw new Error("useCarrito fuera de CarritoProvider");
  return ctx;
}

// Store del carrito: vive en memoria y se copia a localStorage. Si el navegador no permite
// guardar, el carrito funciona igual (solo se pierde al recargar).
const SIN_ITEMS: ItemCarrito[] = [];
let itemsActuales: ItemCarrito[] | null = null;
const suscriptores = new Set<() => void>();

function leerItems(): ItemCarrito[] {
  if (itemsActuales) return itemsActuales;
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_STORAGE) ?? "[]");
    itemsActuales = Array.isArray(guardado) ? guardado.filter((i) => i && i.productoId && i.cantidad > 0) : [];
  } catch {
    itemsActuales = [];
  }
  return itemsActuales!;
}

function setItems(actualizar: (prev: ItemCarrito[]) => ItemCarrito[]) {
  itemsActuales = actualizar(leerItems());
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(itemsActuales));
  } catch {}
  suscriptores.forEach((fn) => fn());
}

function suscribir(fn: () => void) {
  suscriptores.add(fn);
  // Otra pestaña con el catálogo abierto modificó el carrito.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CLAVE_STORAGE) return;
    itemsActuales = null;
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    suscriptores.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(suscribir, leerItems, () => SIN_ITEMS);

  const valor = useMemo<ContextoCarrito>(
    () => ({
      items,
      agregar: (producto, cantidad) =>
        setItems((prev) => {
          const existente = prev.find((i) => i.productoId === producto.productoId);
          if (existente) {
            return prev.map((i) =>
              i.productoId === producto.productoId ? { ...i, ...producto, cantidad: i.cantidad + cantidad } : i
            );
          }
          return [...prev, { ...producto, cantidad }];
        }),
      cambiarCantidad: (productoId, cantidad) =>
        setItems((prev) => prev.map((i) => (i.productoId === productoId ? { ...i, cantidad } : i))),
      quitar: (productoId) => setItems((prev) => prev.filter((i) => i.productoId !== productoId)),
      vaciar: () => setItems(() => []),
    }),
    [items]
  );

  return <Carrito.Provider value={valor}>{children}</Carrito.Provider>;
}

// Cantidad + "Agregar al carrito" en cada tarjeta del catálogo.
export function AgregarAlCarrito({ producto }: { producto: ProductoCarrito }) {
  const { agregar } = useCarrito();
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        value={cantidad}
        onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
        aria-label="Cantidad"
        className="w-14 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => {
          agregar(producto, cantidad);
          setCantidad(1);
          setAgregado(true);
          setTimeout(() => setAgregado(false), 1500);
        }}
        className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold text-white ${
          agregado ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {agregado ? "✓ Agregado" : "Agregar"}
      </button>
    </div>
  );
}

type Opciones = {
  clientes: ComboboxOption[];
  mediosPago: string[];
};

const CANALES: { valor: CanalVenta; label: string }[] = [
  { valor: "WHATSAPP", label: "WhatsApp" },
  { valor: "TELEFONO", label: "Teléfono" },
  { valor: "TIENDANUBE", label: "Tiendanube" },
];

// Ícono del carrito (arriba a la derecha) y la ventana con el detalle.
export function BotonCarrito({ clientes, mediosPago }: Opciones) {
  const { items } = useCarrito();
  const [abierto, setAbierto] = useState(false);
  const unidades = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="relative rounded-full border border-gray-200 bg-white p-2.5 text-2xl leading-none shadow-sm hover:bg-gray-50"
        aria-label={`Carrito: ${unidades} unidades`}
        title="Ver carrito"
      >
        🛒
        {unidades > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unidades}
          </span>
        )}
      </button>
      {abierto && <VentanaCarrito onCerrar={() => setAbierto(false)} clientes={clientes} mediosPago={mediosPago} />}
    </>
  );
}

function VentanaCarrito({ onCerrar, clientes, mediosPago }: Opciones & { onCerrar: () => void }) {
  const { items, cambiarCantidad, quitar, vaciar } = useCarrito();
  const [paso, setPaso] = useState<"lista" | "confirmar">("lista");
  const [clienteId, setClienteId] = useState("");
  const [medioPago, setMedioPago] = useState(mediosPago[0] ?? "");
  const [canalVenta, setCanalVenta] = useState<CanalVenta>("WHATSAPP");
  const [error, setError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<{ ventaId: number; total: number } | null>(null);
  const [enviando, startTransition] = useTransition();

  const total = items.reduce((acc, i) => acc + i.cantidad * i.precio, 0);

  function confirmar() {
    setError(null);
    if (!clienteId) return setError("Elegí un cliente.");
    if (!medioPago) return setError("Elegí un medio de pago.");
    startTransition(async () => {
      const r = await confirmarCarritoMayorista({
        clienteId: Number(clienteId),
        medioPago,
        canalVenta,
        items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      });
      if (r.ok) {
        vaciar();
        setConfirmado({ ventaId: r.ventaId, total: r.total });
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !enviando && onCerrar()}>
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmado ? (
          <div className="space-y-3 p-6 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-semibold text-gray-900">¡Pedido confirmado!</h2>
            <p className="text-sm text-gray-600">Tu número de pedido es</p>
            <p className="text-4xl font-bold text-sky-700">#{confirmado.ventaId}</p>
            <p className="text-sm text-gray-500">Total: {formatCurrency(confirmado.total)}</p>
            <button
              type="button"
              onClick={onCerrar}
              className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {paso === "lista" ? "Carrito" : "Confirmar carrito"}
              </h2>
              <button type="button" onClick={onCerrar} className="rounded px-2 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-3">
              {paso === "lista" && items.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">El carrito está vacío.</p>
              )}

              {paso === "lista" &&
                items.map((i) => (
                  <div key={i.productoId} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                      {i.foto && <Image src={i.foto} alt={i.nombre} fill className="object-cover" unoptimized />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-400">{i.marca}</p>
                      <p className="text-sm font-medium leading-snug text-gray-900">{i.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(i.precio)} c/u · <span className="font-semibold text-gray-700">{formatCurrency(i.precio * i.cantidad)}</span>
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={i.cantidad}
                      onChange={(e) => cambiarCantidad(i.productoId, Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                      aria-label={`Cantidad de ${i.nombre}`}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => quitar(i.productoId)}
                      className="rounded p-1.5 text-lg leading-none text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Quitar del carrito"
                      aria-label={`Quitar ${i.nombre}`}
                    >
                      🗑️
                    </button>
                  </div>
                ))}

              {paso === "confirmar" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Cliente</label>
                    <Combobox options={clientes} value={clienteId} onSelect={setClienteId} placeholder="Buscar cliente..." required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Medio de pago</label>
                      <select
                        value={medioPago}
                        onChange={(e) => setMedioPago(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        {mediosPago.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Canal</label>
                      <select
                        value={canalVenta}
                        onChange={(e) => setCanalVenta(e.target.value as CanalVenta)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        {CANALES.map((c) => (
                          <option key={c.valor} value={c.valor}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {items.length} producto{items.length !== 1 ? "s" : ""} · {items.reduce((a, i) => a + i.cantidad, 0)} unidades
                  </p>
                </div>
              )}

              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>

            <div className="space-y-2 border-t border-gray-100 px-5 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="text-lg font-semibold text-gray-900">{formatCurrency(total)}</span>
              </div>
              {paso === "lista" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onCerrar}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Agregar productos al carrito
                  </button>
                  <button
                    type="button"
                    disabled={items.length === 0}
                    onClick={() => {
                      setError(null);
                      setPaso("confirmar");
                    }}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Confirmar carrito
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => {
                      setError(null);
                      setPaso("lista");
                    }}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ← Volver al carrito
                  </button>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={confirmar}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {enviando ? "Confirmando..." : "Confirmar pedido"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
