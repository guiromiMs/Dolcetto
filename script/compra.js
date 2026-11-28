const campoFolio = document.getElementById('folio_compra');
const campoFecha = document.getElementById('fecha_compra');
const campoProveedor = document.getElementById('sel_proveedor');
const campoResponsable = document.getElementById('usuario_resp');
const formDetalle = document.querySelector('.form_detalle');
const campoCodigo = document.getElementById('codigo_producto');
const campoNombre = document.getElementById('buscar_nombre');
const cuerpo = document.getElementById('cuerpo_detalle');
const totalCompra = document.getElementById('total_compra');
const botonConfirmar = document.querySelector('.barra_total .boton_ok');

// Usuario que inició sesión
let usuario = null;
try {
  usuario = JSON.parse(sessionStorage.getItem('usuario'));
} catch (e) {
  usuario = null;
}

// Líneas de la compra en pantalla: { id, codigo, nombre, cantidad, costo }
let lineas = [];
let guardando = false; 

function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

function ahoraTexto() {
  const d = new Date();
  return (
    d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate()) +
    ' ' + dosDigitos(d.getHours()) + ':' + dosDigitos(d.getMinutes())
  );
}

function formatoNumero(n) {
  return Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dinero(n) {
  return '$' + formatoNumero(n);
}

// Convierte lo que escribió el usuario ("14", "14.5", "$1,200.50") en número; NaN si no es válido
function aNumero(texto) {
  const limpio = String(texto).replace(/[$,\s]/g, '');
  const numero = Number(limpio);
  return limpio !== '' && Number.isFinite(numero) ? numero : NaN;
}

function importeLinea(linea) {
  const costo = aNumero(linea.costo);
  return Number.isFinite(costo) ? Math.round(linea.cantidad * costo * 100) / 100 : 0;
}

function actualizarTotal() {
  const centavos = lineas.reduce((suma, l) => suma + Math.round(importeLinea(l) * 100), 0);
  totalCompra.textContent = formatoNumero(centavos / 100);
}

// mensaje
const mensaje = document.createElement('p');
mensaje.className = 'msj_error';
mensaje.setAttribute('role', 'alert');

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.style.color = tipo === 'ok' ? '#356F4B' : '';
  mensaje.style.fontWeight = tipo === 'ok' ? '600' : '';
  if (!mensaje.isConnected) {
    document.querySelector('.barra_total').before(mensaje);
  }
}
function quitarMensaje() {
  mensaje.remove();
}
// El folio lo asigna la base de datos: aquí solo se muestra y NO se puede escribir
campoFolio.readOnly = true;
campoFolio.placeholder = '';
campoFecha.value = ahoraTexto();
if (usuario) campoResponsable.value = usuario.usuario;

async function cargarFolio() {
  try {
    const respuesta = await fetch('/api/compras/siguiente-folio');
    const datos = await respuesta.json();
    if (datos.ok) campoFolio.value = datos.folio_texto;
  } catch (e) {
    campoFolio.value = '';
  }
}

//tabla detalles

function cambiarCantidad(linea, nueva) {
  if (nueva < 1) {
    // Bajar de 1 quita la línea de la compra
    lineas = lineas.filter((l) => l !== linea);
  } else {
    linea.cantidad = Math.min(nueva, 1000000);
  }
  dibujarTabla();
}

