-- ============================================================
-- A. ESCÁNER Y BÚSQUEDA PAGINADA (Secciones 3.5, 3.7 y 8)
-- ============================================================

-- 1. Buscar producto exacto por código de barras/QR (lector físico)
SELECT id, codigo_consulta, nombre, descripcion, precio, cantidad, estado
FROM PRODUCTOS
WHERE codigo_consulta = ? AND estado = 'activo';

-- 2. Listado paginado con búsqueda por código o nombre y filtro de estado
-- Parámetros: ('%texto%', '%texto%', estado_o_null, estado_o_null, limite, offset)
SELECT id, codigo_consulta, nombre, precio, cantidad, estado
FROM PRODUCTOS
WHERE (codigo_consulta LIKE ? OR nombre LIKE ?)
  AND (? IS NULL OR estado = ?)
ORDER BY nombre ASC
LIMIT ? OFFSET ?;

-- Total de registros para calcular número de páginas
SELECT COUNT(*) AS total_registros
FROM PRODUCTOS
WHERE (codigo_consulta LIKE ? OR nombre LIKE ?)
  AND (? IS NULL OR estado = ?);

-- ============================================================
-- B. VALIDACIÓN DE DEVOLUCIONES (Secciones 3.3 y 3.6)
-- ============================================================

-- Verifica cuánto se vendió vs cuánto ya se devolvió de un producto en una venta
-- Parámetros: (venta_folio, producto_id, venta_folio, producto_id, producto_id)
SELECT
    p.id AS producto_id,
    p.nombre,
    COALESCE((
        SELECT SUM(cantidad)
        FROM DETALLE_VENTAS
        WHERE venta_folio = ? AND producto_id = ?
    ), 0) AS cantidad_vendida,
    COALESCE((
        SELECT SUM(dd.cantidad)
        FROM DETALLE_DEVOLUCIONES dd
        JOIN DEVOLUCIONES d ON d.folio = dd.devolucion_folio
        WHERE d.venta_folio = ? AND dd.producto_id = ?
    ), 0) AS ya_devuelto
FROM PRODUCTOS p
WHERE p.id = ?;
-- Regla en backend: disponible = cantidad_vendida - ya_devuelto
-- Si cantidad_a_devolver > disponible -> rechazar operación.

-- ============================================================
-- C. LOS 5 REPORTES MÍNIMOS OBLIGATORIOS (Sección 6.1)
-- ============================================================

-- REPORTE 1: Inventario actual
-- Columnas: Código, nombre, precio, existencia, estado
SELECT
    codigo_consulta AS codigo,
    nombre,
    ROUND(precio, 2) AS precio,
    cantidad AS existencia,
    estado
FROM PRODUCTOS
WHERE (codigo_consulta LIKE ? OR nombre LIKE ?)
  AND (? IS NULL OR estado = ?)
ORDER BY nombre ASC;

-- Totales del Reporte 1
SELECT
    COUNT(*) AS total_productos,
    COALESCE(SUM(cantidad), 0) AS suma_existencias
FROM PRODUCTOS
WHERE (codigo_consulta LIKE ? OR nombre LIKE ?)
  AND (? IS NULL OR estado = ?);

-- REPORTE 2: Ventas por rango (cajero opcional: pasar NULL para todos)
-- Fechas en formato 'AAAA-MM-DD HH:MM', ej: '2026-11-01 00:00' y '2026-11-30 23:59'
SELECT
    v.folio,
    v.fecha_hora,
    u.nombre_completo AS cajero,
    ROUND(v.subtotal, 2) AS subtotal,
    ROUND(v.iva, 2) AS iva,
    ROUND(v.total, 2) AS total
FROM VENTAS v
JOIN USUARIOS u ON u.id = v.usuario_id
WHERE v.fecha_hora BETWEEN ? AND ?
  AND (? IS NULL OR v.usuario_id = ?)
ORDER BY v.fecha_hora DESC;

-- Totales del Reporte 2 (total facturado, número de tickets, ticket promedio)
SELECT
    COUNT(*) AS numero_tickets,
    ROUND(COALESCE(SUM(total), 0), 2) AS total_facturado,
    ROUND(COALESCE(AVG(total), 0), 2) AS ticket_promedio
FROM VENTAS
WHERE fecha_hora BETWEEN ? AND ?
  AND (? IS NULL OR usuario_id = ?);

-- REPORTE 3: Detalle de ventas por rango
SELECT
    v.fecha_hora AS fecha,
    v.folio,
    p.codigo_consulta AS codigo,
    p.nombre,
    dv.cantidad,
    ROUND(dv.precio_unitario, 2) AS precio_unitario,
    ROUND(dv.importe, 2) AS importe_linea
