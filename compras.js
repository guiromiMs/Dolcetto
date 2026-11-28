const db = require('./db/conexion');

const MAX_LINEAS = 100; // productos distintos por compra
const MAX_CANTIDAD = 1000000; // piezas por linea
const MAX_COSTO = 100000; // costo unitario maximo

// El error lleva el codigo HTTP que debe responder el servidor (400 por omision)
function error(mensaje, campo, status) {
  return { ok: false, mensaje, campo: campo || null, status: status || 400 };
}

function formatoFolio(folio) {
  return 'C-' + String(folio).padStart(6, '0');
}

// Para que LIKE trate %, _ y \ como texto normal y no como comodines
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/**
 * Folio que recibira la SIGUIENTE compra. Solo sirve para mostrarlo en pantalla:
 * el folio real lo asigna SQLite (AUTOINCREMENT) al guardar. Nunca lo escribe el usuario.
 */
function siguienteFolio() {
  let ultimo = 0;
  try {
    const fila = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'COMPRAS'").get();
    ultimo = fila ? fila.seq : 0;
  } catch (e) {
    ultimo = db.prepare('SELECT COALESCE(MAX(folio), 0) AS ultimo FROM COMPRAS').get().ultimo;
  }
  const folio = ultimo + 1;
  return { ok: true, folio, folio_texto: formatoFolio(folio) };
}

// Campos que necesita la pantalla; ultimo_costo = costo de la compra mas reciente de ese producto
const CAMPOS_PRODUCTO = `
  id, codigo_consulta AS codigo, nombre, precio, cantidad AS existencia, estado,
  (SELECT d.costo_unitario FROM DETALLE_COMPRAS d
    WHERE d.producto_id = PRODUCTOS.id ORDER BY d.id DESC LIMIT 1) AS ultimo_costo`;

/**
 * Busca un producto por su codigo exacto (lo que escribe o escanea el lector).
 */
function buscarProductoPorCodigo(codigo) {
  const texto = String(codigo || '').trim();
  if (!texto) return error('Escribe o escanea un código.', 'codigo');

  const producto = db
    .prepare(`SELECT ${CAMPOS_PRODUCTO} FROM PRODUCTOS WHERE codigo_consulta = ?`)
    .get(texto);

  if (!producto) return error(`No existe ningún producto con el código ${texto}.`, 'codigo', 404);
  if (producto.estado !== 'activo') {
    return error(`El producto "${producto.nombre}" está inactivo.`, 'codigo', 409);
  }
  return { ok: true, producto };
}


function buscarProductos(busqueda) {
  const texto = String(busqueda || '').trim();
  if (!texto) return { ok: true, productos: [] };

  const patron = `%${escaparLike(texto)}%`;
  const productos = db
    .prepare(
      `SELECT ${CAMPOS_PRODUCTO}
       FROM PRODUCTOS
       WHERE estado = 'activo'
         AND (nombre LIKE ? ESCAPE '\\' OR codigo_consulta LIKE ? ESCAPE '\\')
       ORDER BY nombre
       LIMIT 8`
    )
    .all(patron, patron);

  return { ok: true, productos };
}

