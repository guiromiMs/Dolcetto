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

//AGREGUÉ, GABRIELA TODO ESTE CONST
const { obtenerResumenInicio } = require('./inicio_bdd');
const { listarCajerosVentas, listarVentas } = require('./historial_ventas_bdd');
const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} = require('./usuarios_bdd');
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

app.listen(3000, () => console.log('Dolcetto en http://localhost:3000'));
//HASTA AQUI TODO ESTO NUEVO LE PUSE, GABRIELA