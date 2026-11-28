const db = require('./db/conexion');

const TASA_IVA = 0; // Cambia a 0.16 si deseas aplicar 16% de IVA en lugar de 0%

/**
 * Lista los productos activos para mostrarlos en la rejilla de venta_operador.html.
 */
function listarProductosParaVenta(busqueda = '') {
  const texto = String(busqueda || '').trim();

  const filas = texto
    ? db
        .prepare(
          `SELECT
             id,
             codigo_consulta,
             nombre,
             precio,
             cantidad,
             CASE WHEN imagen IS NOT NULL THEN 1 ELSE 0 END AS tiene_imagen
           FROM PRODUCTOS
           WHERE LOWER(estado) = 'activo'
             AND (LOWER(nombre) LIKE LOWER(?) OR LOWER(codigo_consulta) LIKE LOWER(?))
           ORDER BY nombre ASC`
        )
        .all(`%${texto}%`, `%${texto}%`)
    : db
        .prepare(
          `SELECT
             id,
             codigo_consulta,
             nombre,
             precio,
             cantidad,
             CASE WHEN imagen IS NOT NULL THEN 1 ELSE 0 END AS tiene_imagen
           FROM PRODUCTOS
           WHERE LOWER(estado) = 'activo'
           ORDER BY nombre ASC`
        )
        .all();

  return filas.map((f) => ({
    id: f.id,
    codigo_consulta: f.codigo_consulta,
    nombre: f.nombre,
    precio: Number(f.precio || 0),
    cantidad: Number(f.cantidad || 0),
    tieneImagen: Boolean(f.tiene_imagen)
  }));
}

/**
 * Busca un producto activo por código exacto (ideal para lector de código de barras / QR).
 */
function buscarProductoPorCodigo(codigo) {
  const codigoLimpio = String(codigo || '').trim();
  if (!codigoLimpio) return null;

  const fila = db
    .prepare(
      `SELECT
         id,
         codigo_consulta,
         nombre,
         precio,
         cantidad,
         CASE WHEN imagen IS NOT NULL THEN 1 ELSE 0 END AS tiene_imagen
       FROM PRODUCTOS
       WHERE LOWER(estado) = 'activo'
         AND LOWER(codigo_consulta) = LOWER(?)`
    )
    .get(codigoLimpio);

  if (!fila) return null;

  return {
    id: fila.id,
    codigo_consulta: fila.codigo_consulta,
    nombre: fila.nombre,
    precio: Number(fila.precio || 0),
    cantidad: Number(fila.cantidad || 0),
    tieneImagen: Boolean(fila.tiene_imagen)
  };
}

/**
 * Registra la venta en VENTAS, guarda cada renglón en DETALLE_VENTAS
 * y descuenta el inventario en PRODUCTOS de forma atómica.
 */
function registrarVenta({ usuarioId, items }) {
  const idOperador = Number(usuarioId);
  if (!Number.isInteger(idOperador) || idOperador <= 0) {
    return { ok: false, mensaje: 'Sesión de operador no válida. Vuelve a iniciar sesión.' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, mensaje: 'Agrega al menos un producto a la venta.' };
  }

  // Agrupar por producto_id por si viene repetido
  const mapaItems = new Map();
  for (const item of items) {
    const prodId = Number(item.productoId);
    const cant = Number(item.cantidad);
    if (!Number.isInteger(prodId) || prodId <= 0 || !Number.isInteger(cant) || cant <= 0) {
      return { ok: false, mensaje: 'Cantidad o producto inválido en el carrito.' };
    }
    mapaItems.set(prodId, (mapaItems.get(prodId) || 0) + cant);
  }

  const ejecutarTransaccion = db.transaction(() => {
    const operador = db
      .prepare('SELECT id, usuario, nombre_completo FROM USUARIOS WHERE id = ? AND activo = 1')
      .get(idOperador);

    if (!operador) {
      throw new Error('El usuario operador no existe o está inactivo.');
    }

    const stmtProducto = db.prepare(
      'SELECT id, codigo_consulta, nombre, precio, cantidad, estado FROM PRODUCTOS WHERE id = ?'
    );

    const renglonesValidados = [];
    let subtotal = 0;

    for (const [prodId, cantidadSolicitada] of mapaItems.entries()) {
      const prod = stmtProducto.get(prodId);
      if (!prod || String(prod.estado).toLowerCase() !== 'activo') {
        throw new Error(`El producto con ID ${prodId} ya no está disponible.`);
      }
      if (prod.cantidad < cantidadSolicitada) {
        throw new Error(
          `Stock insuficiente para "${prod.nombre}". Disponibles: ${prod.cantidad}, solicitados: ${cantidadSolicitada}.`
        );
      }

      const precioUnitario = Number(prod.precio);
      const importe = Number((precioUnitario * cantidadSolicitada).toFixed(2));
      subtotal = Number((subtotal + importe).toFixed(2));

      renglonesValidados.push({
        producto_id: prod.id,
        codigo_consulta: prod.codigo_consulta,
        nombre: prod.nombre,
        cantidad: cantidadSolicitada,
        precio_unitario: precioUnitario,
        importe
      });
    }

    const iva = Number((subtotal * TASA_IVA).toFixed(2));
    const total = Number((subtotal + iva).toFixed(2));

    // 1. Insertar encabezado en VENTAS
    const infoVenta = db
      .prepare(
        `INSERT INTO VENTAS (usuario_id, subtotal, iva, total)
         VALUES (?, ?, ?, ?)`
      )
      .run(idOperador, subtotal, iva, total);

    const folio = Number(infoVenta.lastInsertRowid);

    // 2. Insertar detalles y descontar stock
    const stmtDetalle = db.prepare(
      `INSERT INTO DETALLE_VENTAS (venta_folio, producto_id, cantidad, precio_unitario, importe)
       VALUES (?, ?, ?, ?, ?)`
    );
    const stmtDescontarStock = db.prepare(
      `UPDATE PRODUCTOS
       SET cantidad = cantidad - ?
       WHERE id = ?`
    );

    for (const r of renglonesValidados) {
      stmtDetalle.run(folio, r.producto_id, r.cantidad, r.precio_unitario, r.importe);
      stmtDescontarStock.run(r.cantidad, r.producto_id);
    }

    const ventaGuardada = db
      .prepare('SELECT folio, fecha_hora, subtotal, iva, total FROM VENTAS WHERE folio = ?')
      .get(folio);

    return {
      ok: true,
      mensaje: `Venta V-${String(folio).padStart(4, '0')} registrada correctamente.`,
      tasaIva: Math.round(TASA_IVA * 100),
      venta: {
        folio: ventaGuardada.folio,
        folioFormateado: `V-${String(ventaGuardada.folio).padStart(4, '0')}`,
        fecha_hora: ventaGuardada.fecha_hora,
        cajero: operador.nombre_completo,
        usuario: operador.usuario,
        subtotal: Number(ventaGuardada.subtotal),
        iva: Number(ventaGuardada.iva),
        total: Number(ventaGuardada.total),
        items: renglonesValidados
      }
    };
  });

  try {
    return ejecutarTransaccion();
  } catch (error) {
    return { ok: false, mensaje: error.message || 'No se pudo completar la venta.' };
  }
}

module.exports = {
  listarProductosParaVenta,
  buscarProductoPorCodigo,
  registrarVenta
};