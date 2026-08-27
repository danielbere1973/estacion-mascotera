import * as XLSX from "xlsx";
import { parsearCSV, corregirEncoding } from "@/lib/csv";

type VarianteTN = {
  id: number;
  product_id: number;
  sku: string | null;
  price: string | null;
  promotional_price: string | null;
  stock: number | null;
};
type ProductoTN = { id: number; name: { es?: string }; variants: VarianteTN[] };

type FilaHym = { Contactenacion: string; SKUInterno: string };

// Exclusiones confirmadas manualmente tras revisar contra sistema_em:
// - 6523-0.850: el SKU está mal asignado en Tiendanube a un producto distinto,
//   no al pouch húmedo real de HYM (que no existe en TN).
const EXCLUIR_SKU_CSV = new Set(["6523-0.850"]);

export type FilaCambioHym = {
  skuHym: string;
  nombreHym: string;
  skuInterno: string;
  tnProductId: number;
  tnVariantId: number;
  nombreTN: string;
  estadoStockHym: string;
  precioHymLista: number | null;
  tnPrecioActual: number | null;
  tnPromocionalActual: number | null;
  tnStockActual: number | null;
  nuevoPrecio: number | null;
  nuevoPromocional: number | null | undefined; // undefined = sin cambio, null = vaciar
  nuevoStock: number | undefined; // undefined = sin cambio
  accion: string;
  esVaciarPorSinStock: boolean;
  sinCambioReal: boolean;
  cambiaPrecio: boolean;
  cambiaPromo: boolean;
  cambiaStock: boolean;
};

export type FilaSinResolver = {
  skuHym: string;
  nombreHym: string;
  skuInterno: string | null;
  motivo: string;
};

export type ResultadoCalculoHym = {
  cambios: FilaCambioHym[];
  excluidos: FilaCambioHym[];
  sinResolver: FilaSinResolver[];
  resumen: {
    totalFilasCsv: number;
    soloPrecios: number;
    precioYPromo: number;
    sinStock: number;
    pocoStock: number;
    stockDisponible: number;
    sinSkuInterno: number;
    sinVarianteTN: number;
    sinCambioReal: number;
  };
};

