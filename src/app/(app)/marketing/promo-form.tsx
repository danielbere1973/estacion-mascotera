"use client";

import { useRef, useState, useTransition } from "react";
import { SeleccionClientes } from "./seleccion-clientes";
import { DetallesMailForm } from "./detalles-mail-form";
import { enviarCampania } from "./actions";

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  email: string | null;
};

export function PromoForm({ clientes }: { clientes: Cliente[] }) {
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const tituloRef = useRef<HTMLInputElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function enviar() {
    setMensaje(null);

    const titulo = tituloRef.current?.value.trim() ?? "";
    const cuerpoHtml = cuerpoRef.current?.innerHTML.trim() ?? "";
    const destinatarios = clientes
      .filter((c) => seleccionados.has(c.id) && c.email)
      .map((c) => c.email as string);

    if (destinatarios.length === 0) {
      setMensaje({ tipo: "error", texto: "Seleccioná al menos un cliente con email cargado." });
      return;
    }
    if (!titulo) {
      setMensaje({ tipo: "error", texto: "Completá el título del mail." });
      return;
    }
    if (!cuerpoHtml) {
      setMensaje({ tipo: "error", texto: "Completá el cuerpo del mail." });
      return;
    }

    startTransition(async () => {
      const resultado = await enviarCampania({ titulo, cuerpoHtml, destinatarios });
      if (resultado?.error) {
        setMensaje({ tipo: "error", texto: resultado.error });
      } else {
        setMensaje({
          tipo: "ok",
          texto: `Mail enviado a ${destinatarios.length} cliente${destinatarios.length > 1 ? "s" : ""}.`,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:min-h-0 sm:flex-1">
      <div className="flex flex-col gap-4 sm:min-h-0 sm:flex-1 sm:flex-row sm:items-stretch">
        <SeleccionClientes
          clientes={clientes}
          seleccionados={seleccionados}
          onCambiarSeleccionados={setSeleccionados}
        />
        <DetallesMailForm tituloRef={tituloRef} cuerpoRef={cuerpoRef} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Clientes seleccionados:{" "}
          <span className="font-semibold">
            {seleccionados.size} de {clientes.length}
          </span>
        </p>

        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
          {mensaje && (
            <p className={`text-sm ${mensaje.tipo === "error" ? "text-red-600" : "text-green-700"}`}>
              {mensaje.texto}
            </p>
          )}
          <button
            type="button"
            onClick={enviar}
            disabled={pending}
            className="w-full rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
