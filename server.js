const express = require('express');
const multer = require('multer');
const path = require('path');
const { validarInicioSesion } = require('./login');
const {
  crearProducto,
  obtenerImagen,
  listarProductos,
  obtenerProductoPorId,
  actualizarProducto
} = require('./productos');
const compras = require('./compras');
//AGREGUÉ, GABRIELA TODO ESTE CONST
const { obtenerResumenInicio } = require('./inicio_bdd');
const { listarCajerosVentas, listarVentas } = require('./historial_ventas_bdd');
const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} = require('./usuarios_bdd');
const {
  listarProductosParaVenta,
  buscarProductoPorCodigo,
  registrarVenta
} = require('./venta_operador_bdd');
const {
  buscarVentasParaDevolucion,
  obtenerDetalleVentaDevolucion,
  registrarDevolucion
} = require('./devolucion_operador_bdd');
//AGREGUÉ, GABRIELA

const app = express();
app.use(express.json());

// Multer recibe los formularios con archivos. memoryStorage deja la imagen en memoria (Buffer)
// para guardarla como BLOB en SQLite, sin crear archivos en disco. Maximo 2 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// publicacion de las carpetas que se ocupa para el estilo
app.use('/estilos', express.static(path.join(__dirname, 'estilos')));
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));
app.use('/script', express.static(path.join(__dirname, 'script')));

// Pagina inicial
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Demas paginas .html (cada una carga sus propios scripts desde su HTML)
app.use((req, res, next) => {
  if (req.method === 'GET' && /^\/[a-z_]+\.html$/.test(req.path)) {
    return res.sendFile(path.join(__dirname, req.path));
  }
  next();
});

// Ruta de inicio de sesion
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  const resultado = validarInicioSesion(usuario, password);
  res.status(resultado.ok ? 200 : 401).json(resultado);
});

// Listar productos con busqueda, filtros y paginacion
app.get('/api/productos', (req, res) => {
  try {
    res.json(listarProductos(req.query));
  } catch (e) {
    console.error('Error al listar productos:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar los productos.' });
  }
});

// Obtener un producto por ID para editarlo
app.get('/api/productos/:id', (req, res) => {
  try {
    const producto = obtenerProductoPorId(req.params.id);
    if (!producto) {
      return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado.' });
    }
    res.json({ ok: true, producto });
  } catch (e) {
    console.error('Error al obtener el producto:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al obtener el producto.' });
  }
});

// Crear producto (formulario con imagen)
// upload.single('imagen') toma el archivo enviado con el nombre "imagen"
// y lo deja en req.file; los campos de texto quedan en req.body
app.post('/api/productos', (req, res) => {
  upload.single('imagen')(req, res, (errorSubida) => {
    if (errorSubida) {
      const mensaje =
        errorSubida.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen no debe pesar más de 2 MB.'
          : 'No se pudo leer la imagen.';
      return res.status(400).json({ ok: false, mensaje, campo: 'imagen' });
    }

    try {
      const resultado = crearProducto(req.body, req.file);
      res.status(resultado.ok ? 201 : 400).json(resultado);
    } catch (e) {
      console.error('Error al guardar el producto:', e);
      res.status(500).json({ ok: false, mensaje: 'Error interno al guardar el producto.' });
    }
  });
});

// Actualizar producto existente por ID
app.put('/api/productos/:id', (req, res) => {
  upload.single('imagen')(req, res, (errorSubida) => {
    if (errorSubida) {
      const mensaje =
        errorSubida.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen no debe pesar más de 2 MB.'
          : 'No se pudo leer la imagen.';
      return res.status(400).json({ ok: false, mensaje, campo: 'imagen' });
    }

    try {
      const resultado = actualizarProducto(req.params.id, req.body, req.file);
      res.status(resultado.ok ? 200 : 400).json(resultado);
    } catch (e) {
      console.error('Error al actualizar el producto:', e);
      res.status(500).json({ ok: false, mensaje: 'Error interno al actualizar el producto.' });
    }
  });
});

// Mostrar la imagen BLOB de un producto
app.get('/api/productos/:id/imagen', (req, res) => {
  const fila = obtenerImagen(Number(req.params.id));
  if (!fila || !fila.imagen) return res.status(404).send('Sin imagen');
  res.setHeader('Content-Type', fila.imagen_mime || 'image/jpeg');
  res.send(fila.imagen);
});

/* QUITE TODO ESTO, GABRIELA
app.get('/inicio_bdd.js', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'inicio_bdd.js'));
});


app.listen(3000, () => console.log('Dolcetto en http://localhost:3000'));
*/

//PARA PONER TODO ESTO, GABRIELA
// Resumen general para inicio_admin.html
app.get('/api/inicio', (req, res) => {
  try {
    res.json(obtenerResumenInicio(req.query.umbral));
  } catch (e) {
    console.error('Error al cargar el resumen de inicio:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el resumen de inicio.' });
  }
});

// Lista de cajeros para el filtro de historial_ventas.html
app.get('/api/ventas/cajeros', (req, res) => {
  try {
    res.json({ ok: true, cajeros: listarCajerosVentas() });
  } catch (e) {
    console.error('Error al listar cajeros:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar los cajeros.' });
  }
});

// Historial de ventas con filtros y paginacion
app.get('/api/ventas', (req, res) => {
  try {
    res.json(listarVentas(req.query));
  } catch (e) {
    console.error('Error al listar ventas:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar las ventas.' });
  }
});

// Gestion de usuarios (conectado a usuarios_bdd.js)
app.get('/api/usuarios', (req, res) => {
  try {
    res.json({ ok: true, usuarios: listarUsuarios() });
  } catch (e) {
    console.error('Error al listar usuarios:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar los usuarios.' });
  }
});

