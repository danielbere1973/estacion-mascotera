"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/ventas", label: "Ventas" },
  { href: "/inventario", label: "Inventario" },
  { href: "/consignaciones", label: "Consignaciones" },
  { href: "/gastos", label: "Gastos" },
  { href: "/reportes", label: "Reportes" },
];

const linksRestringido = [
  { href: "/", label: "Dashboard" },
  { href: "/ventas", label: "Ventas" },
  { href: "/inventario/compras", label: "Compras" },
];

const adminLinks = [
  { href: "/clientes", label: "Clientes" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/actividad", label: "Actividad" },
  { href: "/admin/medios-pago", label: "Medios de pago" },
  { href: "/inventario/tipos", label: "Categorías" },
];

function AdminDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = adminLinks.some((l) => pathname.startsWith(l.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
          isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        Admin
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-gray-200 bg-white shadow-lg py-1">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm ${
                pathname.startsWith(link.href)
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Nav({
  userName,
  isAdmin,
  isRestringido,
}: {
  userName: string;
  isAdmin: boolean;
  isRestringido: boolean;
}) {
  const pathname = usePathname();
  const visibleLinks = isRestringido ? linksRestringido : links;

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Image src="/logo.png" alt="Estación Mascotera" width={32} height={32} className="rounded-full" />
            Estación Mascotera
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-gray-800 sm:hidden"
          >
            Salir
          </button>
        </div>

        <div className="flex items-center gap-1">
          <nav className="flex gap-1 overflow-x-auto items-center">
            {visibleLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {isAdmin && <AdminDropdown pathname={pathname} />}
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-sm text-gray-500">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
