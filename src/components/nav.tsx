"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/ventas", label: "Ventas" },
  { href: "/inventario", label: "Inventario" },
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
];

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
  const visibleLinks = isRestringido ? linksRestringido : isAdmin ? [...links, ...adminLinks] : links;

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

        <nav className="flex gap-1 overflow-x-auto">
          {visibleLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

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
