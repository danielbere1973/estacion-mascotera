import Link from "next/link";

// Pestañas de Logística: el seguimiento en vivo y el submódulo Costos/KM.
export function PestanasLogistica({ activa }: { activa: "seguimiento" | "costos" }) {
  const clase = (esActiva: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium sm:flex-none ${
      esActiva ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
    }`;
  return (
    <nav className="flex gap-1 rounded-lg bg-gray-100 p-1 sm:inline-flex">
      <Link href="/logistica" className={clase(activa === "seguimiento")}>
        📍 Seguimiento en vivo
      </Link>
      <Link href="/logistica/costos-km" className={clase(activa === "costos")}>
        💲 Costos/KM
      </Link>
    </nav>
  );
}
