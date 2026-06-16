export function NuevoProductoFields({
  defaultNombre = "",
  defaultSku = "",
  tiposProducto = [],
}: {
  defaultNombre?: string;
  defaultSku?: string;
  tiposProducto?: { id: number; nombre: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
      <input
        name="productoSku"
        placeholder="SKU / Código de barra"
        defaultValue={defaultSku}
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="productoNombre"
        placeholder="Nombre"
        defaultValue={defaultNombre}
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        name="productoMarca"
        placeholder="Marca"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        name="productoCategoria"
        required
        defaultValue=""
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Categoría...
        </option>
        {tiposProducto.map((t) => (
          <option key={t.id} value={t.nombre}>{t.nombre}</option>
        ))}
      </select>
      <select
        name="productoPresentacion"
        required
        defaultValue=""
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Presentación...
        </option>
        <option value="BOLSA_CERRADA">Bolsa Cerrada</option>
        <option value="CAJA_CERRADA">Caja Cerrada</option>
        <option value="INDIVIDUAL">Individual</option>
      </select>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Contenido</label>
        <input
          name="productoContenido"
          type="number"
          step="0.01"
          min={0}
          defaultValue={1}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Unidad de medida</label>
        <select
          name="productoUnidadMedida"
          required
          defaultValue="UNIDAD"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="KILOGRAMOS">Kilogramos</option>
          <option value="GRAMOS">Gramos</option>
          <option value="LITROS">Litros</option>
          <option value="MILILITROS">Mililitros</option>
          <option value="UNIDAD">Unidad</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Margen sobre costo (%)</label>
        <input
          name="productoMargen"
          type="number"
          step="0.01"
          defaultValue={30}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
