const db = require('./db/conexion');

/**
 * Obtiene los indicadores principales, movimientos recientes (ventas, compras y devoluciones)
 * y productos activos con stock bajo para inicio_admin.html.
 */
function obtenerResumenInicio(umbralStockBajo = 10) {
  const umbral = Number.isFinite(Number(umbralStockBajo)) ? Number(umbralStockBajo) : 10;

  // 1. Indicadores de ventas de hoy (hora local de SQLite)
  const filaVentasHoy = db
    .prepare(
      `SELECT
         COALESCE(SUM(total), 0) AS total_hoy,
         COUNT(*) AS tickets_hoy
       FROM VENTAS
       WHERE DATE(fecha_hora) = DATE('now', 'localtime')`
    )
    .get();

  // 2. Indicadores de productos activos y alertas de stock bajo
  const filaProductos = db
    .prepare(
      `SELECT
         COUNT(CASE WHEN LOWER(estado) = 'activo' AND cantidad > 0 THEN 1 END) AS activos,
         COUNT(CASE WHEN LOWER(estado) = 'activo' AND cantidad <= ? THEN 1 END) AS stock_bajo
       FROM PRODUCTOS`
    )
    .get(umbral);

  // 3. Lista de productos activos con stock bajo (<= umbral)
  const inventarioBajo = db
    .prepare(
      `SELECT
         id,
         codigo_consulta,
         nombre,
         precio,
         cantidad,
         LOWER(estado) AS estado
       FROM PRODUCTOS
       WHERE LOWER(estado) = 'activo' AND cantidad <= ?
       ORDER BY cantidad ASC, nombre ASC`
    )
    .all(umbral);

  // 4. Movimientos recientes unificados (Ventas, Compras y Devoluciones)
  const movimientos = db
    .prepare(
      `SELECT
         v.folio AS folio,
         'V' AS prefijo,
         'Venta' AS tipo,
         u.nombre_completo AS usuario,
         v.fecha_hora AS fecha_hora,
         v.total AS total
       FROM VENTAS v
       INNER JOIN USUARIOS u ON u.id = v.usuario_id

       UNION ALL

       SELECT
         c.folio AS folio,
         'C' AS prefijo,
         'Compra' AS tipo,
         u.nombre_completo AS usuario,
         c.fecha_hora AS fecha_hora,
         c.total AS total
       FROM COMPRAS c
       INNER JOIN USUARIOS u ON u.id = c.usuario_id

       UNION ALL

       SELECT
         d.folio AS folio,
         'D' AS prefijo,
         'Devolución' AS tipo,
         u.nombre_completo AS usuario,
         d.fecha_hora AS fecha_hora,
         d.total_devuelto AS total
       FROM DEVOLUCIONES d
       INNER JOIN USUARIOS u ON u.id = d.usuario_id

       ORDER BY fecha_hora DESC, folio DESC
       LIMIT 30`
    )
    .all();

  return {
    ok: true,
    indicadores: {
      ventasHoy: Number(filaVentasHoy.total_hoy || 0),
      ticketsEmitidos: Number(filaVentasHoy.tickets_hoy || 0),
      productosActivos: Number(filaProductos.activos || 0),
      alertasStock: Number(filaProductos.stock_bajo || 0)
    },
    movimientos,
    inventarioBajo
  };
}

module.exports = {
  obtenerResumenInicio
};