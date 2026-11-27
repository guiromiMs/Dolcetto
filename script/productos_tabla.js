const cuerpo = document.getElementById('cuerpo_productos');
const rango = document.getElementById('rango_mostrado');
const paginacion = document.getElementById('paginacion');
const formFiltros = document.querySelector('.form_productos');
const campoBuscar = document.getElementById('buscar_producto');
const selEstado = document.getElementById('sel_estado');
const selExistencia = document.getElementById('sel_existencia');
const chkBuscar = document.getElementById('chk_buscar');
const chkEstado = document.getElementById('chk_estado');
const chkExistencia = document.getElementById('chk_existencia');

let paginaActual = 1;

// Crea un elemento con clase y texto. Se usa textContent (no innerHTML) a propósito:
// así un nombre de producto con símbolos como < o > nunca se interpreta como HTML.
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function formatoPrecio(valor) {
  return '$' + Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Una fila de la tabla (mismo orden de columnas que el HTML)
function filaProducto(p) {
  const fila = document.createElement('tr');

  // Imagen: se pide aparte al servidor
  const celdaImagen = crear('td', 'col_imagen');
  const miniatura = crear('span', 'mini_producto');
  if (p.tiene_imagen) {
    const img = document.createElement('img');
    img.src = '/api/productos/' + p.id + '/imagen';
    img.alt = p.nombre;
    img.loading = 'lazy';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';
    miniatura.appendChild(img);
  } else {
    miniatura.setAttribute('aria-label', 'Sin imagen');
  }
  celdaImagen.appendChild(miniatura);

  // Existencia: el servidor indica si es baja; aquí solo se muestra
  const celdaExistencia = crear('td', 'col_existencia');
  if (p.existencia_baja) {
    celdaExistencia.appendChild(crear('span', 'chip chip_bajo', String(p.cantidad)));
  } else {
    celdaExistencia.textContent = p.cantidad;
  }

  const activo = p.estado === 'activo';
  const celdaEstado = crear('td', 'col_estado');
  celdaEstado.appendChild(crear('span', activo ? 'chip chip_ok' : 'chip', activo ? '✓ Activo' : 'Inactivo'));

  // Acción editar
  const celdaAcciones = crear('td', 'col_acciones');
  const editar = crear('a', 'enlace_accion', 'Editar');
  editar.href = 'producto_form.html?id=' + p.id;
  celdaAcciones.append(editar);

  fila.append(
    celdaImagen,
    crear('td', 'col_codigo', p.codigo),
    crear('td', 'col_producto', p.nombre),
    crear('td', 'col_total al_derecha', formatoPrecio(p.precio)),
    celdaExistencia,
    celdaEstado,
    celdaAcciones
  );
  return fila;
}

// Una sola fila con un mensaje (sin resultados o error)
function mostrarMensajeTabla(texto) {
  cuerpo.innerHTML = '';
  const fila = document.createElement('tr');
  const celda = crear('td', '', texto);
  celda.colSpan = 7;
  fila.appendChild(celda);
  cuerpo.appendChild(fila);
}

function botonPagina(texto, destino, etiqueta, deshabilitado) {
  const enlace = crear('a', 'pag_boton', texto);
  enlace.href = '#';
  enlace.dataset.pagina = destino;
  enlace.setAttribute('aria-label', etiqueta);
  if (deshabilitado) enlace.setAttribute('aria-disabled', 'true');
  return enlace;
}

function dibujarPaginacion(pagina, totalPaginas) {
  paginacion.innerHTML = '';
  paginacion.appendChild(botonPagina('‹', pagina - 1, 'Pagina anterior', pagina === 1));

  // Ventana de hasta 5 números alrededor de la página actual
  const fin = Math.min(totalPaginas, Math.max(1, pagina - 2) + 4);
  const inicio = Math.max(1, fin - 4);
  for (let n = inicio; n <= fin; n++) {
    if (n === pagina) {
      const actual = crear('span', 'pag_actual', String(n));
      actual.setAttribute('aria-current', 'page');
      paginacion.appendChild(actual);
    } else {
      paginacion.appendChild(botonPagina(String(n), n, 'Ir a la pagina ' + n, false));
    }
  }

  paginacion.appendChild(botonPagina('›', pagina + 1, 'Pagina siguiente', pagina === totalPaginas));
}

// Pide los productos al servidor con los filtros activos y dibuja la tabla
async function cargarProductos() {
  const busquedaActiva = chkBuscar && chkBuscar.checked ? campoBuscar.value.trim() : '';
  const estadoActivo = chkEstado && chkEstado.checked ? selEstado.value : 'Todos';
  const existenciaActiva = chkExistencia && chkExistencia.checked ? selExistencia.value : 'Todas';

  const parametros = new URLSearchParams({
    busqueda: busquedaActiva,
    estado: estadoActivo,
    existencia: existenciaActiva,
    pagina: paginaActual
  });

  try {
    const respuesta = await fetch('/api/productos?' + parametros);
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.mensaje);

    paginaActual = datos.pagina; // el servidor corrige la página si quedó fuera de rango

    if (datos.productos.length === 0) {
      mostrarMensajeTabla('No se encontraron productos.');
      rango.textContent = 'Mostrando 0 de 0';
    } else {
      cuerpo.innerHTML = '';
      datos.productos.forEach((p) => cuerpo.appendChild(filaProducto(p)));
      const desde = (datos.pagina - 1) * datos.porPagina + 1;
      const hasta = desde + datos.productos.length - 1;
      rango.textContent = 'Mostrando ' + desde + '–' + hasta + ' de ' + datos.total;
    }
    dibujarPaginacion(datos.pagina, datos.totalPaginas);
  } catch (e) {
    mostrarMensajeTabla('No se pudieron cargar los productos.');
  }
}

// Si el usuario escribe o cambia un select, marca automáticamente su checkbox correspondiente
if (campoBuscar && chkBuscar) {
  campoBuscar.addEventListener('input', () => {
    if (campoBuscar.value.trim() !== '') chkBuscar.checked = true;
  });
}
if (selEstado && chkEstado) {
  selEstado.addEventListener('change', () => {
    chkEstado.checked = true;
  });
}
if (selExistencia && chkExistencia) {
  selExistencia.addEventListener('change', () => {
    chkExistencia.checked = true;
  });
}

// Botón "Aplicar": vuelve a la página 1 con los filtros activos
formFiltros.addEventListener('submit', (evento) => {
  evento.preventDefault();
  paginaActual = 1;
  cargarProductos();
});

// Botón "Limpiar filtros": restablece campos y recarga todos los productos
formFiltros.addEventListener('reset', () => {
  setTimeout(() => {
    paginaActual = 1;
    cargarProductos();
  }, 0);
});

// Clics en la paginación
paginacion.addEventListener('click', (evento) => {
  const enlace = evento.target.closest('a[data-pagina]');
  if (!enlace) return;
  evento.preventDefault();
  if (enlace.getAttribute('aria-disabled') === 'true') return;
  paginaActual = Number(enlace.dataset.pagina);
  cargarProductos();
});

cargarProductos();