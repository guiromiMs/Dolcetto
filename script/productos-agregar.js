const formulario = document.querySelector('form');
const botonGuardar = formulario.querySelector('button[type="submit"]');
const inputImagen = document.getElementById('imagen_producto');
const vistaPrevia = document.getElementById('vista_previa');
const msjCodigo = document.getElementById('msj_codigo'); 
const tituloFormulario = document.getElementById('titulo_formulario');
const campoId = document.getElementById('id_producto');
const campoCodigo = document.getElementById('codigo_producto');
const campoNombre = document.getElementById('nombre_producto');
const campoPrecio = document.getElementById('precio_producto');
const campoEstado = document.getElementById('sel_estado');
const campoDesc = document.getElementById('desc_producto');

const params = new URLSearchParams(window.location.search);
const idEdicion = params.get('id');
const esEdicion = Boolean(idEdicion);

// El precio no puede ser negativo ni cero. Se agrega min 
// las flechas del campo ya no bajan de 0.01 y el navegador avisa si el valor es menor.
campoPrecio.min = '0.01';
// Evita escribir signos y la letra e (los campos numéricos la aceptan como notación científica)
campoPrecio.addEventListener('keydown', (evento) => {
  if (['-', '+', 'e', 'E'].includes(evento.key)) evento.preventDefault();
});
// Mensaje general de error y reutiliza la clase msj_error del css
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

function mostrarImagenUrl(url, altTexto) {
  vistaPrevia.innerHTML = '';
  const img = document.createElement('img');
  img.alt = altTexto || 'Vista previa del producto';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain';
  img.src = url;
  vistaPrevia.appendChild(img);
}

// Vista previa de la imagen elegida
inputImagen.addEventListener('change', () => {
  const archivo = inputImagen.files[0];
  if (!archivo) {
    if (!esEdicion) vistaPrevia.innerHTML = '';
    return;
  }

  vistaPrevia.innerHTML = '';
  const img = document.createElement('img');
  img.alt = 'Vista previa del producto';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain';
  img.onload = () => URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(archivo);
  vistaPrevia.appendChild(img);
});

// Si viene ?id=... en la URL, carga los datos del producto para editar
async function cargarDatosEdicion() {
  if (!esEdicion) return;

  if (tituloFormulario) tituloFormulario.textContent = 'Editar producto';
  if (campoId) campoId.value = idEdicion;
  if (botonGuardar) botonGuardar.disabled = true;

  try {
    const respuesta = await fetch(`/api/productos/${encodeURIComponent(idEdicion)}`);
    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok || !resultado.producto) {
      mostrarError({ mensaje: resultado.mensaje || 'No se pudo cargar el producto.' });
      return;
    }

    const p = resultado.producto;
    campoCodigo.value = p.codigo;
    campoNombre.value = p.nombre;
    campoPrecio.value = p.precio;
    campoDesc.value = p.descripcion || '';
    if (campoEstado) {
      campoEstado.value = p.estado === 'inactivo' ? 'Inactivo' : 'Activo';
    }

    if (p.tiene_imagen) {
      mostrarImagenUrl(`/api/productos/${p.id}/imagen?t=${Date.now()}`, p.nombre);
    }
  } catch (e) {
    mostrarError({ mensaje: 'No se pudo conectar con el servidor para cargar el producto.' });
  } finally {
    if (botonGuardar) botonGuardar.disabled = false;
  }
}

// Guardar producto (crear con POST o actualizar con PUT)
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limpiarMensajes();

  // FormData permite enviar texto y archivo juntos
  const datos = new FormData();
  datos.append('codigo', campoCodigo.value);
  datos.append('nombre', campoNombre.value);
  datos.append('precio', campoPrecio.value);
  datos.append('estado', campoEstado.value);
  datos.append('descripcion', campoDesc.value);
  if (inputImagen.files[0]) datos.append('imagen', inputImagen.files[0]);

  const url = esEdicion ? `/api/productos/${encodeURIComponent(idEdicion)}` : '/api/productos';
  const metodo = esEdicion ? 'PUT' : 'POST';

  botonGuardar.disabled = true; // evita guardar dos veces por doble clic
  try {
    // OJO: no se escribe Content-Type; el navegador lo pone solo con FormData
    const respuesta = await fetch(url, { method: metodo, body: datos });
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

cargarDatosEdicion();