app.post('/api/usuarios', (req, res) => {
  try {
    const resultado = crearUsuario(req.body);
    res.status(resultado.ok ? 201 : 400).json(resultado);
  } catch (e) {
    console.error('Error al crear usuario:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al guardar el usuario.' });
  }
});

app.put('/api/usuarios/:id', (req, res) => {
  try {
    const resultado = actualizarUsuario(req.params.id, req.body);
    res.status(resultado.ok ? 200 : 400).json(resultado);
  } catch (e) {
    console.error('Error al actualizar usuario:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al actualizar el usuario.' });
  }
});

app.delete('/api/usuarios/:id', (req, res) => {
  try {
    const resultado = eliminarUsuario(req.params.id);
    res.status(resultado.ok ? 200 : 400).json(resultado);
  } catch (e) {
    console.error('Error al eliminar usuario:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al eliminar el usuario.' });
  }
});

// Pantalla Venta Operador (conectado a venta_operador_bdd.js)
app.get('/api/venta-operador/productos', (req, res) => {
  try {
    res.json({ ok: true, productos: listarProductosParaVenta(req.query.q) });
  } catch (e) {
    console.error('Error al listar productos para venta:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar los productos.' });
  }
});

app.get('/api/venta-operador/codigo/:codigo', (req, res) => {
  try {
    const producto = buscarProductoPorCodigo(req.params.codigo);
    if (!producto) {
      return res.status(404).json({ ok: false, mensaje: 'Código no encontrado o producto inactivo.' });
    }
    res.json({ ok: true, producto });
  } catch (e) {
    console.error('Error al buscar código:', e);
    res.status(500).json({ ok: false, mensaje: 'Error al consultar el código.' });
  }
});

app.post('/api/venta-operador/cobrar', (req, res) => {
  try {
    const resultado = registrarVenta(req.body);
    res.status(resultado.ok ? 201 : 400).json(resultado);
  } catch (e) {
    console.error('Error al registrar venta:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al registrar la venta.' });
  }
});

// Pantalla Devolucion Operador (conectado a devolucion_operador_bdd.js)
app.get('/api/devoluciones/ventas', (req, res) => {
  try {
    res.json(buscarVentasParaDevolucion(req.query));
  } catch (e) {
    console.error('Error al buscar ventas para devolucion:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar las ventas.' });
  }
});

app.get('/api/devoluciones/venta/:folio', (req, res) => {
  try {
    const resultado = obtenerDetalleVentaDevolucion(req.params.folio);
    res.status(resultado.ok ? 200 : 404).json(resultado);
  } catch (e) {
    console.error('Error al obtener detalle de venta:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudo obtener el detalle de la venta.' });
  }
});

app.post('/api/devoluciones', (req, res) => {
  try {
    const resultado = registrarDevolucion(req.body);
    res.status(resultado.ok ? 201 : 400).json(resultado);
  } catch (e) {
    console.error('Error al registrar devolucion:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al registrar la devolucion.' });
  }
});
// ---------- Compras (compras.js) ----------

// Folio que tendra la siguiente compra (solo se muestra; el real lo asigna SQLite al guardar)
app.get('/api/compras/siguiente-folio', (req, res) => {
  try {
    res.json(compras.siguienteFolio());
  } catch (e) {
    console.error('Error al calcular el folio:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudo calcular el folio.' });
  }
});

// Buscar un producto por codigo exacto (lector de codigos)
app.get('/api/compras/producto', (req, res) => {
  try {
    const resultado = compras.buscarProductoPorCodigo(req.query.codigo);
    res.status(resultado.ok ? 200 : resultado.status).json(resultado);
  } catch (e) {
    console.error('Error al buscar el producto:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al buscar el producto.' });
  }
});

// Sugerencias de productos por nombre o codigo (maximo 8)
app.get('/api/compras/productos', (req, res) => {
  try {
    res.json(compras.buscarProductos(req.query.busqueda));
  } catch (e) {
    console.error('Error al buscar productos:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al buscar productos.' });
  }
});

// Registrar compra: encabezado + detalle + existencias, todo en una sola transaccion
app.post('/api/compras', (req, res) => {
  try {
    const resultado = compras.registrarCompra(req.body);
    res.status(resultado.ok ? 201 : resultado.status).json(resultado);
  } catch (e) {
    console.error('Error al registrar la compra:', e);
    res.status(500).json({ ok: false, mensaje: 'Error interno al registrar la compra.' });
  }
});
// Listar compras con filtros y paginacion para el historial
app.get('/api/compras', (req, res) => {
  try {
    const resultado = compras.listarCompras(req.query);
    res.status(resultado.ok ? 200 : resultado.status || 400).json(resultado);
  } catch (e) {
    console.error('Error al listar compras:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar las compras.' });
  }
});

// Lista de proveedores distintos para el filtro del historial
app.get('/api/compras/proveedores', (req, res) => {
  try {
    res.json(compras.listarProveedores());
  } catch (e) {
    console.error('Error al listar proveedores:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar los proveedores.' });
  }
});

// Detalle de una compra por folio ("Ver detalle")
app.get('/api/compras/:folio', (req, res) => {
  try {
    const resultado = compras.obtenerDetalleCompra(req.params.folio);
    res.status(resultado.ok ? 200 : resultado.status || 404).json(resultado);
  } catch (e) {
    console.error('Error al obtener detalle de compra:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudo obtener el detalle de la compra.' });
  }
});
app.listen(3000, () => console.log('Dolcetto en http://localhost:3000'));
