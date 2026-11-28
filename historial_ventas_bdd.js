const db = require('./db/conexion');

const POR_PAGINA_VENTAS = 10;

/**
 * Devuelve los usuarios que han registrado ventas o están activos para el select de cajeros.
 */
function listarCajerosVentas() {
  const filas = db
    .prepare(
      `SELECT DISTINCT u.id, u.usuario, u.nombre_completo
       FROM USUARIOS u
       LEFT JOIN VENTAS v ON v.usuario_id = u.id
       WHERE u.activo = 1 OR v.folio IS NOT NULL
       ORDER BY u.nombre_completo ASC`
    )
    .all();

  return filas.map((f) => ({
    id: f.id,
    usuario: f.usuario,
    nombre: f.nombre_completo
  }));
}

/**
 * Consulta las ventas registradas en SQLite aplicando filtros (folio, rango de fechas, cajero) y paginación.
 */
function listarVentas(filtros = {}) {
  const folioRaw = String(filtros.folio || '').trim();
  const fechaInicial = String(filtros.fechaInicial || '').trim();
  const fechaFinal = String(filtros.fechaFinal || '').trim();
  const cajero = String(filtros.cajero || '').trim();

  let paginaSolicitada = Number.parseInt(filtros.pagina, 10);
  if (!Number.isFinite(paginaSolicitada) || paginaSolicitada < 1) {
    paginaSolicitada = 1;
  }

  const condiciones = [];
  const parametros = [];

  // Acepta formatos como "V-0042", "0042" o "42"
  if (folioRaw) {
    const limpio = folioRaw.replace(/^v-?/i, '').trim();
    const numeroFolio = Number.parseInt(limpio, 10);
    if (Number.isInteger(numeroFolio) && numeroFolio > 0) {
      condiciones.push('v.folio = ?');
      parametros.push(numeroFolio);
    } else {
      condiciones.push('1 = 0');
    }
  }

  if (fechaInicial && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicial)) {
    condiciones.push('DATE(v.fecha_hora) >= DATE(?)');
    parametros.push(fechaInicial);
  }

  if (fechaFinal && /^\d{4}-\d{2}-\d{2}$/.test(fechaFinal)) {
    condiciones.push('DATE(v.fecha_hora) <= DATE(?)');
    parametros.push(fechaFinal);
  }

  if (cajero) {
    condiciones.push('(u.usuario = ? OR u.nombre_completo = ?)');
    parametros.push(cajero, cajero);
  }

  const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  // Totales globales de la búsqueda filtrada descontando devoluciones vinculadas
  const filaResumen = db
    .prepare(
      `SELECT
         COUNT(*) AS total_ventas,
         COALESCE(
           SUM(
             v.total - COALESCE(
               (SELECT SUM(dev.total_devuelto) FROM DEVOLUCIONES dev WHERE dev.venta_folio = v.folio),
               0
             )
           ),
           0
         ) AS total_facturado
       FROM VENTAS v
       INNER JOIN USUARIOS u ON u.id = v.usuario_id
       ${whereSql}`
    )
    .get(...parametros);

  const total = Number(filaResumen ? filaResumen.total_ventas : 0);
  const totalFacturado = Number(Math.max(0, Number(filaResumen ? filaResumen.total_facturado : 0)).toFixed(2));
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_VENTAS));
  const pagina = Math.min(paginaSolicitada, totalPaginas);
  const offset = (pagina - 1) * POR_PAGINA_VENTAS;

  // Filas paginadas de ventas con conteo de artículos y estado respecto a devoluciones
  const filas = db
    .prepare(
      `SELECT
         v.folio,
         v.fecha_hora,
         u.nombre_completo AS cajero,
         v.total,
         COALESCE((SELECT SUM(dv.cantidad) FROM DETALLE_VENTAS dv WHERE dv.venta_folio = v.folio), 0) AS articulos,
         COALESCE((SELECT SUM(dev.total_devuelto) FROM DEVOLUCIONES dev WHERE dev.venta_folio = v.folio), 0) AS total_devuelto
       FROM VENTAS v
       INNER JOIN USUARIOS u ON u.id = v.usuario_id
       ${whereSql}
       ORDER BY v.fecha_hora DESC, v.folio DESC
       LIMIT ? OFFSET ?`
    )
    .all(...parametros, POR_PAGINA_VENTAS, offset);

  const ventas = filas.map((fila) => {
    const totalVenta = Number(fila.total || 0);
    const totalDevuelto = Number(fila.total_devuelto || 0);
    let estado = 'Completada';
    if (totalDevuelto > 0 && totalDevuelto >= totalVenta) {
      estado = 'Devuelta';
    } else if (totalDevuelto > 0) {
      estado = 'Dev. parcial';
    }

    return {
      folio: fila.folio,
      fecha_hora: fila.fecha_hora,
      cajero: fila.cajero,
      articulos: Number(fila.articulos || 0),
      total: totalVenta,
      estado
    };
  });

  return {
    ok: true,
    resumen: {
      ventasRegistradas: total,
      totalFacturado
    },
    ventas,
    pagina,
    porPagina: POR_PAGINA_VENTAS,
    total,
    totalPaginas
  };
}

module.exports = {
  listarCajerosVentas,
  listarVentas
};