const bcrypt = require('bcryptjs');
const db = require('./db/conexion');

/**
 * Lista todos los usuarios activos en SQLite para mostrarlos en usuario.html.
 */
function listarUsuarios() {
  return db
    .prepare(
      `SELECT id, usuario, nombre_completo, rol, activo
       FROM USUARIOS
       WHERE activo = 1
       ORDER BY id ASC`
    )
    .all();
}

/**
 * Crea un nuevo usuario operador con contraseña encriptada (compatible con login.js).
 */
function crearUsuario(datos = {}) {
  const usuario = String(datos.usuario || '').trim();
  const password = String(datos.password || '');

  if (!usuario) {
    return { ok: false, mensaje: 'Ingresa el nombre de usuario.', campo: 'usuario' };
  }
  if (usuario.length < 3) {
    return { ok: false, mensaje: 'El usuario debe tener al menos 3 caracteres.', campo: 'usuario' };
  }
  if (!password || password.length < 4) {
    return { ok: false, mensaje: 'La contraseña debe tener al menos 4 caracteres.', campo: 'password' };
  }

  // Verificar si ya existe un usuario con ese nombre
  const existente = db
    .prepare('SELECT id, activo FROM USUARIOS WHERE LOWER(usuario) = LOWER(?)')
    .get(usuario);

  if (existente && existente.activo === 1) {
    return { ok: false, mensaje: 'Ese nombre de usuario ya está registrado.', campo: 'usuario' };
  }

  const hash = bcrypt.hashSync(password, 10);

  // Si existía desactivado (activo = 0), lo reactivamos con la nueva contraseña
  if (existente && existente.activo === 0) {
    db.prepare(
      `UPDATE USUARIOS
       SET usuario = ?, password = ?, nombre_completo = ?, rol = 'operador', activo = 1
       WHERE id = ?`
    ).run(usuario, hash, usuario, existente.id);

    return { ok: true, id: existente.id, mensaje: 'Usuario registrado correctamente.' };
  }

  const resultado = db
    .prepare(
      `INSERT INTO USUARIOS (usuario, password, nombre_completo, rol, activo)
       VALUES (?, ?, ?, 'operador', 1)`
    )
    .run(usuario, hash, usuario);

  return {
    ok: true,
    id: Number(resultado.lastInsertRowid),
    mensaje: 'Usuario registrado correctamente.'
  };
}

/**
 * Actualiza el nombre de usuario y/o contraseña de un usuario existente.
 */
function actualizarUsuario(id, datos = {}) {
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return { ok: false, mensaje: 'Usuario no válido.' };
  }

  const actual = db.prepare('SELECT id, usuario FROM USUARIOS WHERE id = ? AND activo = 1').get(usuarioId);
  if (!actual) {
    return { ok: false, mensaje: 'El usuario no existe.' };
  }

  const usuario = String(datos.usuario || '').trim();
  const password = String(datos.password || '');

  if (!usuario || usuario.length < 3) {
    return { ok: false, mensaje: 'El usuario debe tener al menos 3 caracteres.', campo: 'usuario' };
  }

  const repetido = db
    .prepare('SELECT id FROM USUARIOS WHERE LOWER(usuario) = LOWER(?) AND id != ?')
    .get(usuario, usuarioId);
  if (repetido) {
    return { ok: false, mensaje: 'Ya existe otro usuario con ese nombre.', campo: 'usuario' };
  }

  if (password) {
    if (password.length < 4) {
      return { ok: false, mensaje: 'La nueva contraseña debe tener al menos 4 caracteres.', campo: 'password' };
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      `UPDATE USUARIOS
       SET usuario = ?, password = ?, nombre_completo = CASE WHEN nombre_completo = ? THEN ? ELSE nombre_completo END
       WHERE id = ?`
    ).run(usuario, hash, actual.usuario, usuario, usuarioId);
  } else {
    db.prepare(
      `UPDATE USUARIOS
       SET usuario = ?, nombre_completo = CASE WHEN nombre_completo = ? THEN ? ELSE nombre_completo END
       WHERE id = ?`
    ).run(usuario, actual.usuario, usuario, usuarioId);
  }

  return { ok: true, id: usuarioId, mensaje: 'Usuario actualizado correctamente.' };
}

/**
 * Elimina un usuario (o lo desactiva si ya tiene ventas/compras registradas en SQLite).
 */
function eliminarUsuario(id) {
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return { ok: false, mensaje: 'Usuario no válido.' };
  }

  const actual = db.prepare('SELECT id, usuario, rol FROM USUARIOS WHERE id = ? AND activo = 1').get(usuarioId);
  if (!actual) {
    return { ok: false, mensaje: 'El usuario no existe.' };
  }

  if (actual.usuario === 'admin') {
    return { ok: false, mensaje: 'No se puede eliminar la cuenta principal del administrador.' };
  }

  // Verificar si tiene registros asociados en VENTAS, COMPRAS o DEVOLUCIONES
  const tieneMovimientos = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM VENTAS WHERE usuario_id = ?) +
         (SELECT COUNT(*) FROM COMPRAS WHERE usuario_id = ?) +
         (SELECT COUNT(*) FROM DEVOLUCIONES WHERE usuario_id = ?) AS total`
    )
    .get(usuarioId, usuarioId, usuarioId);

  if (tieneMovimientos && tieneMovimientos.total > 0) {
    db.prepare('UPDATE USUARIOS SET activo = 0 WHERE id = ?').run(usuarioId);
    return { ok: true, mensaje: 'Usuario desactivado (conserva su historial de operaciones).' };
  }

  db.prepare('DELETE FROM USUARIOS WHERE id = ?').run(usuarioId);
  return { ok: true, mensaje: 'Usuario eliminado correctamente.' };
}

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
};