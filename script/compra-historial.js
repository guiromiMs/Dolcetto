const formFiltros = document.getElementById('form_filtros');
const chkFolio = document.getElementById('chk_folio');
const chkFecha = document.getElementById('chk_fecha');
const chkProveedor = document.getElementById('chk_proveedor');
const campoFolio = document.getElementById('buscar_folio');
const fechaInicial = document.getElementById('fecha_inicial');
const fechaFinal = document.getElementById('fecha_final');
const selProveedor = document.getElementById('sel_proveedor');
const totalRegistradas = document.getElementById('compras_reg');
const totalComprado = document.getElementById('total_comprado');
const cuerpo = document.getElementById('cuerpo_compras');
const rango = document.querySelector('.pie_tabla > span');
const paginacion = document.getElementById('paginacion');

let paginaActual = 1;
// textContent (no innerHTML) a proposito: un proveedor con simbolos como < o > nunca se interpreta como HTML
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}
function formatoNumero(n) {
  return Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dinero(n) {
  return '$' + formatoNumero(n);
}

// Mensaje de error
const mensaje = document.createElement('p');
mensaje.className = 'msj_error';
mensaje.setAttribute('role', 'alert');

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
  if (!mensaje.isConnected) formFiltros.after(mensaje);
}

function quitarMensaje() {
  mensaje.remove();
}


// Solo se envian los filtros cuyas casillas estan marcadas (y que tengan algo escrito o elegido)
function parametrosFiltros() {
  const parametros = new URLSearchParams();
  if (chkFolio.checked && campoFolio.value.trim()) {
    parametros.set('folio', campoFolio.value.trim());
  }
  if (chkFecha.checked) {
    if (fechaInicial.value) parametros.set('fecha_inicial', fechaInicial.value);
    if (fechaFinal.value) parametros.set('fecha_final', fechaFinal.value);
  }
  if (chkProveedor.checked && selProveedor.value) {
    parametros.set('proveedor', selProveedor.value);
  }
  parametros.set('pagina', paginaActual);
  return parametros;
}

// El proveedor se escribe a mano al registrar la compra, asi que la lista sale de las compras guardadas
async function cargarProveedores() {
  try {
    const respuesta = await fetch('/api/compras/proveedores');
    const datos = await respuesta.json();
    if (!datos.ok) return;

    Array.from(selProveedor.options)
      .filter((opcion) => opcion.value !== '')
      .forEach((opcion) => opcion.remove());
    datos.proveedores.forEach((nombre) => {
      const opcion = document.createElement('option');
      opcion.value = nombre;
      opcion.textContent = nombre;
      selProveedor.appendChild(opcion);
    });
  } catch (e) {
    // Sin lista de proveedores: el resto de la pantalla sigue funcionando
  }
}

// Detalle de una compra: se despliega como una fila extra debajo de la compra
function filaDetalle(datos) {
  const fila = document.createElement('tr');
  fila.className = 'fila_detalle';
  const celda = document.createElement('td');
  celda.colSpan = 8;

  const tabla = crear('table', 'tabla');
  const encabezado = document.createElement('tr');
  [
    ['Código', 'col_codigo'],
    ['Producto', 'col_producto'],
    ['Cantidad', 'col_cantidad'],
    ['Costo unitario', 'col_total al_derecha'],
    ['Importe', 'col_total al_derecha']
  ].forEach(([texto, clase]) => {
    const th = crear('th', clase, texto);
    th.scope = 'col';
    encabezado.appendChild(th);
  });
  const thead = document.createElement('thead');
  thead.appendChild(encabezado);

  const tbody = document.createElement('tbody');
  datos.lineas.forEach((l) => {
    const tr = document.createElement('tr');
    tr.append(
      crear('td', 'col_codigo', l.codigo),
      crear('td', 'col_producto', l.nombre),
      crear('td', 'col_cantidad', String(l.cantidad)),
      crear('td', 'col_total al_derecha', dinero(l.costo_unitario)),
      crear('td', 'col_total al_derecha', dinero(l.importe))
    );
    tbody.appendChild(tr);
  });

  // Fila final con el total de la compra (calculado por el servidor)
  const totales = document.createElement('tr');
  const etiqueta = crear('td', '', 'Total de la compra · ' + datos.compra.articulos + ' piezas');
  etiqueta.colSpan = 4;
  etiqueta.style.fontWeight = '700';
  const importe = crear('td', 'col_total al_derecha', dinero(datos.compra.total));
  importe.style.fontWeight = '700';
  totales.append(etiqueta, importe);
  tbody.appendChild(totales);

  tabla.append(thead, tbody);
  celda.appendChild(tabla);
  fila.appendChild(celda);
  return fila;
}