function registrarCompra(datos) {
  datos = datos || {};

  // responsable: debe existir, estar activo y ser administrador
  const usuarioId = Number(datos.usuario_id);
  const usuario = Number.isInteger(usuarioId)
    ? db.prepare('SELECT id, rol, activo FROM USUARIOS WHERE id = ?').get(usuarioId)
    : undefined;
  if (!usuario || !usuario.activo) {
    return error('Tu sesión no es válida. Vuelve a iniciar sesión.', null, 401);
  }
  if (usuario.rol !== 'admin') {
    return error('Solo el administrador puede registrar compras.', null, 403);
  }

  //proveedor
  const proveedor = String(datos.proveedor || '').trim();
  if (!proveedor) return error('Ingresa el proveedor.', 'proveedor');
  if (proveedor.length > 50) {
    return error('El proveedor no puede tener más de 50 caracteres.', 'proveedor');
  }

  //Los importes y el total se calculan AQUI (en centavos, para evitar errores de decimales)
  const entrada = Array.isArray(datos.lineas) ? datos.lineas : [];
  if (entrada.length === 0) return error('Agrega al menos un producto a la compra.', 'lineas');
  if (entrada.length > MAX_LINEAS) {
    return error(`Una compra no puede tener más de ${MAX_LINEAS} productos.`, 'lineas');
  }

  const lineas = [];
  let totalCentavos = 0;
  for (let i = 0; i < entrada.length; i++) {
    const l = entrada[i] || {};
    const productoId = Number(l.producto_id);
    const cantidad = Number(l.cantidad);
    const costo = Number(l.costo_unitario);

    const producto = Number.isInteger(productoId)
      ? db.prepare('SELECT id, nombre, estado FROM PRODUCTOS WHERE id = ?').get(productoId)
      : undefined;
    if (!producto) return error(`La línea ${i + 1} tiene un producto que no existe.`, 'lineas');
    if (producto.estado !== 'activo') {
      return error(`El producto "${producto.nombre}" está inactivo.`, 'lineas');
    }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
      return error(`La cantidad de "${producto.nombre}" debe ser un entero entre 1 y 1,000,000.`, 'lineas');
    }
    const costoCentavos = Math.round(costo * 100);
    if (!Number.isFinite(costo) || costoCentavos < 1 || costo > MAX_COSTO) {
      return error(`El costo unitario de "${producto.nombre}" debe estar entre 0.01 y 100,000.`, 'lineas');
    }

    const importeCentavos = cantidad * costoCentavos;
    totalCentavos += importeCentavos;
    lineas.push({ productoId, cantidad, costoCentavos, importeCentavos });
  }

  // guardar
  const guardar = db.transaction(() => {
    const compra = db
      .prepare('INSERT INTO COMPRAS (proveedor, usuario_id, total) VALUES (?, ?, ?)')
      .run(proveedor, usuario.id, totalCentavos / 100);
    const folio = Number(compra.lastInsertRowid);

    const insertarDetalle = db.prepare(
      `INSERT INTO DETALLE_COMPRAS (compra_folio, producto_id, cantidad, costo_unitario, importe)
       VALUES (?, ?, ?, ?, ?)`
    );
    const sumarExistencia = db.prepare('UPDATE PRODUCTOS SET cantidad = cantidad + ? WHERE id = ?');

    for (const l of lineas) {
      insertarDetalle.run(folio, l.productoId, l.cantidad, l.costoCentavos / 100, l.importeCentavos / 100);
      const r = sumarExistencia.run(l.cantidad, l.productoId);
      if (r.changes !== 1) {
        // Lanzar el error hace que la transaccion se revierta completa
        throw new Error('No se pudo actualizar la existencia del producto ' + l.productoId);
      }
    }
    return folio;
  });

  const folio = guardar();
  const guardada = db.prepare('SELECT fecha_hora, total FROM COMPRAS WHERE folio = ?').get(folio);

  return {
    ok: true,
    folio,
    folio_texto: formatoFolio(folio),
    fecha_hora: guardada.fecha_hora,
    total: guardada.total,
    partidas: lineas.length,
    unidades: lineas.reduce((suma, l) => suma + l.cantidad, 0),
    mensaje: 'Compra registrada.'
  };
}

// historial compra

const POR_PAGINA = 10; // compras por pagina en el historial

// "2026-02-30" tiene el formato correcto pero no existe: por eso tambien se comprueba con Date
function esFechaValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

// "C-000012", "12" y "000012" son el mismo folio. Devuelve null si no hay ningun digito.
function leerFolio(texto) {
  const digitos = String(texto).replace(/\D/g, '');
  if (!digitos || digitos.length > 9) return null;
  return Number(digitos);
}


