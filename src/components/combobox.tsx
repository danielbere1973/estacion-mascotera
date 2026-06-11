"use client";

import { useEffect, useRef, useState } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  // Texto adicional sobre el que también se puede buscar (ej: SKU, código, tamaño).
  search: string;
};

// Normaliza para poder buscar "Urinary" y encontrar "URINARY", o "ñ" y encontrar "Ñ".
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("")
    .toLowerCase();
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder,
  required,
}: {
  options: ComboboxOption[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected?.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected?.label ?? "");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  });

  const q = normalizar(query);
  const filtrados = q
    ? options.filter((o) => normalizar(`${o.label} ${o.search}`).includes(q)).slice(0, 50)
    : options.slice(0, 50);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        required={required && !value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onSelect("");
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {open && filtrados.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg">
          {filtrados.map((o) => (
            <li
              key={o.value}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(o.value);
                setQuery(o.label);
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 hover:bg-blue-50"
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {open && filtrados.length === 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg">
          <li className="px-3 py-2 text-gray-400">Sin resultados</li>
        </ul>
      )}
    </div>
  );
}
