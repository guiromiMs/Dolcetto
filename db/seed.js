const bcrypt = require('bcryptjs');
const db = require('./conexion');

const cargarDatosPrueba = db.transaction(() => {
  // 1. Datos del negocio para tickets y reportes
  db.prepare(`
    INSERT OR IGNORE INTO CONFIGURACION_NEGOCIO
      (id, nombre_comercial, rfc, domicilio, telefono, mensaje_pie, politica_devolucion)
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `).run(
    'Dolcetto Repostería',
    'DOL260101ABC',
    'Av. Principal #120, Col. Centro',
    '669-123-4567',
    '¡Gracias por su preferencia!',
    'Cambios y devoluciones únicamente el mismo día con ticket original.'
  );

  // 2. Usuarios con contraseña hasheada (admin123 y operador123)
  const hashAdmin = bcrypt.hashSync('admin123', 10);
  const hashOperador = bcrypt.hashSync('operador123', 10);

  const insertarUsuario = db.prepare(`
    INSERT OR IGNORE INTO USUARIOS (usuario, password, nombre_completo, rol, activo)
    VALUES (?, ?, ?, ?, 1)
  `);
  insertarUsuario.run('admin', hashAdmin, 'Administrador General', 'admin');
  insertarUsuario.run('cajero1', hashOperador, 'Operador de Caja 1', 'operador');

  // 3. Productos iniciales (cambia códigos por los códigos de barras reales que vayan a escanear)
  const insertarProducto = db.prepare(`
    INSERT OR IGNORE INTO PRODUCTOS
      (codigo_consulta, nombre, descripcion, precio, cantidad, estado)
    VALUES (?, ?, ?, ?, ?, 'activo')
  `);

  const productos = [
    ['7501000000011', 'Pastel Tres Leches Rebanada', 'Bizcocho de vainilla con tres leches y crema', 55.00, 20],
    ['7501000000028', 'Cheesecake de Frutos Rojos', 'Rebanada individual con mermelada artesanal', 65.00, 15],
    ['7501000000035', 'Croissant de Mantequilla', 'Horneado del día', 32.00, 30],
    ['7501000000042', 'Café Americano 12 oz', 'Grano tostado medio', 38.00, 50],
    ['7501000000059', 'Capuchino Clásico 12 oz', 'Espresso con leche vaporizada', 52.00, 40],
    ['7501000000066', 'Brownie de Chocolate', 'Porción con nuez', 42.00, 25]
  ];

  for (const p of productos) {
    insertarProducto.run(...p);
  }

  const usuarioAdmin = db.prepare('SELECT id FROM USUARIOS WHERE usuario = ?').get('admin');
  const usuarioOperador = db.prepare('SELECT id FROM USUARIOS WHERE usuario = ?').get('cajero1');
  const productoPastel = db.prepare('SELECT id FROM PRODUCTOS WHERE codigo_consulta = ?').get('7501000000011');

  if (!usuarioAdmin || !usuarioOperador || !productoPastel) {
    throw new Error('No se pudieron resolver los IDs de los datos de prueba.');
  }

  // 4. Una compra y una venta de muestra (solo si no existen movimientos aún)
  const totalCompras = db.prepare('SELECT COUNT(*) AS c FROM COMPRAS').get().c;
  if (totalCompras === 0) {
    const compra = db.prepare(`
      INSERT INTO COMPRAS (proveedor, usuario_id, total) VALUES (?, ?, ?)
    `).run('Distribuidora de Insumos Dulces S.A.', usuarioAdmin.id, 500.00);

    db.prepare(`
      INSERT INTO DETALLE_COMPRAS (compra_folio, producto_id, cantidad, costo_unitario, importe)
      VALUES (?, ?, 20, 25.00, 500.00)
    `).run(compra.lastInsertRowid, productoPastel.id);
  }

  const totalVentas = db.prepare('SELECT COUNT(*) AS c FROM VENTAS').get().c;
  if (totalVentas === 0) {
    const venta = db.prepare(`
      INSERT INTO VENTAS (usuario_id, subtotal, iva, total) VALUES (?, 110.00, 17.60, 127.60)
    `).run(usuarioOperador.id);

    db.prepare(`
      INSERT INTO DETALLE_VENTAS (venta_folio, producto_id, cantidad, precio_unitario, importe)
      VALUES (?, ?, 2, 55.00, 110.00)
    `).run(venta.lastInsertRowid, productoPastel.id);
  }
});

cargarDatosPrueba();
console.log('Base de datos dolcetto inicializada con datos de prueba.');