// Lista las compras con filtros y paginacion
function listarCompras(filtros) {
  filtros = filtros || {};

  // El WHERE se arma solo con texto fijo; los valores del usuario van siempre como parametros (?)
  const condiciones = [];
  const parametros = [];

  const folioTexto = String(filtros.folio || '').trim();
  if (folioTexto) {
    const folio = leerFolio(folioTexto);
    if (folio === null) return error('Escribe un folio válido, por ejemplo C-000002.', 'folio');
    condiciones.push('c.folio = ?');
    parametros.push(folio);
  }

  const inicial = String(filtros.fecha_inicial || '').trim();
  const final = String(filtros.fecha_final || '').trim();
  if (inicial && !esFechaValida(inicial)) return error('La fecha inicial no es válida.', 'fecha_inicial');
  if (final && !esFechaValida(final)) return error('La fecha final no es válida.', 'fecha_final');
  if (inicial && final && inicial > final) {
    return error('La fecha inicial no puede ser posterior a la fecha final.', 'fecha_inicial');
  }
  // Se compara el texto completo (AAAA-MM-DD HH:MM) para que SQLite pueda usar el indice de fecha
  if (inicial) {
    condiciones.push('c.fecha_hora >= ?');
    parametros.push(inicial + ' 00:00');
  }
  if (final) {
    condiciones.push('c.fecha_hora <= ?');
    parametros.push(final + ' 23:59:59');
  }

  const proveedor = String(filtros.proveedor || '').trim();
  if (proveedor) {
    condiciones.push('c.proveedor = ? COLLATE NOCASE');
    parametros.push(proveedor);
  }

  const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

  // Cantidad y suma de TODAS las compras que cumplen los filtros (no solo las de la pagina)
  const resumen = db
    .prepare(`SELECT COUNT(*) AS total, COALESCE(ROUND(SUM(c.total), 2), 0) AS suma FROM COMPRAS c ${where}`)
    .get(...parametros);
  const total = Number(resumen.total);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  let pagina = parseInt(filtros.pagina, 10);
  if (!Number.isInteger(pagina) || pagina < 1) pagina = 1;
  if (pagina > totalPaginas) pagina = totalPaginas;
  // Articulos = piezas compradas (suma de las cantidades del detalle)
  const filas = db
    .prepare(
      `SELECT c.folio, c.fecha_hora, c.proveedor, c.total,
              COALESCE(u.usuario, '-') AS responsable,
              COALESCE((SELECT SUM(d.cantidad) FROM DETALLE_COMPRAS d WHERE d.compra_folio = c.folio), 0) AS articulos
       FROM COMPRAS c
       LEFT JOIN USUARIOS u ON u.id = c.usuario_id
       ${where}
       ORDER BY c.folio DESC
       LIMIT ? OFFSET ?`
    )
    .all(...parametros, POR_PAGINA, (pagina - 1) * POR_PAGINA);

  return {
    ok: true,
    compras: filas.map((f) => ({
      folio: f.folio,
      folio_texto: formatoFolio(f.folio),
      fecha_hora: f.fecha_hora,
      proveedor: f.proveedor,
      responsable: f.responsable,
      articulos: Number(f.articulos),
      total: f.total,
      estado: 'Confirmada' // COMPRAS no tiene estado: toda compra guardada ya esta confirmada
    })),
    total,
    total_comprado: Number(resumen.suma),
    pagina,
    porPagina: POR_PAGINA,
    totalPaginas
  };
}
 //Proveedores distintos que ya aparecen en alguna compra (para el filtro)
 
function listarProveedores() {
  const filas = db
    .prepare('SELECT proveedor FROM COMPRAS GROUP BY proveedor COLLATE NOCASE ORDER BY proveedor COLLATE NOCASE')
    .all();
  return { ok: true, proveedores: filas.map((f) => f.proveedor) };
}


function obtenerDetalleCompra(folio) {
  const numero = Number(folio);
  if (!Number.isInteger(numero) || numero < 1) return error('Folio no válido', 'folio', 404);

  const compra = db
    .prepare(
      `SELECT c.folio, c.fecha_hora, c.proveedor, c.total, COALESCE(u.usuario, '-') AS responsable
       FROM COMPRAS c
       LEFT JOIN USUARIOS u ON u.id = c.usuario_id
       WHERE c.folio = ?`
    )
    .get(numero);
  if (!compra) return error('La compra no existe.', 'folio', 404);

  const lineas = db
    .prepare(
      `SELECT d.producto_id, p.codigo_consulta AS codigo, p.nombre, d.cantidad, d.costo_unitario, d.importe
       FROM DETALLE_COMPRAS d
       JOIN PRODUCTOS p ON p.id = d.producto_id
       WHERE d.compra_folio = ?
       ORDER BY d.id`
    )
    .all(numero);

  return {
    ok: true,
    compra: {
      folio: compra.folio,
      folio_texto: formatoFolio(compra.folio),
      fecha_hora: compra.fecha_hora,
      proveedor: compra.proveedor,
      responsable: compra.responsable,
      total: compra.total,
      articulos: lineas.reduce((suma, l) => suma + l.cantidad, 0)
    },
    lineas: lineas.map((l) => ({
      producto_id: l.producto_id,
      codigo: l.codigo,
      nombre: l.nombre,
      cantidad: l.cantidad,
      costo_unitario: l.costo_unitario,
      importe: l.importe
    }))
  };
}

module.exports = {
  registrarCompra,
  buscarProductoPorCodigo,
  buscarProductos,
  siguienteFolio,
  formatoFolio,
  listarCompras,
  listarProveedores,
  obtenerDetalleCompra
};