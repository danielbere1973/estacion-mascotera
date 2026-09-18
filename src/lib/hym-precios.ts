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

type FilaHym = { Codigo: string; SKUInterno: string };

const COL_COSTO_HYM = 8; // columna I
const COL_ESTADO_STOCK = 5; // columna F
const COL_PRECIO_PROMO = 10; // columna K
const COL_PRECIO_LISTA = 11; // columna L
const COL_SIN_VARIANTE_TN = 12; // columna M

// Códigos HYM como "06403" y "6403" son el mismo producto — HYM a veces manda
// el CSV con cero a la izquierda y el Excel de mapeo lo tiene cargado sin él
// (o viceversa). Sin esto, el match por string exacto los trata como distintos
// y el producto queda mal marcado como "sin SKU interno".
function normalizarCodigoHym(codigo: string): string {
  return codigo.replace(/^0+(?=\d)/, "");
}

// Exclusiones confirmadas manualmente tras revisar contra sistema_em:
// - 6523-0.850: el SKU está mal asignado en Tiendanube a un producto distinto,
//   no al pouch húmedo real de HYM (que no existe en TN).
const EXCLUIR_SKU_CSV = new Set(["06523"]);

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

  const indiceCodigoHym = new Map<string, string>();
  for (const f of filasHym) {
    const key = normalizarCodigoHym(String(f.Codigo ?? "").toLowerCase().trim());
    const skuInterno = String(f.SKUInterno ?? "").trim();
    if (key && skuInterno) indiceCodigoHym.set(key, skuInterno);
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
    const skuCsv = normalizarCodigoHym(String(fila.SKU ?? "").toLowerCase().trim());
    if (!skuCsv) continue;

    const skuInterno = indiceCodigoHym.get(skuCsv);
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

function armarBodyCambioHym(fila: FilaCambioHym): Record<string, unknown> {
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

  return body;
}

async function ejecutarPutVariante(
  storeId: string,
  accessToken: string,
  productId: number,
  variantId: number,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; detalle: string }> {
  const res = await fetch(
    `https://api.tiendanube.com/v1/${storeId}/products/${productId}/variants/${variantId}`,
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

function numeroOVacio(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// Compara lo que se pidió mandar contra el estado real que devuelve Tiendanube
// después del PUT. Tiendanube a veces responde 200 sin haber aplicado el
// cambio (glitch observado en producción), así que no alcanza con el status.
function coincideConLoPedido(body: Record<string, unknown>, variante: VarianteTN): boolean {
  if ("price" in body) {
    const esperado = body.price === "" ? null : parseFloat(String(body.price));
    if (numeroOVacio(variante.price) !== esperado) return false;
  }
  if ("promotional_price" in body) {
    const esperado = body.promotional_price === "" ? null : parseFloat(String(body.promotional_price));
    if (numeroOVacio(variante.promotional_price) !== esperado) return false;
  }
  if ("stock" in body) {
    if (variante.stock !== body.stock) return false;
  }
  return true;
}

async function traerVariante(
  storeId: string,
  accessToken: string,
  productId: number,
  variantId: number,
): Promise<VarianteTN | null> {
  const res = await fetch(
    `https://api.tiendanube.com/v1/${storeId}/products/${productId}/variants/${variantId}`,
    { headers: { Authentication: `bearer ${accessToken}`, "User-Agent": "Sistema-EM-Sync (danielbere@gmail.com)" } },
  );
  if (!res.ok) return null;
  return (await res.json()) as VarianteTN;
}

export async function aplicarCambioHym(
  storeId: string,
  accessToken: string,
  fila: FilaCambioHym,
): Promise<{ ok: true } | { ok: false; status: number; detalle: string }> {
  const body = armarBodyCambioHym(fila);
  if (Object.keys(body).length === 0) return { ok: true };

  for (let intento = 1; intento <= 2; intento++) {
    const resultado = await ejecutarPutVariante(storeId, accessToken, fila.tnProductId, fila.tnVariantId, body);
    if (!resultado.ok) {
      if (intento === 2) return resultado;
      continue;
    }

    const varianteReal = await traerVariante(storeId, accessToken, fila.tnProductId, fila.tnVariantId);
    if (varianteReal && coincideConLoPedido(body, varianteReal)) {
      return { ok: true };
    }

    if (intento === 2) {
      return {
        ok: false,
        status: 0,
        detalle: "Tiendanube respondió OK pero el valor no quedó aplicado al releer la variante (reintentado 1 vez)",
      };
    }
  }

  return { ok: false, status: 0, detalle: "No se pudo verificar el cambio" };
}

const COL_NOMBRE = 0; // columna A
const COL_CODIGO = 1; // columna B
const COL_TAMANIO = 2; // columna C
const COL_SKU_INTERNO = 16; // columna Q

// Mapeo confirmado en la base (HistorialStockMayorista.codigoHym → producto vinculado)
// para completar filas del Excel que todavía no las tiene cargadas a mano.
export type MapeoCodigoHym = {
  codigoHym: string; // ya en minúscula/trim, como se usa de clave en el resto del archivo
  skuInterno: string;
  nombre: string | null;
  tamanios: string | null;
};

// Actualiza en el propio Excel de mapeo HYM (hoja "productos_con_variantes"):
// - columna I: costo HYM tomado de productos.csv (Precio Lista)
// - columna K: precio promocional vigente en Tiendanube (o el de lista si no hay promo)
// - columna L: precio de lista vigente en Tiendanube
// Solo toca filas cuyo Código matchea el CSV Y cuyo SKUInterno tiene variante real
// en Tiendanube; el resto queda intacto (son productos de HYM que no están en la tienda).
//
// Además, para códigos del CSV que no tienen fila en el Excel pero SÍ tienen un
// mapeo confirmado en la base (mapeoDb, vía HistorialStockMayorista.codigoHym),
// agrega una fila nueva con Nombre/Codigo/Tamaño/SKUInterno. El resto de las
// columnas de control (revisión manual, etc.) queda vacío, igual que si Daniel
// la hubiera tipeado a mano sin revisar todavía — no se pisa ni se marca nada.
export async function generarExcelActualizadoHym(
  storeId: string,
  accessToken: string,
  csvBuffer: Buffer,
  hymXlsxBuffer: Buffer,
  mapeoDb: MapeoCodigoHym[] = [],
): Promise<Buffer> {
  const productosTN = await traerProductosTiendanube(storeId, accessToken);

  const indiceSku = new Map<string, VarianteTN>();
  for (const p of productosTN) {
    for (const v of p.variants) {
      const sku = v.sku?.trim().toUpperCase() ?? "";
      if (sku) indiceSku.set(sku, v);
    }
  }

  const textoCsv = corregirEncoding(csvBuffer.toString("utf-8"));
  const filasCsv = parsearCSV(textoCsv);
  const costoPorSkuCsv = new Map<string, number>();
  const estadoStockPorSkuCsv = new Map<string, string>();
  for (const fila of filasCsv) {
    const skuCsv = normalizarCodigoHym(String(fila.SKU ?? "").toLowerCase().trim());
    if (!skuCsv) continue;
    const costo = parsearPrecioArs(String(fila["Precio Lista"] ?? ""));
    if (costo !== null) costoPorSkuCsv.set(skuCsv, costo);
    const estadoStock = String(fila["Estado de stock"] ?? "").trim();
    if (estadoStock) estadoStockPorSkuCsv.set(skuCsv, estadoStock);
  }

  const wbHym = XLSX.read(hymXlsxBuffer, { type: "buffer" });
  const sheetHym = wbHym.Sheets["productos_con_variantes"];
  if (!sheetHym) {
    throw new Error(
      "El Excel de mapeo no tiene la hoja \"productos_con_variantes\". Verificá que sea el archivo Productos-Cambios_HyM.xlsx correcto.",
    );
  }
  const filasHym = XLSX.utils.sheet_to_json<FilaHym>(sheetHym);

  const rango = XLSX.utils.decode_range(sheetHym["!ref"] ?? "A1");
  rango.e.c = Math.max(rango.e.c, COL_PRECIO_LISTA);

  for (let i = 0; i < filasHym.length; i++) {
    const filaExcel = rango.s.r + 1 + i; // fila 0 es el header
    const codigo = normalizarCodigoHym(String(filasHym[i].Codigo ?? "").toLowerCase().trim());
    const skuInterno = String(filasHym[i].SKUInterno ?? "").trim();
    if (!codigo || !skuInterno) continue;

    const costo = costoPorSkuCsv.get(codigo);
    if (costo === undefined) continue;

    const variante = indiceSku.get(skuInterno.toUpperCase());
    if (!variante) continue;

    const precioLista = variante.price ? parseFloat(variante.price) : null;
    const precioPromo = variante.promotional_price ? parseFloat(variante.promotional_price) : null;

    sheetHym[XLSX.utils.encode_cell({ r: filaExcel, c: COL_COSTO_HYM })] = { t: "n", v: costo };

    if (precioLista === null || Number.isNaN(precioLista)) {
      delete sheetHym[XLSX.utils.encode_cell({ r: filaExcel, c: COL_PRECIO_PROMO })];
      delete sheetHym[XLSX.utils.encode_cell({ r: filaExcel, c: COL_PRECIO_LISTA })];
      continue;
    }

    const precioAMostrarComoPromo =
      precioPromo !== null && !Number.isNaN(precioPromo) ? precioPromo : precioLista;

    sheetHym[XLSX.utils.encode_cell({ r: filaExcel, c: COL_PRECIO_PROMO })] = {
      t: "n",
      v: precioAMostrarComoPromo,
    };
    sheetHym[XLSX.utils.encode_cell({ r: filaExcel, c: COL_PRECIO_LISTA })] = { t: "n", v: precioLista };
  }

  const codigosEnExcel = new Set(
    filasHym.map((f) => normalizarCodigoHym(String(f.Codigo ?? "").toLowerCase().trim())).filter(Boolean),
  );
  const mapeoPorCodigo = new Map(mapeoDb.map((m) => [normalizarCodigoHym(m.codigoHym), m]));

  let siguienteFilaExcel = rango.s.r + 1 + filasHym.length;
  for (const fila of filasCsv) {
    const skuCsv = normalizarCodigoHym(String(fila.SKU ?? "").toLowerCase().trim());
    if (!skuCsv || codigosEnExcel.has(skuCsv)) continue;

    const mapeo = mapeoPorCodigo.get(skuCsv);
    if (!mapeo) continue;

    sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_NOMBRE })] = {
      t: "s",
      v: mapeo.nombre ?? fila.Nombre ?? "",
    };
    sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_CODIGO })] = { t: "s", v: skuCsv };
    if (mapeo.tamanios) {
      sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_TAMANIO })] = { t: "s", v: mapeo.tamanios };
    }
    sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_SKU_INTERNO })] = {
      t: "s",
      v: mapeo.skuInterno,
    };

    const costo = costoPorSkuCsv.get(skuCsv);
    if (costo !== undefined) {
      sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_COSTO_HYM })] = { t: "n", v: costo };
    }

    const estadoStock = estadoStockPorSkuCsv.get(skuCsv);
    if (estadoStock) {
      sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_ESTADO_STOCK })] = { t: "s", v: estadoStock };
    }

    const tieneVarianteTN = indiceSku.has(mapeo.skuInterno.toUpperCase());
    if (!tieneVarianteTN) {
      sheetHym[XLSX.utils.encode_cell({ r: siguienteFilaExcel, c: COL_SIN_VARIANTE_TN })] = { t: "s", v: "NO" };
    }

    codigosEnExcel.add(skuCsv);
    siguienteFilaExcel++;
  }
  rango.e.r = Math.max(rango.e.r, siguienteFilaExcel - 1);

  sheetHym["!ref"] = XLSX.utils.encode_range(rango);

  return XLSX.write(wbHym, { type: "buffer", bookType: "xlsx" });
}
