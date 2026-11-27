const db = require('./db/conexion');

const ESTADOS_VALIDOS = ['activo', 'inactivo'];

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

  // 1. Validaciones (el backend es quien decide; el frontend solo muestra el mensaje)
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

  // 2. El código de barras no puede repetirse
  const existente = db.prepare('SELECT id FROM PRODUCTOS WHERE codigo_consulta = ?').get(codigo);
  if (existente) return error('Ya existe un producto con ese código.', 'codigo');

  // 3. Guardar. El producto nace con existencia 0: el stock sube al registrar una compra.
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

module.exports = { crearProducto, obtenerImagen, detectarTipoImagen };