import type { EstadoTablero } from "@prisma/client";

export const COLUMNAS: { estado: EstadoTablero; label: string }[] = [
  { estado: "INGRESO_ORDEN_PENDIENTE", label: "Ingreso de Orden - Pendiente" },
  { estado: "CARGAR_ORDEN_VENTA_EM_1", label: "Cargar Orden de Venta en App EM" },
  { estado: "COMPRAR_MAYORISTA", label: "Comprar en Mayorista" },
  { estado: "LISTA_PARA_DESPACHO", label: "Lista para despacho" },
  { estado: "DESPACHADA_EN_CAMINO", label: "Despachada - En Camino" },
  { estado: "PEDIDO_ENTREGADO", label: "Pedido Entregado" },
  { estado: "CARGAR_ORDEN_VENTA_EM_2", label: "Cargar Orden de Venta en App EM" },
  { estado: "FACTURACION", label: "Facturación" },
  { estado: "ORDEN_CERRADA_ARCHIVADA", label: "Orden Cerrada - Archivada" },
];
