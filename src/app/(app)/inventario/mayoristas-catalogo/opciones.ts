// Opciones del paso "Confirmar carrito" del Catálogo mayorista (las usan la pantalla y el servidor).

// Mismos nombres que en Admin > Medios de pago.
export const MEDIOS_PAGO_MAYORISTA = ["Efectivo", "Transferencia", "Link de Pago"] as const;

export const COMO_NOS_CONOCISTE = [
  "Redes sociales",
  "Publicidad gráfica",
  "Referido/Conocido",
  "Internet",
  "Agentes IA",
  "Otros",
] as const;

// Total mínimo de un pedido del catálogo mayorista (lo avisa la pantalla y lo valida el servidor).
export const COMPRA_MINIMA_MAYORISTA = 150000;
// Como se muestra en los avisos: "$150.000".
export const COMPRA_MINIMA_TEXTO = "$" + COMPRA_MINIMA_MAYORISTA.toLocaleString("es-AR");