function crearFila(linea) {
  const fila = document.createElement('tr');
  const celdaImporte = crear('td', 'col_total al_derecha', dinero(importeLinea(linea)));

  // Cantidad: botones − / + y un campo para escribir cantidades grandes
  const celdaCantidad = crear('td', 'col_cantidad');
  const control = crear('div', 'control_cantidad');
  const menos = crear('button', '', '−');
  menos.type = 'button';
  menos.setAttribute('aria-label', 'Reducir cantidad');
  const mas = crear('button', '', '+');
  mas.type = 'button';
  mas.setAttribute('aria-label', 'Aumentar cantidad');

  const entrada = document.createElement('input');
  entrada.type = 'number';
  entrada.min = '1';
  entrada.step = '1';
  entrada.value = linea.cantidad;
  entrada.className = 'campo_texto';
  entrada.style.cssText = 'width:72px;height:36px;padding:0 6px;text-align:center';
  entrada.setAttribute('aria-label', 'Cantidad de ' + linea.nombre);

  menos.addEventListener('click', () => cambiarCantidad(linea, linea.cantidad - 1));
  mas.addEventListener('click', () => cambiarCantidad(linea, linea.cantidad + 1));
  entrada.addEventListener('keydown', (evento) => {
    if (['-', '+', 'e', 'E', '.', ','].includes(evento.key)) evento.preventDefault();
  });
  entrada.addEventListener('input', () => {
    const numero = Number(entrada.value);
    if (Number.isInteger(numero) && numero >= 1 && numero <= 1000000) {
      linea.cantidad = numero;
      celdaImporte.textContent = dinero(importeLinea(linea));
      actualizarTotal();
    }
  });
  // Si se sale del campo vacío o inválido, se restaura la última cantidad buena
  entrada.addEventListener('change', () => {
    entrada.value = linea.cantidad;
  });
  control.append(menos, entrada, mas);
  celdaCantidad.appendChild(control);

  // Costo unitario
  const celdaCosto = crear('td', 'col_costo');
  const etiqueta = crear('label', 'solo_lector', 'Costo unitario de ' + linea.nombre);
  etiqueta.htmlFor = 'costo_' + linea.id;
  const costo = document.createElement('input');
  costo.type = 'text';
  costo.inputMode = 'decimal';
  costo.id = 'costo_' + linea.id;
  costo.className = 'campo_texto campo_costo';
  costo.placeholder = '$0.00';
  costo.value = linea.costo;
  costo.addEventListener('input', () => {
    linea.costo = costo.value;
    celdaImporte.textContent = dinero(importeLinea(linea));
    actualizarTotal();
  });
  celdaCosto.append(etiqueta, costo);

  fila.append(
    crear('td', 'col_codigo', linea.codigo),
    crear('td', 'col_producto', linea.nombre),
    celdaCantidad,
    celdaCosto,
    celdaImporte
  );
  return fila;
}

function dibujarTabla() {
  cuerpo.innerHTML = '';
  if (lineas.length === 0) {
    const fila = document.createElement('tr');
    const celda = crear('td', '', 'Agrega productos con el lector de códigos o buscándolos por nombre.');
    celda.colSpan = 5;
    fila.appendChild(celda);
    cuerpo.appendChild(fila);
  } else {
    lineas.forEach((l) => cuerpo.appendChild(crearFila(l)));
  }
  actualizarTotal();
}

// Agrega el producto con cantidad 1, o suma 1 si ya estaba en la compra
function agregarProducto(producto) {
  const existente = lineas.find((l) => l.id === producto.id);
  let esNueva = false;
  if (existente) {
    existente.cantidad = Math.min(existente.cantidad + 1, 1000000);
  } else {
    esNueva = true;
    lineas.push({
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad: 1,
      // Se sugiere el costo de la última compra de ese producto (si la hubo)
      costo: producto.ultimo_costo != null ? Number(producto.ultimo_costo).toFixed(2) : ''
    });
  }
  dibujarTabla();

  campoCodigo.value = '';
  campoNombre.value = '';
  // Producto nuevo sin costo: el cursor va al costo; si no, vuelve al código para seguir escaneando
  const campoCostoNuevo = document.getElementById('costo_' + producto.id);
  if (esNueva && campoCostoNuevo && campoCostoNuevo.value === '') campoCostoNuevo.focus();
  else campoCodigo.focus();
}

formDetalle.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  quitarMensaje();
  const codigo = campoCodigo.value.trim();
  const nombre = campoNombre.value.trim();

  try {
    if (codigo) {
      // Lector de códigos: el código manda sobre el nombre
      const respuesta = await fetch('/api/compras/producto?' + new URLSearchParams({ codigo }));
      const datos = await respuesta.json();
      if (!datos.ok) {
        mostrarMensaje(datos.mensaje);
        campoCodigo.select();
        return;
      }
      agregarProducto(datos.producto);
    } else if (nombre) {
      const respuesta = await fetch('/api/compras/productos?' + new URLSearchParams({ busqueda: nombre }));
      const datos = await respuesta.json();
      const encontrados = datos.productos || [];

      let elegido = null;
      if (encontrados.length === 1) {
        elegido = encontrados[0];
      } else {
        const iguales = encontrados.filter((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
        if (iguales.length === 1) elegido = iguales[0];
      }

      if (!elegido) {
        mostrarMensaje(
          encontrados.length === 0
            ? 'No se encontró ningún producto activo que coincida con "' + nombre + '".'
            : 'Hay varios productos que coinciden con "' + nombre + '". Elige uno de las sugerencias o escribe su código.'
        );
        return;
      }
      agregarProducto(elegido);
    } else {
      mostrarMensaje('Escribe o escanea un código, o busca un producto por nombre.');
    }
  } catch (e) {
    mostrarMensaje('No se pudo conectar con el servidor.');
  }
});

