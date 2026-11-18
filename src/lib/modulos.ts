import type { ModuloApp } from "@prisma/client";

// Secciones que se habilitan por usuario (el menú Admin queda fuera: depende del rol ADMIN).
// El orden es el del menú; si no tiene el Dashboard, el inicio es el primero habilitado.
export const MODULOS: { modulo: ModuloApp; href: string; label: string; icon: string }[] = [
  { modulo: "DASHBOARD", href: "/", label: "Dashboard", icon: "🏠" },
  { modulo: "VENTAS", href: "/ventas", label: "Ventas", icon: "🛒" },
  { modulo: "CLIENTES", href: "/clientes", label: "Clientes", icon: "👥" },
  { modulo: "PROVEEDORES", href: "/proveedores", label: "Proveedores", icon: "🏭" },
  { modulo: "INVENTARIO", href: "/inventario", label: "Inventario", icon: "📦" },
  { modulo: "CONSIGNACIONES", href: "/consignaciones", label: "Consignaciones", icon: "🤝" },
  { modulo: "GASTOS", href: "/gastos", label: "Gastos", icon: "💸" },
  { modulo: "REPORTES", href: "/reportes", label: "Reportes", icon: "📊" },
  { modulo: "ESTADISTICAS", href: "/estadisticas", label: "Estadísticas", icon: "📈" },
  { modulo: "TABLERO_CONTROL", href: "/tablero-control", label: "Tablero de Control", icon: "🎛️" },
  { modulo: "LOGISTICA", href: "/logistica", label: "Logística", icon: "🚚" },
  { modulo: "MARKETING", href: "/marketing", label: "Marketing: Campañas de mail", icon: "✉️" },
  { modulo: "REMINDERS", href: "/marketing/reminders", label: "Marketing: Reminders", icon: "⏰" },
  { modulo: "MAYORISTA", href: "/inventario/mayoristas-tipo", label: "Mayorista", icon: "🏪" },
];

export const TODOS_LOS_MODULOS: ModuloApp[] = MODULOS.map((m) => m.modulo);

// Lee los módulos tildados en un formulario (checkboxes name="modulos").
export function modulosDelFormulario(formData: FormData): ModuloApp[] {
  const elegidos = new Set(formData.getAll("modulos").map(String));
  return TODOS_LOS_MODULOS.filter((m) => elegidos.has(m));
}

// Secciones habilitadas, en el orden del menú (para el listado de usuarios).
export function textoModulos(modulos: ModuloApp[]) {
  if (TODOS_LOS_MODULOS.every((m) => modulos.includes(m))) return "Todas";
  const nombres = MODULOS.filter((m) => modulos.includes(m.modulo)).map((m) => m.label);
  return nombres.length ? nombres.join(", ") : "Ninguna sección";
}
