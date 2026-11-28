document.addEventListener("DOMContentLoaded", () => {
    const inputCodigo = document.getElementById("codigo");
    const inputBuscarNombre = document.getElementById("buscar-nombre");
    const spanContador = document.getElementById("contador");
    const btnSumar = document.getElementById("sumar");
    const btnRestar = document.getElementById("restar");

    const rejillaProductos = document.querySelector(".rejilla-productos");
    const panelVenta = document.querySelector(".panel-venta");
    const estadoVacio = panelVenta.querySelector(".estado-vacio");
    const resumenMontos = panelVenta.querySelector(".resumen-montos");
    const notaVenta = panelVenta.querySelector(".nota-venta");

    const filasMonto = resumenMontos.querySelectorAll(".fila-monto");
    const spanSubtotal = filasMonto[0].querySelectorAll("span")[1];
    const spanIvaEtiqueta = filasMonto[1].querySelectorAll("span")[0];
    const spanIva = filasMonto[1].querySelectorAll("span")[1];
    const strongTotal = resumenMontos.querySelector(".total-grande");

    const btnPagar = panelVenta.querySelector(".btn-pagar");
    const btnVaciar = panelVenta.querySelector(".btn-vaciar");

    // Contenedor dinámico para la lista de artículos del carrito dentro de "Venta actual"
    const listaCarrito = document.createElement("div");
    listaCarrito.id = "lista-carrito-venta";
    listaCarrito.style.display = "none";
    listaCarrito.style.flexDirection = "column";
    listaCarrito.style.gap = "0.65rem";
    listaCarrito.style.maxHeight = "300px";
    listaCarrito.style.overflowY = "auto";
    listaCarrito.style.margin = "0.75rem 0";
    panelVenta.insertBefore(listaCarrito, resumenMontos);

    let catalogoProductos = [];
    let carrito = []; // [{ id, codigo_consulta, nombre, precio, stockMax, cantidad }]
    let cantidadSelector = 0;
    let timerBusqueda = null;

    const formatoMoneda = new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function obtenerUsuarioSesion() {
        try {
            return JSON.parse(sessionStorage.getItem("usuario"));
        } catch (e) {
            return null;
        }
    }

    function actualizarContadorVisual(valor) {
        cantidadSelector = Math.max(0, valor);
        spanContador.textContent = String(cantidadSelector);
    }

    btnSumar.addEventListener("click", () => {
        actualizarContadorVisual(cantidadSelector + 1);
    });

    btnRestar.addEventListener("click", () => {
        if (cantidadSelector > 0) {
            actualizarContadorVisual(cantidadSelector - 1);
        }
    });

    function obtenerCantidadParaAgregar() {
        return cantidadSelector > 0 ? cantidadSelector : 1;
    }

    function agregarProductoAlCarrito(producto, cantidadSolicitada) {
        if (!producto) return;

        if (producto.cantidad <= 0) {
            alert(`El producto "${producto.nombre}" no tiene existencias disponibles.`);
            return;
        }

        const existente = carrito.find((item) => item.id === producto.id);
        const cantidadActualEnCarrito = existente ? existente.cantidad : 0;
        const nuevaCantidadTotal = cantidadActualEnCarrito + cantidadSolicitada;

        if (nuevaCantidadTotal > producto.cantidad) {
            alert(
                `Stock insuficiente para "${producto.nombre}". Solo hay ${producto.cantidad} disponibles.`
            );
            return;
        }

        if (existente) {
            existente.cantidad = nuevaCantidadTotal;
            existente.stockMax = producto.cantidad;
        } else {
            carrito.push({
                id: producto.id,
                codigo_consulta: producto.codigo_consulta,
                nombre: producto.nombre,
                precio: Number(producto.precio),
                stockMax: producto.cantidad,
                cantidad: cantidadSolicitada
            });
        }

        actualizarContadorVisual(0);
        renderizarCarrito();
    }

    function cambiarCantidadItemCarrito(productoId, delta) {
        const indice = carrito.findIndex((item) => item.id === productoId);
        if (indice === -1) return;

        const item = carrito[indice];
        const nuevaCantidad = item.cantidad + delta;

        if (nuevaCantidad <= 0) {
            carrito.splice(indice, 1);
        } else if (nuevaCantidad > item.stockMax) {
            alert(`Solo hay ${item.stockMax} piezas disponibles de "${item.nombre}".`);
            return;
        } else {
            item.cantidad = nuevaCantidad;
        }

        renderizarCarrito();
    }

    function renderizarCarrito() {
        if (carrito.length === 0) {
            estadoVacio.style.display = "";
            listaCarrito.style.display = "none";
            listaCarrito.innerHTML = "";
            notaVenta.style.display = "";

            spanSubtotal.textContent = "$0.00";
            spanIvaEtiqueta.textContent = "IVA (0) %";
            spanIva.textContent = "$0.00";
            strongTotal.textContent = "$0.00";
            btnPagar.textContent = "Pagar $0.00";
            btnPagar.disabled = true;
            btnVaciar.disabled = true;
            return;
        }

        estadoVacio.style.display = "none";
        notaVenta.style.display = "none";
        listaCarrito.style.display = "flex";
        listaCarrito.innerHTML = "";

        let subtotal = 0;

        carrito.forEach((item) => {
            const importe = Number((item.precio * item.cantidad).toFixed(2));
            subtotal = Number((subtotal + importe).toFixed(2));

            const fila = document.createElement("div");
            fila.style.display = "flex";
            fila.style.justifyContent = "space-between";
            fila.style.alignItems = "center";
            fila.style.gap = "0.5rem";
            fila.style.padding = "0.55rem 0.65rem";
            fila.style.borderRadius = "10px";
            fila.style.background = "#fdf8f6";
            fila.style.border = "1px solid #eedad5";

            fila.innerHTML = `
                <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 600; font-size: 0.92rem; color: #3a1f1d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${item.nombre}
                    </div>
                    <div style="font-size: 0.8rem; color: #7b5e5b;">
                        $${formatoMoneda.format(item.precio)} c/u · <strong>$${formatoMoneda.format(importe)}</strong>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <button type="button" class="btn-item-menos" data-id="${item.id}" style="width: 26px; height: 26px; border-radius: 6px; border: 1px solid #d9b8b2; background: #fff; cursor: pointer; font-weight: 700;">−</button>
                    <span style="min-width: 20px; text-align: center; font-weight: 600; font-size: 0.9rem;">${item.cantidad}</span>
                    <button type="button" class="btn-item-mas" data-id="${item.id}" style="width: 26px; height: 26px; border-radius: 6px; border: 1px solid #d9b8b2; background: #fff; cursor: pointer; font-weight: 700;">+</button>
                </div>
            `;
            listaCarrito.appendChild(fila);
        });

        const iva = 0;
        const total = Number((subtotal + iva).toFixed(2));
        const totalTexto = `$${formatoMoneda.format(total)}`;

        spanSubtotal.textContent = `$${formatoMoneda.format(subtotal)}`;
        spanIvaEtiqueta.textContent = "IVA (0) %";
        spanIva.textContent = `$${formatoMoneda.format(iva)}`;
        strongTotal.textContent = totalTexto;
        btnPagar.textContent = `Pagar ${totalTexto}`;
        btnPagar.disabled = false;
        btnVaciar.disabled = false;
    }

    listaCarrito.addEventListener("click", (e) => {
        const btnMenos = e.target.closest(".btn-item-menos");
        if (btnMenos) {
            cambiarCantidadItemCarrito(Number(btnMenos.dataset.id), -1);
            return;
        }
        const btnMas = e.target.closest(".btn-item-mas");
        if (btnMas) {
            cambiarCantidadItemCarrito(Number(btnMas.dataset.id), 1);
        }
    });

    function renderizarProductos(productos) {
        rejillaProductos.innerHTML = "";

        if (!productos || productos.length === 0) {
            rejillaProductos.innerHTML = `
                <p style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: #7b5e5b;">
                    No se encontraron productos activos.
                </p>
            `;
            return;
        }

        productos.forEach((prod) => {
            const card = document.createElement("article");
            card.className = "tarjeta-producto";
            card.dataset.id = String(prod.id);
            card.style.cursor = prod.cantidad > 0 ? "pointer" : "not-allowed";
            if (prod.cantidad <= 0) {
                card.style.opacity = "0.55";
            }

            const srcImagen = prod.tieneImagen
                ? `/api/productos/${prod.id}/imagen`
                : "imagenes/logo-dolcetto-md.svg";

            card.innerHTML = `
                <div class="foto-producto">
                    <img src="${srcImagen}" alt="${prod.nombre}" onerror="this.src='imagenes/logo-dolcetto-md.svg'" />
                </div>
                <span class="codigo-prod">(${prod.codigo_consulta})</span>
                <h3>${prod.nombre}</h3>
                <p class="stock">${prod.cantidad} disponibles</p>
                <strong class="precio">$${formatoMoneda.format(Number(prod.precio || 0))}</strong>
            `;

            card.addEventListener("click", () => {
                const cant = obtenerCantidadParaAgregar();
                agregarProductoAlCarrito(prod, cant);
                inputCodigo.focus();
            });

            rejillaProductos.appendChild(card);
        });
    }

    async function cargarProductos(filtroNombre = "") {
        try {
            const url = filtroNombre
                ? `/api/venta-operador/productos?q=${encodeURIComponent(filtroNombre)}`
                : "/api/venta-operador/productos";

            const resp = await fetch(url);
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                throw new Error(datos.mensaje || "Error al cargar catálogo.");
            }

            catalogoProductos = datos.productos || [];
            renderizarProductos(catalogoProductos);
        } catch (error) {
            console.error("Error al cargar productos:", error);
            rejillaProductos.innerHTML = `
                <p style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: #b42318;">
                    No se pudieron cargar los productos desde la base de datos.
                </p>
            `;
        }
    }

    // Lectura con escáner de código de barras / QR (al presionar Enter o terminar el escaneo)
    inputCodigo.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        const codigoEscaneado = inputCodigo.value.trim();
        if (!codigoEscaneado) return;

        inputCodigo.value = "";
        const cant = obtenerCantidadParaAgregar();

        // Primero busca en memoria si ya está cargado; si no, consulta directo a SQLite
        const enMemoria = catalogoProductos.find(
            (p) => p.codigo_consulta.toLowerCase() === codigoEscaneado.toLowerCase()
        );
        if (enMemoria) {
            agregarProductoAlCarrito(enMemoria, cant);
            inputCodigo.focus();
            return;
        }

        try {
            const resp = await fetch(
                `/api/venta-operador/codigo/${encodeURIComponent(codigoEscaneado)}`
            );
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                alert(datos.mensaje || `No se encontró el código "${codigoEscaneado}".`);
                inputCodigo.focus();
                return;
            }

            agregarProductoAlCarrito(datos.producto, cant);
        } catch (error) {
            console.error("Error al escanear código:", error);
            alert("No se pudo consultar el código escaneado.");
        } finally {
            inputCodigo.focus();
        }
    });

    // Búsqueda en tiempo real por nombre
    inputBuscarNombre.addEventListener("input", () => {
        clearTimeout(timerBusqueda);
        timerBusqueda = setTimeout(() => {
            cargarProductos(inputBuscarNombre.value.trim());
        }, 180);
    });

    // Vaciar carrito
    btnVaciar.addEventListener("click", () => {
        if (carrito.length === 0) return;
        carrito = [];
        actualizarContadorVisual(0);
        renderizarCarrito();
        inputCodigo.focus();
    });

    // Cobrar y guardar venta en SQLite
    btnPagar.addEventListener("click", async () => {
        if (carrito.length === 0) return;

        const usuarioSesion = obtenerUsuarioSesion();
        if (!usuarioSesion || !usuarioSesion.id) {
            alert("No se detectó la sesión del operador. Inicia sesión nuevamente.");
            window.location.replace("index.html");
            return;
        }

        const payload = {
            usuarioId: usuarioSesion.id,
            items: carrito.map((item) => ({
                productoId: item.id,
                cantidad: item.cantidad
            }))
        };

        try {
            btnPagar.disabled = true;
            btnPagar.textContent = "Registrando venta...";

            const resp = await fetch("/api/venta-operador/cobrar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                alert(datos.mensaje || "No se pudo registrar la venta.");
                renderizarCarrito();
                return;
            }

            // Deja disponible la venta recién guardada para el módulo de impresión de ticket
            window.ultimaVentaDolcetto = datos.venta;
            window.dispatchEvent(
                new CustomEvent("dolcetto:venta-completada", { detail: datos.venta })
            );

            alert(
                `Venta ${datos.venta.folioFormateado} registrada por $${formatoMoneda.format(datos.venta.total)}.`
            );

            carrito = [];
            actualizarContadorVisual(0);
            renderizarCarrito();
            await cargarProductos(inputBuscarNombre.value.trim());
            inputCodigo.focus();
        } catch (error) {
            console.error("Error al cobrar venta:", error);
            alert("Error de conexión al intentar registrar la venta.");
            renderizarCarrito();
        }
    });

    // Inicializar vista
    renderizarCarrito();
    cargarProductos().then(() => {
        inputCodigo.focus();
    });
});