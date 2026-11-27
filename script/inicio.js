const formulario = document.querySelector('form');
const botonEntrar = formulario.querySelector('button[type="submit"]');

// Espacio para el mensaje de error
// y reutiliza la clase msj_error que ya existe en estilos.css.
const mensaje = document.createElement('p');
mensaje.className = 'msj_error';
mensaje.setAttribute('role', 'alert');
function mostrarMensaje(texto) {
  mensaje.textContent = texto;
  if (!mensaje.isConnected) {
    formulario.insertBefore(mensaje, botonEntrar);
  }
}

function quitarMensaje() {
  mensaje.remove();
}

// El mensaje desaparece cuando el usuario vuelve a escribir
document.getElementById('usuario').addEventListener('input', quitarMensaje);
document.getElementById('contrasena').addEventListener('input', quitarMensaje);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // evita que el formulario recargue la página
  quitarMensaje();

  const usuario = document.getElementById('usuario').value;
  const password = document.getElementById('contrasena').value;

  try {
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });
    const datos = await respuesta.json();

    if (!datos.ok) {
      mostrarMensaje(datos.mensaje);
      return;
    }

    sessionStorage.setItem('usuario', JSON.stringify(datos.usuario));
    window.location.href = datos.usuario.rol === 'admin'
      ? 'inicio_admin.html'
      : 'venta_operador.html';
  } catch (error) {
    mostrarMensaje('No se pudo conectar con el servidor.');
  }
});