async function traerProductosTiendanube(storeId: string, accessToken: string): Promise<ProductoTN[]> {
  const productos: ProductoTN[] = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const res = await fetch(
      `https://api.tiendanube.com/v1/${storeId}/products?page=${page}&per_page=${perPage}`,
      { headers: { Authentication: `bearer ${accessToken}`, "User-Agent": "Sistema-EM-Sync (danielbere@gmail.com)" } },
    );
    if (!res.ok) throw new Error(`Error Tiendanube page ${page}: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as ProductoTN[];
    if (data.length === 0) break;
    productos.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return productos;
}

function parsearPrecioArs(texto: string): number | null {
  const limpio = (texto ?? "").replace(/\$/g, "").replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(limpio);
  return Number.isNaN(n) ? null : n;
}

function redondearArriba(n: number): number {
  return Math.ceil(n);
}

export async function calcularCambiosHym(
  storeId: string,
  accessToken: string,
  csvBuffer: Buffer,
  hymXlsxBuffer: Buffer,
): Promise<ResultadoCalculoHym> {
  const productosTN = await traerProductosTiendanube(storeId, accessToken);

  const indiceSku = new Map<string, { producto: ProductoTN; variante: VarianteTN }>();
  for (const p of productosTN) {
    for (const v of p.variants) {
      const sku = v.sku?.trim().toUpperCase() ?? "";
      if (sku) indiceSku.set(sku, { producto: p, variante: v });
    }
  }

  const textoCsv = corregirEncoding(csvBuffer.toString("utf-8"));
  const filasCsv = parsearCSV(textoCsv);
  if (filasCsv.length === 0) {
    throw new Error("El CSV de HYM está vacío o no se pudo leer. Verificá que sea el archivo productos.csv correcto.");
  }

  const wbHym = XLSX.read(hymXlsxBuffer, { type: "buffer" });
  const sheetHym = wbHym.Sheets["productos_con_variantes"];
  if (!sheetHym) {
    throw new Error(
      "El Excel de mapeo no tiene la hoja \"productos_con_variantes\". Verificá que sea el archivo Productos-Cambios_HyM.xlsx correcto.",
    );
  }
  const filasHym = XLSX.utils.sheet_to_json<FilaHym>(sheetHym);

  const indiceContactenacion = new Map<string, string>();
  for (const f of filasHym) {
    const key = String(f.Contactenacion ?? "").toLowerCase().trim();
    const skuInterno = String(f.SKUInterno ?? "").trim();
    if (key && skuInterno) indiceContactenacion.set(key, skuInterno);
  }

  const cambios: FilaCambioHym[] = [];
  const excluidos: FilaCambioHym[] = [];
  const sinResolver: FilaSinResolver[] = [];

  let soloPrecios = 0;
  let precioYPromo = 0;
  let sinStock = 0;
  let pocoStock = 0;
  let stockDisponible = 0;
  let sinSkuInterno = 0;
  let sinVarianteTN = 0;
  let sinCambioReal = 0;

  for (const fila of filasCsv) {
    const skuCsv = String(fila.SKU ?? "").toLowerCase().trim();
    if (!skuCsv) continue;

    const skuInterno = indiceContactenacion.get(skuCsv);
    if (!skuInterno) {
      sinSkuInterno++;
      sinResolver.push({
        skuHym: fila.SKU,
        nombreHym: fila.Nombre,
        skuInterno: null,
        motivo: "SIN SKU INTERNO - no está en el Excel de mapeo HYM",
      });
      continue;
    }

    const match = indiceSku.get(skuInterno.toUpperCase());
    if (!match) {
      sinVarianteTN++;
      sinResolver.push({
        skuHym: fila.SKU,
        nombreHym: fila.Nombre,
        skuInterno,
        motivo: "SIN VARIANTE EN TIENDANUBE - no es de este proveedor o falta cargar SKU",
      });
      continue;
    }

    const { producto, variante } = match;
    const estadoStock = String(fila["Estado de stock"] ?? "").trim();
    const precioHym = parsearPrecioArs(String(fila["Precio Lista"] ?? ""));

    const precioActualTN = variante.price ? parseFloat(variante.price) : null;
    const promoActualTN = variante.promotional_price ? parseFloat(variante.promotional_price) : null;
    const teniaPromo = promoActualTN !== null && !Number.isNaN(promoActualTN);

    let nuevoPrice: number | null = null;
    let nuevoPromo: number | null | undefined = undefined;
    let nuevoStock: number | undefined = undefined;
    let accion = "";
    let esVaciarPorSinStock = false;

    let esCasoInvalido = false;

    if (estadoStock === "Sin Stock") {
      nuevoPrice = null;
      nuevoPromo = null;
      esVaciarPorSinStock = true;
      sinStock++;
    } else if (precioHym === null) {
      accion = "SIN PRECIO VÁLIDO EN CSV - revisar";
      esCasoInvalido = true;
    } else {
      if (teniaPromo) {
        nuevoPrice = redondearArriba(precioHym * 1.4444);
        nuevoPromo = redondearArriba(precioHym * 1.3);
        precioYPromo++;
      } else {
        nuevoPrice = redondearArriba(precioHym * 1.3);
        soloPrecios++;
      }

      if (estadoStock === "Poco Stock") {
        nuevoStock = 5;
        pocoStock++;
      } else if (estadoStock === "Stock disponible") {
        nuevoStock = 10;
        stockDisponible++;
      }
    }

    const cambiaPrecio = esVaciarPorSinStock
      ? precioActualTN !== null
      : nuevoPrice !== null && nuevoPrice !== precioActualTN;
    const cambiaPromo = esVaciarPorSinStock
      ? promoActualTN !== null
      : nuevoPromo !== undefined && nuevoPromo !== promoActualTN;
    const cambiaStock = nuevoStock !== undefined && nuevoStock !== variante.stock;

    if (!esCasoInvalido) {
      if (esVaciarPorSinStock) {
        accion = cambiaPrecio || cambiaPromo ? "Vaciar precios (Sin Stock)" : "";
      } else {
        const partes: string[] = [];
        if (cambiaPrecio) partes.push(`Precio → $${nuevoPrice}`);
        if (cambiaPromo) partes.push(`Promo → ${nuevoPromo === null ? "vaciar" : `$${nuevoPromo}`}`);
        if (cambiaStock) partes.push(`Stock → ${nuevoStock}`);
        accion = partes.join(" | ");
      }
    }

    const sinCambio = !esCasoInvalido && !cambiaPrecio && !cambiaPromo && !cambiaStock;
    if (sinCambio) sinCambioReal++;
    if (sinCambio) accion = "Sin cambio real";

    const filaCambio: FilaCambioHym = {
      skuHym: fila.SKU,
      nombreHym: fila.Nombre,
      skuInterno,
      tnProductId: producto.id,
      tnVariantId: variante.id,
      nombreTN: producto.name.es ?? "",
      estadoStockHym: estadoStock,
      precioHymLista: precioHym,
      tnPrecioActual: precioActualTN,
      tnPromocionalActual: promoActualTN,
      tnStockActual: variante.stock,
      nuevoPrecio: nuevoPrice,
      nuevoPromocional: nuevoPromo,
      nuevoStock,
      accion,
      esVaciarPorSinStock,
      sinCambioReal: sinCambio,
      cambiaPrecio,
      cambiaPromo,
      cambiaStock,
    };

    if (EXCLUIR_SKU_CSV.has(fila.SKU)) {
      excluidos.push(filaCambio);
    } else {
      cambios.push(filaCambio);
    }
  }

  return {
    cambios,
    excluidos,
    sinResolver,
    resumen: {
      totalFilasCsv: filasCsv.length,
      soloPrecios,
      precioYPromo,
      sinStock,
      pocoStock,
      stockDisponible,
      sinSkuInterno,
      sinVarianteTN,
      sinCambioReal,
    },
  };
}

export async function aplicarCambioHym(
  storeId: string,
  accessToken: string,
  fila: FilaCambioHym,
): Promise<{ ok: true } | { ok: false; status: number; detalle: string }> {
  const body: Record<string, unknown> = {};

  // Tiendanube ignora silenciosamente price/promotional_price: null (responde 200
  // sin cambiar nada) — hay que mandar string vacío para vaciarlos de verdad.
  if (fila.esVaciarPorSinStock) {
    body.price = "";
    body.promotional_price = "";
  } else {
    if (typeof fila.nuevoPrecio === "number") {
      body.price = String(fila.nuevoPrecio);
    }
    if (fila.nuevoPromocional !== undefined) {
      body.promotional_price = fila.nuevoPromocional === null ? "" : String(fila.nuevoPromocional);
    }
  }

  if (fila.nuevoStock !== undefined) {
    body.stock = fila.nuevoStock;
  }

  if (Object.keys(body).length === 0) return { ok: true };

  const res = await fetch(
    `https://api.tiendanube.com/v1/${storeId}/products/${fila.tnProductId}/variants/${fila.tnVariantId}`,
    {
      method: "PUT",
      headers: {
        Authentication: `bearer ${accessToken}`,
        "User-Agent": "Sistema-EM-Sync (danielbere@gmail.com)",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (res.ok) return { ok: true };
  const detalle = await res.text();
  return { ok: false, status: res.status, detalle };
}
