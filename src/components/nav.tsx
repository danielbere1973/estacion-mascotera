"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

const links = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/ventas", label: "Ventas", icon: "🛒" },
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/inventario", label: "Inventario", icon: "📦" },
  { href: "/consignaciones", label: "Consignaciones", icon: "🤝" },
  { href: "/gastos", label: "Gastos", icon: "💸" },
  { href: "/reportes", label: "Reportes", icon: "📊" },
  { href: "/tablero-control", label: "Tablero de Control", icon: "🎛️" },
  { href: "/marketing", label: "Marketing", icon: "📣" },
];

const linksRestringido = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/ventas", label: "Ventas", icon: "🛒" },
  { href: "/inventario/compras", label: "Compras", icon: "📦" },
  { href: "/consignaciones", label: "Consignaciones", icon: "🤝" },
];

const adminLinks = [
  { href: "/usuarios", label: "Usuarios", icon: "👤" },
  { href: "/actividad", label: "Actividad", icon: "📋" },
  { href: "/admin/medios-pago", label: "Medios de pago", icon: "💳" },
  { href: "/inventario/tipos", label: "Categorías", icon: "🏷️" },
  { href: "/mayoristas-hym", label: "Precios HYM", icon: "💲" },
];

function NavLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar({
  isAdmin,
  isRestringido,
  onNavigate,
}: {
  isAdmin: boolean;
  isRestringido: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(
    adminLinks.some((l) => pathname.startsWith(l.href))
  );
  const visibleLinks = isRestringido ? linksRestringido : links;

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo / nombre */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
        <Image
          src="/logo.png"
          alt="Estación Mascotera"
          width={36}
          height={36}
          className="rounded-full shrink-0"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide leading-none">CRM</p>
          <p className="truncate text-sm font-bold text-gray-900 leading-tight mt-0.5">Estación Mascotera</p>
        </div>
      </div>

      {/* Links principales */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleLinks.map((link) => (
          <NavLink key={link.href} {...link} onNavigate={onNavigate} />
        ))}

        {isAdmin && (
          <div className="pt-3">
            <button
              onClick={() => setAdminOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
            >
              Admin
              <svg
                className={`h-3 w-3 transition-transform ${adminOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {adminOpen && (
              <div className="mt-1 space-y-1">
                {adminLinks.map((link) => (
                  <NavLink key={link.href} {...link} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}

export function TopBar({
  userName,
  onToggleSidebar,
}: {
  userName: string;
  onToggleSidebar?: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{userName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          Salir
        </button>
      </div>
    </header>
  );
}

// Shell con estado del drawer del sidebar en mobile: en desktop (md+) el
// sidebar queda fijo como antes; por debajo de md arranca oculto y se
// muestra/oculta con el botón hamburguesa del TopBar, como un panel
// superpuesto con backdrop.
export function AppShell({
  isAdmin,
  isRestringido,
  userName,
  children,
}: {
  isAdmin: boolean;
  isRestringido: boolean;
  userName: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar isAdmin={isAdmin} isRestringido={isRestringido} onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar userName={userName} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

// Mantener Nav export para compatibilidad con cualquier import existente
export function Nav({
  userName,
  isAdmin,
  isRestringido,
}: {
  userName: string;
  isAdmin: boolean;
  isRestringido: boolean;
}) {
  return (
    <>
      <Sidebar isAdmin={isAdmin} isRestringido={isRestringido} />
      <TopBar userName={userName} />
    </>
  );
}
