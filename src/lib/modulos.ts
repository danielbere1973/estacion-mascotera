import type { ModuloApp } from "@prisma/client";

// Grupos del menú que se despliegan (Marketing y Mayorista): sus submódulos
// se habilitan uno por uno y en Usuarios se muestran como una rama.
export const GRUPOS = {
  MARKETING: { label: "Marketing", icon: "📣" },
  MAYORISTA: { label: "Mayorista", icon: "🏪" },
} as const;
export type GrupoModulo = keyof typeof GRUPOS;

type Modulo = { modulo: ModuloApp; href: string; label: string; icon: string; grupo?: GrupoModulo };

// Secciones que se habilitan por usuario (el menú Admin queda fuera: depende del rol ADMIN).
// El orden es el del menú; si no tiene el Dashboard, el inicio es el primero habilitado.
export const MODULOS: Modulo[] = [
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
  { modulo: "MARKETING", href: "/marketing", label: "Campañas de mail", icon: "✉️", grupo: "MARKETING" },
  { modulo: "REMINDERS", href: "/marketing/reminders", label: "Reminders", icon: "⏰", grupo: "MARKETING" },
  { modulo: "MAYORISTA_TIPO", href: "/inventario/mayoristas-tipo", label: "Tipo mayorista", icon: "🏷️", grupo: "MAYORISTA" },
  { modulo: "MAYORISTA_MARGENES", href: "/inventario/mayoristas-margenes", label: "Márgenes mayoristas", icon: "➗", grupo: "MAYORISTA" },
  { modulo: "MAYORISTA_CATALOGO", href: "/inventario/mayoristas-catalogo", label: "Catálogo mayorista", icon: "📖", grupo: "MAYORISTA" },
];

export const TODOS_LOS_MODULOS: ModuloApp[] = MODULOS.map((m) => m.modulo);

// `MAYORISTA` es el valor viejo de cuando Mayorista era una sola casilla:
// equivale a sus tres submódulos (y desaparece al volver a guardar el usuario).
export function normalizarModulos(modulos: ModuloApp[]): ModuloApp[] {
  const set = new Set(modulos);
  if (set.has("MAYORISTA")) {
    for (const m of MODULOS) if (m.grupo === "MAYORISTA") set.add(m.modulo);
  }
  return TODOS_LOS_MODULOS.filter((m) => set.has(m));
}

// Lee los módulos tildados en un formulario (checkboxes name="modulos").
export function modulosDelFormulario(formData: FormData): ModuloApp[] {
  const elegidos = new Set(formData.getAll("modulos").map(String));
  return TODOS_LOS_MODULOS.filter((m) => elegidos.has(m));
}

// Secciones habilitadas, en el orden del menú (para el listado de usuarios).
export function textoModulos(modulos: ModuloApp[]) {
  const permitidos = normalizarModulos(modulos);
  if (permitidos.length === TODOS_LOS_MODULOS.length) return "Todas";
  const nombres = MODULOS.filter((m) => permitidos.includes(m.modulo)).map((m) =>
    m.grupo ? `${GRUPOS[m.grupo].label}: ${m.label}` : m.label
  );
  return nombres.length ? nombres.join(", ") : "Ninguna sección";
}
