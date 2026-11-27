const express = require('express');
const path = require('path');
const { validarInicioSesion } = require('./login');
const app = express();
app.use(express.json());

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

app.listen(3000, () => console.log('Dolcetto en http://localhost:3000'));