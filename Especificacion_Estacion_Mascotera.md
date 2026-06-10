# Especificación Técnica de Requerimientos: Estación Mascotera

Este documento detalla la estructura, flujos, arquitectura y lógica de negocio para la aplicación web interna de **Estación Mascotera**, diseñada para optimizar la organización del stock, compras a mayoristas, ventas y finanzas del negocio.

---

## 1. Resumen del Proyecto

- **Objetivo principal:** Digitalizar y automatizar el control de stock, el registro de compras, ventas a clientes (con sus respectivos costos de envío y estados de facturación) y la gestión de gastos impositivos/operativos.
- **Usuarios:** Acceso completo y simétrico para ambos socios. El sistema registrará la trazabilidad de qué usuario realizó cada transacción.
- **Plataforma:** Aplicación Web con diseño *Responsive* (optimizada para uso en smartphones durante repartos y en computadoras para tareas administrativas).
- **Enfoque de diseño:** Herramienta interna de gestión (prioridad en eficiencia, velocidad de carga y claridad de datos por sobre la estética comercial).

---

## 2. Decisiones de Arquitectura y Tecnología

- **Frontend:** React / Next.js (diseño adaptable mediante componentes responsivos).
- **Base de Datos:** **CockroachDB** (Motor SQL distribuido para garantizar consistencia ACID absoluta en stock y caja, evitando inconsistencias transaccionales).
- **Procesamiento de Precios/Stock Mayorista:** Módulo de importación manual de archivos Excel (`.xlsx` / `.csv`) con persistencia del historial de estados de stock.

---

## 3. Modelo de Datos (Base de Datos en CockroachDB)

A continuación se describen las tablas principales del sistema y sus relaciones relacionales básicas:

### 3.1. Tabla: `usuarios`
Registra a los socios que interactúan con el sistema para auditoría interna.
- `id` (INT, Primary Key)
- `nombre` (VARCHAR)
- `apellido` (VARCHAR)
- `email` (VARCHAR, Unique)

### 3.2. Tabla: `productos`
Catálogo maestro de artículos para la venta.
- `id` (INT, Primary Key)
- `sku` / `codigo_barra` (VARCHAR, Unique)
- `nombre` (VARCHAR) - *Ej: Bolsa Royal Canin Size Adult 15kg*
- `marca` (VARCHAR)
- `categoria` (ENUM: 'Alimento', 'Pouch', 'Lata', 'Snack', 'Golosina')
- `presentacion` (ENUM: 'Bolsa Cerrada', 'Caja Cerrada', 'Individual')
- `stock_actual` (INT) - *Cantidad disponible en tiempo real*

### 3.3. Tabla: `proveedores`
Mayoristas de alimentos y accesorios.
- `id` (INT, Primary Key)
- `nombre` (VARCHAR)
- `direccion` (VARCHAR, Opcional)
- `contacto` (VARCHAR, Opcional)

### 3.4. Tabla: `compras`
Ingresos de mercadería al inventario.
- `id` (INT, Primary Key)
- `proveedor_id` (INT, Foreign Key -> `proveedores.id`)
- `producto_id` (INT, Foreign Key -> `productos.id`)
- `cantidad` (INT)
- `precio_costo_unitario` (DECIMAL)
- `costo_envio` (DECIMAL, Opcional)
- `numero_pedido` (VARCHAR, Opcional)
- `facturado` (BOOLEAN)
- `numero_factura` (VARCHAR, Opcional)
- `fecha_compra` (TIMESTAMP)
- `usuario_id` (INT, Foreign Key -> `usuarios.id`)

### 3.5. Tabla: `clientes`
Registro de la base de datos de compradores.
- `id` (INT, Primary Key)
- `nombre` (VARCHAR)
- `apellido` (VARCHAR)
- `direccion` (VARCHAR)
- `telefono` (VARCHAR)
- `email` (VARCHAR, Opcional)

### 3.6. Tabla: `ventas`
Egresos de stock y facturación de cara al cliente.
- `id` (INT, Primary Key)
- `cliente_id` (INT, Foreign Key -> `clientes.id`)
- `canal_venta` (ENUM: 'Tiendanube', 'WhatsApp', 'Teléfono')
- `medio_pago` (VARCHAR) - *Ej: Transferencia, Efectivo, Mercado Pago*
- `costo_envio` (DECIMAL) - *Costo cobrado/asumido por la logística (propia o empresa)*
- `facturado` (BOOLEAN)
- `numero_factura` (VARCHAR, Opcional)
- `fecha_venta` (TIMESTAMP)
- `usuario_id` (INT, Foreign Key -> `usuarios.id`)

