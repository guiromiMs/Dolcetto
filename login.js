const bcrypt = require('bcryptjs');
const db = require('./db/conexion');


//Valida si el usuario existe, está activo y su contraseña coincide.
function validarInicioSesion(usuarioInput, passwordInput) {
  const usuarioLimpio = String(usuarioInput || '').trim();
  const passwordLimpio = String(passwordInput || '');

  if (!usuarioLimpio || !passwordLimpio) {
    return { ok: false, mensaje: 'Ingresa usuario y contraseña.' };
  }

  // consulta ejemplo gabi fijate
  const filaUsuario = db
    .prepare(
      `SELECT id, usuario, password, nombre_completo, rol, activo
       FROM USUARIOS
       WHERE usuario = ? AND activo = 1`
    )
    .get(usuarioLimpio);
  if (!filaUsuario) {
    return { ok: false, mensaje: 'Usuario o contraseña incorrectos.' };
  }
  // comparar lo que escribio el usuario y lo que esta en la base de datos
  const coincide = bcrypt.compareSync(passwordLimpio, filaUsuario.password);
  if (!coincide) {
    return { ok: false, mensaje: 'Usuario o contraseña incorrectos.' };
  }
  // devuelve los datos del usuario
  return {
    ok: true,
    usuario: {
      id: filaUsuario.id,
      usuario: filaUsuario.usuario,
      nombre_completo: filaUsuario.nombre_completo,
      rol: filaUsuario.rol
    }
  };
}
module.exports = { validarInicioSesion };