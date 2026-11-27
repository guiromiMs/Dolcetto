const formulario = document.querySelector('form');
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // evita que el formulario recargue la página
  const usuario = document.getElementById('correo').value;
  const password = document.getElementById('contrasena').value;
  try {
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });
    const datos = await respuesta.json();
    if (!datos.ok) {
      alert(datos.mensaje);
      return;
    }
    sessionStorage.setItem('usuario', JSON.stringify(datos.usuario));
    window.location.href = datos.usuario.rol === 'admin'
      ? 'inicio_admin.html'
      : 'venta_operador.html';
  } catch (error) {
    alert('No se pudo conectar con el servidor.');
  }
});