### 3.7. Tabla: `detalle_ventas`
Líneas de productos dentro de una misma venta.
- `id` (INT, Primary Key)
- `venta_id` (INT, Foreign Key -> `ventas.id`)
- `producto_id` (INT, Foreign Key -> `productos.id`)
- `cantidad` (INT)
- `precio_venta_unitario` (DECIMAL)

### 3.8. Tabla: `gastos`
Control de egresos fijos y variables del negocio.
- `id` (INT, Primary Key)
- `categoria_gasto` (ENUM: 'Monotributo', 'Teléfono', 'Community Manager', 'Publicidad', 'Soporte IT', 'Otros')
- `monto` (DECIMAL)
- `descripcion` (TEXT, Opcional)
- `fecha_gasto` (TIMESTAMP)

### 3.9. Tabla: `historial_stock_mayorista`
Almacena el histórico de los archivos escaneados/scrapeados los viernes para análisis de tendencias de costos y auditoría de disponibilidad.
- `id` (INT, Primary Key)
- `producto_id` (INT, Foreign Key -> `productos.id`, Opcional)
- `sku` (VARCHAR)
- `precio_costo_scraped` (DECIMAL)
- `stock_mayorista_scraped` (INT)
- `fecha_importacion` (TIMESTAMP)

---

## 4. Lógica de Negocio y Automatizaciones

### 4.1. Regla de Precios y Traslado de Aumentos
1. **Precio Base de Venta:** Se calcula inicialmente aplicando un recargo base del **+30%** sobre el precio de costo del producto (`Precio Venta = Costo * 1.30`). La app debe permitir modificar este porcentaje de forma manual por producto o categoría si varía eventualmente.
2. **Impacto de Aumentos:** Cuando el módulo procese un aumento de costos desde el Excel del mayorista, dicho valor se actualizará en la base de datos de manera inmediata y se trasladará directamente al precio de venta sugerido, asegurando que el margen no se diluya.

### 4.2. Módulo de Importación de Excel (Los Viernes)
- **Mecánica:** Carga **Manual** mediante un botón en la interfaz web de administración.
- **Funcionamiento:**
  - El usuario sube el archivo `.xlsx` o `.csv` obtenido del scrapeo semanal (el cual mantendrá una estructura fija de columnas: SKU, Nombre, Costo, Stock Mayorista).
  - El sistema procesa las filas, actualiza la tabla de `productos` con los nuevos costos, calcula los nuevos precios de venta sugeridos y guarda una copia del estado en la tabla `historial_stock_mayorista`.
  - **Historial de Stock:** El sistema no solo sobreescribe los valores, sino que archiva el estado del stock mayorista y propio de esa fecha para evaluar fluctuaciones de stock a lo largo del tiempo.

### 4.3. Envíos y Logística
- Cada pedido de venta o compra registra obligatoriamente su campo `costo_envio`. Esto permite calcular la ganancia real neta deduciendo los gastos de transporte (sean propios con consumo de nafta o tercerizados mediante empresa contratada).

---

## 5. Diseño de Interfaces (Flujo de Pantallas Web/Mobile)

### Pantalla 1: Dashboard Principal (Inicio)
- **Métricas Clásicas:**
  - **Total Facturado:** Sumatoria de ventas en el período seleccionado.
  - **Total Gastado:** Sumatoria de compras realizadas + gastos fijos y variables (`Tabla: gastos`).
  - **Rentabilidad Neta:** Cálculo matemático: `Ventas Totales - Costos de Mercadería Vendida - Costos de Envío - Gastos Totales`.
  - **Valor de Stock:** Sumatoria de (`stock_actual * precio_costo_unitario`) para conocer el patrimonio líquido actual en mercadería.
- **Visualización:** Gráfico interactivo (de torta o barras) segmentando los gastos impositivos y operativos del negocio.

### Pantalla 2: Gestión de Ventas
- Vista de listado con filtros por fecha, cliente y estado de facturación.
- Formulario optimizado para celulares para ingresar rápidamente una **Nueva Venta**: selección de cliente, canal (Tiendanube/WhatsApp/Teléfono), método de pago, ítems vendidos, costo de envío y switch de Facturado (Sí/No con su número respectivo).
- *(Arquitectura preparada para integrar la API automatizada de Tiendanube en una fase posterior).*

### Pantalla 3: Inventario y Proveedores
- Visualización de la lista de productos con alertas visuales de bajo stock.
- Formulario de carga para órdenes de compra a mayoristas.
- Zona de arrastre de archivos (*Drag and Drop*) para la importación del Excel de los viernes.

### Pantalla 4: Módulo de Gastos
- Formulario simple y ágil para asentar egresos sobre la marcha (Monotributo, CM, Publicidad, etc.) con campos para Fecha, Tipo, Monto y Notas aclaratorias.
