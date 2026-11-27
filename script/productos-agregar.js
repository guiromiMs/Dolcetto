const formulario = document.querySelector('form');
const botonGuardar = formulario.querySelector('button[type="submit"]');
const inputImagen = document.getElementById('imagen_producto');
const vistaPrevia = document.getElementById('vista_previa');
const msjCodigo = document.getElementById('msj_codigo'); // ya existe en el HTML

// El precio no puede ser negativo ni cero. Se agrega min desde JavaScript (sin editar el HTML):
// las flechas del campo ya no bajan de 0.01 y el navegador avisa si el valor es menor.
const campoPrecio = document.getElementById('precio_producto');
campoPrecio.min = '0.01';
// Evita escribir signos y la letra "e" (los campos numéricos la aceptan como notación científica)
campoPrecio.addEventListener('keydown', (evento) => {
  if (['-', '+', 'e', 'E'].includes(evento.key)) evento.preventDefault();
});

// Mensaje general de error. Se crea con JavaScript (no se edita el HTML)
// y reutiliza la clase msj_error de estilos.css.
const mensajeGeneral = document.createElement('p');
mensajeGeneral.className = 'msj_error';
mensajeGeneral.setAttribute('role', 'alert');

function limpiarMensajes() {
  mensajeGeneral.remove();
  msjCodigo.textContent = '';
  msjCodigo.classList.add('oculto');
}

function mostrarError(resultado) {
  if (resultado.campo === 'codigo') {
    msjCodigo.textContent = resultado.mensaje;
    msjCodigo.classList.remove('oculto');
    return;
  }
  mensajeGeneral.textContent = resultado.mensaje;
  formulario.insertBefore(mensajeGeneral, formulario.querySelector('.acciones_form'));
}

// Vista previa de la imagen elegida
inputImagen.addEventListener('change', () => {
  vistaPrevia.innerHTML = '';
  const archivo = inputImagen.files[0];
  if (!archivo) return;

  const img = document.createElement('img');
  img.alt = 'Vista previa del producto';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain';
  img.onload = () => URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(archivo);
  vistaPrevia.appendChild(img);
});

// Guardar producto
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limpiarMensajes();

  // FormData permite enviar texto y archivo juntos
  const datos = new FormData();
  datos.append('codigo', document.getElementById('codigo_producto').value);
  datos.append('nombre', document.getElementById('nombre_producto').value);
  datos.append('precio', document.getElementById('precio_producto').value);
  datos.append('estado', document.getElementById('sel_estado').value);
  datos.append('descripcion', document.getElementById('desc_producto').value);
  if (inputImagen.files[0]) datos.append('imagen', inputImagen.files[0]);

  botonGuardar.disabled = true; // evita guardar dos veces por doble clic
  try {
    // OJO: no se escribe Content-Type; el navegador lo pone solo con FormData
    const respuesta = await fetch('/api/productos', { method: 'POST', body: datos });
    const resultado = await respuesta.json();

    if (!resultado.ok) {
      mostrarError(resultado);
      return;
    }
    window.location.href = 'productos.html';
  } catch (e) {
    mostrarError({ mensaje: 'No se pudo conectar con el servidor.' });
  } finally {
    botonGuardar.disabled = false;
  }
});