FROM DETALLE_VENTAS dv
JOIN VENTAS v ON v.folio = dv.venta_folio
JOIN PRODUCTOS p ON p.id = dv.producto_id
WHERE v.fecha_hora BETWEEN ? AND ?
ORDER BY v.fecha_hora DESC, v.folio DESC;

-- Totales del Reporte 3
SELECT
    COALESCE(SUM(dv.cantidad), 0) AS total_unidades_vendidas,
    ROUND(COALESCE(SUM(dv.importe), 0), 2) AS importe_acumulado
FROM DETALLE_VENTAS dv
JOIN VENTAS v ON v.folio = dv.venta_folio
WHERE v.fecha_hora BETWEEN ? AND ?;

-- REPORTE 4: Compras por rango
SELECT
    c.folio,
    c.fecha_hora AS fecha,
    c.proveedor,
    ROUND(c.total, 2) AS total
FROM COMPRAS c
WHERE c.fecha_hora BETWEEN ? AND ?
ORDER BY c.fecha_hora DESC;

-- Totales del Reporte 4
SELECT
    COUNT(*) AS numero_compras,
    ROUND(COALESCE(SUM(total), 0), 2) AS importe_total_comprado
FROM COMPRAS
WHERE fecha_hora BETWEEN ? AND ?;

-- REPORTE 5: Devoluciones por rango
SELECT
    d.fecha_hora AS fecha,
    d.venta_folio AS folio_venta,
    p.codigo_consulta AS codigo,
    p.nombre,
    dd.cantidad AS cantidad_devuelta,
    ROUND(dd.importe, 2) AS importe_ajustado,
    d.motivo
FROM DETALLE_DEVOLUCIONES dd
JOIN DEVOLUCIONES d ON d.folio = dd.devolucion_folio
JOIN PRODUCTOS p ON p.id = dd.producto_id
WHERE d.fecha_hora BETWEEN ? AND ?
ORDER BY d.fecha_hora DESC;

-- Totales del Reporte 5
SELECT
    COALESCE(SUM(dd.cantidad), 0) AS total_unidades_devueltas,
    ROUND(COALESCE(SUM(dd.importe), 0), 2) AS importe_total_devuelto
FROM DETALLE_DEVOLUCIONES dd
JOIN DEVOLUCIONES d ON d.folio = dd.devolucion_folio
WHERE d.fecha_hora BETWEEN ? AND ?;

-- ============================================================
-- D. CORTE DE CAJA Y MOVIMIENTOS POR USUARIO (Sección 3.8)
-- ============================================================

-- Corte de caja del día (o por rango): ventas menos devoluciones
-- Parámetros: (fecha_ini, fecha_fin, fecha_ini, fecha_fin, fecha_ini, fecha_fin)
SELECT
    (SELECT COUNT(*) FROM VENTAS WHERE fecha_hora BETWEEN ? AND ?) AS num_ventas,
    ROUND(COALESCE((SELECT SUM(total) FROM VENTAS WHERE fecha_hora BETWEEN ? AND ?), 0), 2) AS total_ventas,
    ROUND(COALESCE((SELECT SUM(total_devuelto) FROM DEVOLUCIONES WHERE fecha_hora BETWEEN ? AND ?), 0), 2) AS total_devoluciones;
-- Neto en caja = total_ventas - total_devoluciones

-- Movimientos consolidados por usuario (sirve para diario, semanal o mensual según el rango de fechas)
SELECT 'VENTA' AS tipo, v.folio, v.fecha_hora, u.nombre_completo AS usuario, ROUND(v.total, 2) AS importe
FROM VENTAS v
JOIN USUARIOS u ON u.id = v.usuario_id
WHERE v.fecha_hora BETWEEN ? AND ? AND (? IS NULL OR v.usuario_id = ?)

UNION ALL

SELECT 'COMPRA' AS tipo, c.folio, c.fecha_hora, u.nombre_completo AS usuario, ROUND(c.total, 2) AS importe
FROM COMPRAS c
JOIN USUARIOS u ON u.id = c.usuario_id
WHERE c.fecha_hora BETWEEN ? AND ? AND (? IS NULL OR c.usuario_id = ?)

UNION ALL

SELECT 'DEVOLUCION' AS tipo, d.folio, d.fecha_hora, u.nombre_completo AS usuario, ROUND(d.total_devuelto, 2) AS importe
FROM DEVOLUCIONES d
JOIN USUARIOS u ON u.id = d.usuario_id
WHERE d.fecha_hora BETWEEN ? AND ? AND (? IS NULL OR d.usuario_id = ?)

ORDER BY fecha_hora DESC;