async function alternarDetalle(fila, enlace, folio) {
  const siguiente = fila.nextElementSibling;
  if (siguiente && siguiente.classList.contains('fila_detalle')) {
    siguiente.remove();
    enlace.textContent = 'Ver detalle';
    return;
  }

  try {
    const respuesta = await fetch('/api/compras/' + folio);
    const datos = await respuesta.json();
    if (!datos.ok) {
      mostrarMensaje(datos.mensaje);
      return;
    }
    // Por si se hizo clic dos veces seguidas mientras llegaba la respuesta
    if (fila.nextElementSibling && fila.nextElementSibling.classList.contains('fila_detalle')) return;
    fila.after(filaDetalle(datos));
    enlace.textContent = 'Ocultar detalle';
  } catch (e) {
    mostrarMensaje('No se pudo cargar el detalle de la compra.');
  }
}

function filaCompra(c) {
  const fila = document.createElement('tr');

  const celdaEstado = crear('td', 'col_estado');
  celdaEstado.appendChild(crear('span', 'chip chip_ok', c.estado));

  const enlace = crear('a', 'enlace_accion', 'Ver detalle');
  enlace.href = '#';
  enlace.addEventListener('click', (evento) => {
    evento.preventDefault();
    alternarDetalle(fila, enlace, c.folio);
  });
  const celdaAcciones = crear('td', 'col_acciones');
  celdaAcciones.appendChild(enlace);

  fila.append(
    crear('td', 'col_folio', c.folio_texto),
    crear('td', 'col_fecha', c.fecha_hora),
    crear('td', 'col_proveedor', c.proveedor),
    crear('td', 'col_responsable', c.responsable),
    crear('td', 'col_articulos', String(c.articulos)),
    crear('td', 'col_total al_derecha', dinero(c.total)),
    celdaEstado,
    celdaAcciones
  );
  return fila;
}

function mostrarMensajeTabla(texto) {
  cuerpo.innerHTML = '';
  const fila = document.createElement('tr');
  const celda = crear('td', '', texto);
  celda.colSpan = 8;
  fila.appendChild(celda);
  cuerpo.appendChild(fila);
}

// paginacion

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

  // Ventana de hasta 5 numeros alrededor de la pagina actual
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


async function cargarCompras() {
  quitarMensaje();
  try {
    const respuesta = await fetch('/api/compras?' + parametrosFiltros());
    const datos = await respuesta.json();

    // Filtros invalidos (por ejemplo fecha inicial posterior a la final): se avisa y se deja la tabla como estaba
    if (!datos.ok) {
      mostrarMensaje(datos.mensaje);
      return;
    }

    paginaActual = datos.pagina; 
    totalRegistradas.textContent = datos.total;
    totalComprado.textContent = formatoNumero(datos.total_comprado);

    if (datos.compras.length === 0) {
      mostrarMensajeTabla('No se encontraron compras con esos filtros.');
      rango.textContent = 'Mostrando 0 de 0';
    } else {
      cuerpo.innerHTML = '';
      datos.compras.forEach((c) => cuerpo.appendChild(filaCompra(c)));
      const desde = (datos.pagina - 1) * datos.porPagina + 1;
      const hasta = desde + datos.compras.length - 1;
      rango.textContent = 'Mostrando ' + desde + '–' + hasta + ' de ' + datos.total;
    }
    dibujarPaginacion(datos.pagina, datos.totalPaginas);
  } catch (e) {
    mostrarMensajeTabla('No se pudieron cargar las compras.');
  }
}

// Boton "Aplicar"
formFiltros.addEventListener('submit', (evento) => {
  evento.preventDefault();
  paginaActual = 1;
  cargarCompras();
});

// Boton "Limpiar filtros" (type="reset"): el navegador vacia el formulario y despues se recarga la lista completa
formFiltros.addEventListener('reset', () => {
  paginaActual = 1;
  setTimeout(cargarCompras, 0); // en el evento reset los campos todavia no se han limpiado
});

paginacion.addEventListener('click', (evento) => {
  const enlace = evento.target.closest('a[data-pagina]');
  if (!enlace) return;
  evento.preventDefault();
  if (enlace.getAttribute('aria-disabled') === 'true') return;
  paginaActual = Number(enlace.dataset.pagina);
  cargarCompras();
});

cargarProveedores();
cargarCompras();