// carga todas las pantallas (elindex NO, eso lo hace el server)
(function () {
  const LOGIN = 'index.html';
  const PAGINAS_OPERADOR = ['venta_operador.html', 'devolucion_operador.html'];
  // Lee al usuario que guardo inicio.js al iniciar sesión
  function obtenerUsuario() {
    try {
      return JSON.parse(sessionStorage.getItem('usuario'));
    } catch (error) {
      return null;
    }
  }
  const usuario = obtenerUsuario();
  // sino hay usuario pues que lo regrese al lobi papaxd
  if (!usuario) {
    window.location.replace(LOGIN);
    return;
  }
  // el operador solo ve sus pantallas
  const paginaActual = window.location.pathname.split('/').pop();
  if (usuario.rol === 'operador' && !PAGINAS_OPERADOR.includes(paginaActual)) {
    window.location.replace('venta_operador.html');
    return;
  }
  // ojito: mostrar el usuario que esta iniciando secion (el que está al ladito del boton cerrar sesion)
  const chip = document.querySelector('.chip_usuario');
  if (chip) {
    const nombreRol = usuario.rol === 'admin' ? 'Administrador' : 'Operador';
    chip.textContent = usuario.usuario + ' · ' + nombreRol;
  }
  
  const botonSalir = document.querySelector('.cuenta a.boton_sec');
  if (botonSalir) {
    botonSalir.addEventListener('click', function (evento) {
      evento.preventDefault();
      sessionStorage.removeItem('usuario');
      window.location.replace(LOGIN);
    });
  }

  // si se cierra sesion no puedes dar regresar y entrar al sistema, obviamente es inseguro eso
  window.addEventListener('pageshow', function (evento) {
    if (evento.persisted && !obtenerUsuario()) {
      window.location.replace(LOGIN);
    }
  });
})();