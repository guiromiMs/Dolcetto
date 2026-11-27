const express = require('express');
const multer = require('multer');
const path = require('path');
const { validarInicioSesion } = require('./login');
const { crearProducto, obtenerImagen } = require('./productos');
const app = express();
app.use(express.json());

// Multer recibe los formularios con archivos. memoryStorage deja la imagen en memoria (Buffer)
// para guardarla como BLOB en SQLite, sin crear archivos en disco. Maximo 2 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// publicacion de las carpetas que se ocupa para el estilo
app.use('/estilos', express.static(path.join(__dirname, 'estilos')));
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));
app.use('/script', express.static(path.join(__dirname, 'script')));

// Pagina inicial (login)
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

// Crear producto (formulario con imagen)
// upload.single('imagen') toma el archivo enviado con el nombre "imagen" (ver script/producto_form.js)
// y lo deja en req.file; los campos de texto quedan en req.body.
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

// Mostrar la imagen BLOB de un producto, por ejemplo: /api/productos/7/imagen
app.get('/api/productos/:id/imagen', (req, res) => {
  const fila = obtenerImagen(Number(req.params.id));
  if (!fila || !fila.imagen) return res.status(404).send('Sin imagen');
  res.setHeader('Content-Type', fila.imagen_mime || 'image/jpeg');
  res.send(fila.imagen);
});

app.listen(3000, () => console.log('Dolcetto en http://localhost:3000'));