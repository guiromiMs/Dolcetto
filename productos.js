const db = require('./db/conexion');
const ESTADOS_VALIDOS = ['activo', 'inactivo'];
const POR_PAGINA = 10;
const UMBRAL_EXISTENCIA_BAJA = 5;

/**
 * Detecta el tipo real de la imagen leyendo sus primeros bytes.
 * No se confía en el tipo que declara el navegador, porque se puede falsificar.
 * @param {Buffer} buffer
 * @returns {'image/jpeg' | 'image/png' | null}
 */
function detectarTipoImagen(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(firmaPng)) {
    return 'image/png';
  }
  return null;
}

function error(mensaje, campo) {
  return { ok: false, mensaje, campo: campo || null };
}

/**
 * Valida y guarda un producto nuevo (con su imagen) en SQLite.
 * @param {object} datos   Campos de texto del formulario: codigo, nombre, precio, estado, descripcion
 * @param {object} archivo Archivo de multer (req.file) con .buffer
 */
function crearProducto(datos, archivo) {
  const codigo = String(datos.codigo || '').trim();
  const nombre = String(datos.nombre || '').trim();
  const descripcion = String(datos.descripcion || '').trim();
  const estado = String(datos.estado || '').trim().toLowerCase();
  const precio = Number(String(datos.precio || '').trim());

  // Validaciones
  if (!codigo) return error('Ingresa el código de barras / QR.', 'codigo');
  if (codigo.length > 50) return error('El código no puede tener más de 50 caracteres.', 'codigo');
  if (!nombre) return error('Ingresa el nombre del producto.', 'nombre');
  if (!Number.isFinite(precio) || precio <= 0) {
    return error('El precio debe ser un número mayor a 0.', 'precio');
  }
  if (!ESTADOS_VALIDOS.includes(estado)) return error('Selecciona un estado válido.', 'estado');
  if (!archivo) return error('Selecciona una imagen del producto.', 'imagen');

  const tipoImagen = detectarTipoImagen(archivo.buffer);
  if (!tipoImagen) return error('La imagen debe ser JPG o PNG.', 'imagen');

  // El código de barras no puede repetirse
  const existente = db.prepare('SELECT id FROM PRODUCTOS WHERE codigo_consulta = ?').get(codigo);
  if (existente) return error('Ya existe un producto con ese código.', 'codigo');

  //Guardar. El producto nace con existencia 0
  try {
    const resultado = db
      .prepare(
        `INSERT INTO PRODUCTOS
           (codigo_consulta, nombre, descripcion, precio, cantidad, estado, imagen, imagen_mime)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(codigo, nombre, descripcion, Math.round(precio * 100) / 100, estado, archivo.buffer, tipoImagen);

    return { ok: true, id: Number(resultado.lastInsertRowid), mensaje: 'Producto guardado.' };
  } catch (e) {
    // Por si dos personas guardan el mismo código casi al mismo tiempo
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return error('Ya existe un producto con ese código.', 'codigo');
    }
    throw e;
  }
}

/**
 * Devuelve la imagen BLOB y su tipo, o undefined si el producto no existe.
 */
function obtenerImagen(id) {
  return db.prepare('SELECT imagen, imagen_mime FROM PRODUCTOS WHERE id = ?').get(id);
}

function listarProductos(filtros = {}) {
  const busqueda = String(filtros.busqueda || '').trim();
  const estado = String(filtros.estado || '').trim().toLowerCase();
  const existencia = String(filtros.existencia || '').trim().toLowerCase();
  let paginaSolicitada = Number.parseInt(filtros.pagina, 10);
  if (!Number.isFinite(paginaSolicitada) || paginaSolicitada < 1) {
    paginaSolicitada = 1;
  }

  const condiciones = [];
  const parametros = [];

  if (busqueda) {
    condiciones.push('(codigo_consulta LIKE ? OR nombre LIKE ?)');
    const patron = `%${busqueda}%`;
    parametros.push(patron, patron);
  }

  if (ESTADOS_VALIDOS.includes(estado)) {
    condiciones.push('LOWER(estado) = ?');
    parametros.push(estado);
  }

  if (existencia === 'bajo') {
    condiciones.push('cantidad > 0 AND cantidad <= ?');
    parametros.push(UMBRAL_EXISTENCIA_BAJA);
  } else if (existencia === 'agotado') {
    condiciones.push('cantidad <= 0');
  }

  const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const filaTotal = db
    .prepare(`SELECT COUNT(*) AS total FROM PRODUCTOS ${whereSql}`)
    .get(...parametros);

  const total = Number(filaTotal ? filaTotal.total : 0);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(paginaSolicitada, totalPaginas);
  const offset = (pagina - 1) * POR_PAGINA;

  const filas = db
    .prepare(
      `SELECT
         id,
         codigo_consulta,
         nombre,
         precio,
         cantidad,
         estado,
         CASE WHEN imagen IS NOT NULL AND LENGTH(imagen) > 0 THEN 1 ELSE 0 END AS tiene_imagen
       FROM PRODUCTOS
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...parametros, POR_PAGINA, offset);

  const productos = filas.map((fila) => {
    const cantidad = Number(fila.cantidad || 0);
    return {
      id: fila.id,
      codigo: fila.codigo_consulta,
      nombre: fila.nombre,
      precio: Number(fila.precio || 0),
      cantidad,
      estado: String(fila.estado || '').toLowerCase(),
      tiene_imagen: Boolean(fila.tiene_imagen),
      existencia_baja: cantidad > 0 && cantidad <= UMBRAL_EXISTENCIA_BAJA
    };
  });

  return {
    productos,
    pagina,
    porPagina: POR_PAGINA,
    total,
    totalPaginas
  };
}

function obtenerProductoPorId(id) {
  const numeroId = Number(id);
  if (!Number.isInteger(numeroId) || numeroId <= 0) return null;

  const fila = db
    .prepare(
      `SELECT
         id,
         codigo_consulta,
         nombre,
         descripcion,
         precio,
         cantidad,
         estado,
         CASE WHEN imagen IS NOT NULL AND LENGTH(imagen) > 0 THEN 1 ELSE 0 END AS tiene_imagen
       FROM PRODUCTOS
       WHERE id = ?`
    )
    .get(numeroId);

  if (!fila) return null;

  return {
    id: fila.id,
    codigo: fila.codigo_consulta,
    nombre: fila.nombre,
    descripcion: fila.descripcion || '',
    precio: Number(fila.precio || 0),
    cantidad: Number(fila.cantidad || 0),
    estado: String(fila.estado || 'activo').toLowerCase(),
    tiene_imagen: Boolean(fila.tiene_imagen)
  };
}

function actualizarProducto(id, datos, archivo) {
  const numeroId = Number(id);
  if (!Number.isInteger(numeroId) || numeroId <= 0) {
    return error('Producto no válido.');
  }

  const actual = db.prepare('SELECT id FROM PRODUCTOS WHERE id = ?').get(numeroId);
  if (!actual) return error('El producto no existe.');

  const codigo = String(datos.codigo || '').trim();
  const nombre = String(datos.nombre || '').trim();
  const descripcion = String(datos.descripcion || '').trim();
  const estado = String(datos.estado || '').trim().toLowerCase();
  const precio = Number(String(datos.precio || '').trim());

  if (!codigo) return error('Ingresa el código de barras / QR.', 'codigo');
  if (codigo.length > 50) return error('El código no puede tener más de 50 caracteres.', 'codigo');
  if (!nombre) return error('Ingresa el nombre del producto.', 'nombre');
  if (!Number.isFinite(precio) || precio <= 0) {
    return error('El precio debe ser un número mayor a 0.', 'precio');
  }
  if (!ESTADOS_VALIDOS.includes(estado)) return error('Selecciona un estado válido.', 'estado');

  const repetido = db
    .prepare('SELECT id FROM PRODUCTOS WHERE codigo_consulta = ? AND id != ?')
    .get(codigo, numeroId);
  if (repetido) return error('Ya existe otro producto con ese código.', 'codigo');

  let tipoImagen = null;
  if (archivo) {
    tipoImagen = detectarTipoImagen(archivo.buffer);
    if (!tipoImagen) return error('La imagen debe ser JPG o PNG.', 'imagen');
  }

  try {
    const precioRedondeado = Math.round(precio * 100) / 100;

    if (archivo && tipoImagen) {
      db.prepare(
        `UPDATE PRODUCTOS
         SET codigo_consulta = ?, nombre = ?, descripcion = ?, precio = ?, estado = ?, imagen = ?, imagen_mime = ?
         WHERE id = ?`
      ).run(codigo, nombre, descripcion, precioRedondeado, estado, archivo.buffer, tipoImagen, numeroId);
    } else {
      db.prepare(
        `UPDATE PRODUCTOS
         SET codigo_consulta = ?, nombre = ?, descripcion = ?, precio = ?, estado = ?
         WHERE id = ?`
      ).run(codigo, nombre, descripcion, precioRedondeado, estado, numeroId);
    }

    return { ok: true, id: numeroId, mensaje: 'Producto actualizado.' };
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return error('Ya existe otro producto con ese código.', 'codigo');
    }
    throw e;
  }
}
module.exports = { crearProducto, obtenerImagen, detectarTipoImagen, listarProductos,obtenerProductoPorId, actualizarProducto };