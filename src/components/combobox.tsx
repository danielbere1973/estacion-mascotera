"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ComboboxOption = {
  value: string;
  label: string;
  search: string;
};

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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

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

  function handleOpen() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 2,
        left: rect.left,
        width: Math.max(rect.width, 320),
        zIndex: 9999,
      });
    }
    setOpen(true);
  }

  const q = normalizar(query);
  const filtrados = q
    ? options.filter((o) => normalizar(`${o.label} ${o.search}`).includes(q)).slice(0, 50)
    : options.slice(0, 50);

  const dropdown = open ? (
    <ul
      style={dropdownStyle}
      className="max-h-64 overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg"
    >
      {filtrados.length === 0 ? (
        <li className="px-3 py-2 text-gray-400">Sin resultados</li>
      ) : (
        filtrados.map((o) => (
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
            <span className="font-mono text-xs text-gray-400 mr-2">{o.value}</span>
            {o.label}
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        required={required && !value}
        placeholder={placeholder}
        onFocus={handleOpen}
        onChange={(e) => {
          setQuery(e.target.value);
          handleOpen();
          if (value) onSelect("");
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
