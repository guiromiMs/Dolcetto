const db = require('./db/conexion');

/**
 * Busca ventas paginadas para el Paso 1 de devolucion_operador.html.
 */
function buscarVentasParaDevolucion({ folio = '', fecha = '', pagina = 1, limite = 5 } = {}) {
  const condiciones = [];
  const parametros = [];

  const folioTexto = String(folio || '').trim();
  if (folioTexto) {
    const soloDigitos = folioTexto.replace(/^v-?/i, '').replace(/^0+/, '');
    if (soloDigitos && /^\d+$/.test(soloDigitos)) {
      condiciones.push("(v.folio = ? OR printf('V-%04d', v.folio) LIKE ?)");
      parametros.push(Number(soloDigitos), `%${folioTexto.toUpperCase()}%`);
    } else {
      condiciones.push("printf('V-%04d', v.folio) LIKE ?");
      parametros.push(`%${folioTexto.toUpperCase()}%`);
    }
  }

  const fechaTexto = String(fecha || '').trim();
  if (fechaTexto) {
    condiciones.push('substr(v.fecha_hora, 1, 10) = ?');
    parametros.push(fechaTexto);
  }

  const whereSQL = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM VENTAS v
       ${whereSQL}`
    )
    .get(...parametros);

  const totalRegistros = Number(totalRow ? totalRow.total : 0);
  const tamPagina = Math.max(1, Number(limite) || 5);
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / tamPagina));
  const paginaActual = Math.min(Math.max(1, Number(pagina) || 1), totalPaginas);
  const offset = (paginaActual - 1) * tamPagina;

  const filas = db
    .prepare(
      `SELECT
         v.folio,
         v.fecha_hora,
         u.usuario AS cajero,
         v.total
       FROM VENTAS v
       JOIN USUARIOS u ON u.id = v.usuario_id
       ${whereSQL}
       ORDER BY v.folio DESC
       LIMIT ? OFFSET ?`
    )
    .all(...parametros, tamPagina, offset);

  const ventas = filas.map((f) => ({
    folio: f.folio,
    folioFormateado: `V-${String(f.folio).padStart(4, '0')}`,
    fecha_hora: f.fecha_hora,
    cajero: f.cajero,
    total: Number(f.total || 0)
  }));

  return {
    ok: true,
    ventas,
    paginacion: {
      pagina: paginaActual,
      totalPaginas,
      totalRegistros
    }
  };
}

/**
 * Obtiene el encabezado de una venta y sus productos con cálculo de piezas ya devueltas.
 */
function obtenerDetalleVentaDevolucion(folioInput) {
  const limpio = String(folioInput || '').trim().replace(/^v-?/i, '');
  const folio = Number(limpio);

  if (!Number.isInteger(folio) || folio <= 0) {
    return { ok: false, mensaje: 'Folio de venta no válido.' };
  }

  const venta = db
    .prepare(
      `SELECT
         v.folio,
         v.fecha_hora,
         u.usuario AS cajero,
         v.subtotal,
         v.iva,
         v.total
       FROM VENTAS v
       JOIN USUARIOS u ON u.id = v.usuario_id
       WHERE v.folio = ?`
    )
    .get(folio);

  if (!venta) {
    return { ok: false, mensaje: 'No se encontró la venta seleccionada.' };
  }

  const productos = db
    .prepare(
      `SELECT
         dv.producto_id,
         p.codigo_consulta,
         p.nombre,
         SUM(dv.cantidad) AS vendido,
         dv.precio_unitario,
         COALESCE(
           (
             SELECT SUM(dd.cantidad)
             FROM DETALLE_DEVOLUCIONES dd
             JOIN DEVOLUCIONES d ON d.folio = dd.devolucion_folio
             WHERE d.venta_folio = dv.venta_folio
               AND dd.producto_id = dv.producto_id
           ),
           0
         ) AS ya_devuelto
       FROM DETALLE_VENTAS dv
       JOIN PRODUCTOS p ON p.id = dv.producto_id
       WHERE dv.venta_folio = ?
       GROUP BY dv.producto_id, p.codigo_consulta, p.nombre, dv.precio_unitario
       ORDER BY MIN(dv.id) ASC`
    )
    .all(folio);

  const items = productos.map((p) => {
    const vendido = Number(p.vendido || 0);
    const yaDevuelto = Number(p.ya_devuelto || 0);
    const disponible = Math.max(0, vendido - yaDevuelto);

    return {
      producto_id: p.producto_id,
      codigo_consulta: p.codigo_consulta,
      nombre: p.nombre,
      vendido,
      ya_devuelto: yaDevuelto,
      disponible,
      precio_unitario: Number(p.precio_unitario || 0)
    };
  });

  return {
    ok: true,
    venta: {
      folio: venta.folio,
      folioFormateado: `V-${String(venta.folio).padStart(4, '0')}`,
      fecha_hora: venta.fecha_hora,
      cajero: venta.cajero,
      subtotal: Number(venta.subtotal || 0),
      iva: Number(venta.iva || 0),
      total: Number(venta.total || 0),
      items
    }
  };
}

const ETIQUETAS_MOTIVO = {
  producto_danado: 'Producto dañado',
  error_cobro: 'Error de cobro',
  producto_equivocado: 'Producto equivocado',
  otro: 'Otro'
};

/**
 * Registra la devolución en DEVOLUCIONES y DETALLE_DEVOLUCIONES,
 * y reingresa las unidades devueltas al stock en PRODUCTOS.
 */
function registrarDevolucion({ ventaFolio, usuarioId, items }) {
  const folioVenta = Number(ventaFolio);
  const idOperador = Number(usuarioId);

  if (!Number.isInteger(folioVenta) || folioVenta <= 0) {
    return { ok: false, mensaje: 'Folio de venta inválido.' };
  }
  if (!Number.isInteger(idOperador) || idOperador <= 0) {
    return { ok: false, mensaje: 'Sesión no válida. Inicia sesión nuevamente.' };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, mensaje: 'Selecciona al menos una unidad para devolver.' };
  }

  const ejecutarTransaccion = db.transaction(() => {
    const operador = db
      .prepare('SELECT id, usuario, nombre_completo FROM USUARIOS WHERE id = ? AND activo = 1')
      .get(idOperador);
    if (!operador) {
      throw new Error('El usuario actual no existe o está inactivo.');
    }

    const detalleActual = obtenerDetalleVentaDevolucion(folioVenta);
    if (!detalleActual.ok) {
      throw new Error(detalleActual.mensaje);
    }

    const mapaDisponibles = new Map();
    for (const prod of detalleActual.venta.items) {
      mapaDisponibles.set(prod.producto_id, prod);
    }

    const renglonesValidados = [];
    const motivosResumen = new Set();
    let totalDevuelto = 0;

    for (const item of items) {
      const prodId = Number(item.productoId);
      const cantDevolver = Number(item.cantidad);
      if (!Number.isInteger(cantDevolver) || cantDevolver <= 0) continue;

      const prodVenta = mapaDisponibles.get(prodId);
      if (!prodVenta) {
        throw new Error(`El producto ${prodId} no pertenece a esta venta.`);
      }
      if (cantDevolver > prodVenta.disponible) {
        throw new Error(
          `La cantidad de "${prodVenta.nombre}" (${cantDevolver}) supera lo disponible (${prodVenta.disponible}).`
        );
      }

      const claveMotivo = String(item.motivo || 'producto_danado').trim();
      const textoOtro = String(item.motivoOtro || '').trim();
      if (claveMotivo === 'otro' && !textoOtro) {
        throw new Error(`Escribe el motivo específico para "${prodVenta.nombre}".`);
      }

      const descripcionMotivo =
        claveMotivo === 'otro'
          ? `Otro: ${textoOtro}`
          : ETIQUETAS_MOTIVO[claveMotivo] || claveMotivo;

      motivosResumen.add(descripcionMotivo);

      const importe = Number((prodVenta.precio_unitario * cantDevolver).toFixed(2));
      totalDevuelto = Number((totalDevuelto + importe).toFixed(2));

      renglonesValidados.push({
        producto_id: prodId,
        codigo_consulta: prodVenta.codigo_consulta,
        nombre: prodVenta.nombre,
        cantidad: cantDevolver,
        precio_unitario: prodVenta.precio_unitario,
        importe,
        motivo: descripcionMotivo
      });
    }

    if (renglonesValidados.length === 0) {
      throw new Error('Selecciona al menos una unidad para devolver.');
    }

    const motivoGeneral = Array.from(motivosResumen).join(' | ');

    const infoDev = db
      .prepare(
        `INSERT INTO DEVOLUCIONES (venta_folio, usuario_id, motivo, total_devuelto)
         VALUES (?, ?, ?, ?)`
      )
      .run(folioVenta, idOperador, motivoGeneral, totalDevuelto);

    const devolucionFolio = Number(infoDev.lastInsertRowid);

    const stmtDetalle = db.prepare(
      `INSERT INTO DETALLE_DEVOLUCIONES (devolucion_folio, producto_id, cantidad, precio_unitario, importe)
       VALUES (?, ?, ?, ?, ?)`
    );
    const stmtReponerStock = db.prepare(
      `UPDATE PRODUCTOS
       SET cantidad = cantidad + ?
       WHERE id = ?`
    );

    for (const r of renglonesValidados) {
      stmtDetalle.run(devolucionFolio, r.producto_id, r.cantidad, r.precio_unitario, r.importe);
      stmtReponerStock.run(r.cantidad, r.producto_id);
    }

    const devGuardada = db
      .prepare('SELECT folio, fecha_hora, total_devuelto FROM DEVOLUCIONES WHERE folio = ?')
      .get(devolucionFolio);

    return {
      ok: true,
      mensaje: `Devolución D-${String(devolucionFolio).padStart(4, '0')} registrada correctamente.`,
      devolucion: {
        folio: devGuardada.folio,
        folioFormateado: `D-${String(devGuardada.folio).padStart(4, '0')}`,
        ventaFolioFormateado: `V-${String(folioVenta).padStart(4, '0')}`,
        fecha_hora: devGuardada.fecha_hora,
        operador: operador.nombre_completo,
        motivo: motivoGeneral,
        total_devuelto: Number(devGuardada.total_devuelto),
        items: renglonesValidados
      }
    };
  });

  try {
    return ejecutarTransaccion();
  } catch (error) {
    return { ok: false, mensaje: error.message || 'No se pudo registrar la devolución.' };
  }
}

module.exports = {
  buscarVentasParaDevolucion,
  obtenerDetalleVentaDevolucion,
  registrarDevolucion
};