// Sugerencias mientras se escribe el nombre (lista nativa del navegador)
const listaSugerencias = document.createElement('datalist');
listaSugerencias.id = 'sugerencias_producto';
document.body.appendChild(listaSugerencias);
campoNombre.setAttribute('list', listaSugerencias.id);

// Lo último que se escribe manda: al escribir en un campo se vacía el otro,
// para que un código viejo no se imponga sobre el nombre que se está buscando
campoCodigo.addEventListener('input', () => {
  campoNombre.value = '';
});

let temporizador = null;
let numeroBusqueda = 0;
campoNombre.addEventListener('input', () => {
  campoCodigo.value = '';
  clearTimeout(temporizador);
  const texto = campoNombre.value.trim();
  if (texto.length < 2) {
    listaSugerencias.innerHTML = '';
    return;
  }
  temporizador = setTimeout(async () => {
    const miBusqueda = ++numeroBusqueda;
    try {
      const respuesta = await fetch('/api/compras/productos?' + new URLSearchParams({ busqueda: texto }));
      const datos = await respuesta.json();
      if (miBusqueda !== numeroBusqueda) return; 
      listaSugerencias.innerHTML = '';
      (datos.productos || []).forEach((p) => {
        const opcion = document.createElement('option');
        opcion.value = p.nombre;
        opcion.label = p.codigo;
        listaSugerencias.appendChild(opcion);
      });
    } catch (e) {
      
    }
  }, 250);
});

// confirma compra

botonConfirmar.addEventListener('click', async () => {
  if (guardando) return;
  quitarMensaje();

  // Revisiones rápidas de pantalla; el servidor vuelve a validar todo
  if (!usuario) {
    mostrarMensaje('Tu sesión no es válida. Vuelve a iniciar sesión.');
    return;
  }
  if (!campoProveedor.value.trim()) {
    mostrarMensaje('Ingresa el proveedor.');
    campoProveedor.focus();
    return;
  }
  if (lineas.length === 0) {
    mostrarMensaje('Agrega al menos un producto a la compra.');
    return;
  }
  const sinCosto = lineas.find((l) => !(aNumero(l.costo) > 0));
  if (sinCosto) {
    mostrarMensaje('Ingresa el costo unitario de "' + sinCosto.nombre + '".');
    const campo = document.getElementById('costo_' + sinCosto.id);
    if (campo) campo.focus();
    return;
  }

  guardando = true;
  botonConfirmar.disabled = true;
  try {
    const respuesta = await fetch('/api/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: usuario.id,
        proveedor: campoProveedor.value,
        lineas: lineas.map((l) => ({
          producto_id: l.id,
          cantidad: l.cantidad,
          costo_unitario: aNumero(l.costo)
        }))
      })
    });
    const datos = await respuesta.json();
    if (!datos.ok) {
      mostrarMensaje(datos.mensaje);
      return;
    }

    // Compra guardada: se limpia la pantalla para la siguiente
    lineas = [];
    campoProveedor.value = '';
    campoCodigo.value = '';
    campoNombre.value = '';
    campoFecha.value = ahoraTexto();
    dibujarTabla();
    cargarFolio();
    mostrarMensaje(
      '✓ Compra ' + datos.folio_texto + ' registrada: ' + datos.unidades +
        (datos.unidades === 1 ? ' pieza' : ' piezas') + ', total ' + dinero(datos.total) +
        '. Las existencias ya se actualizaron.',
      'ok'
    );
  } catch (e) {
    mostrarMensaje('No se pudo conectar con el servidor. La compra no se registró.');
  } finally {
    guardando = false;
    botonConfirmar.disabled = false;
  }
});

dibujarTabla();
cargarFolio();