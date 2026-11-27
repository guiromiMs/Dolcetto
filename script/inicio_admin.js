document.addEventListener("DOMContentLoaded", () => {
    const spanVentasHoy = document.getElementById("ventas_hoy");
    const spanTicketsEmitidos = document.getElementById("tickets_emitidos");
    const spanProductosActivos = document.getElementById("productos_activos");
    const spanAlertasStock = document.getElementById("alertas_stock");

    const tbodyMovimientos = document.getElementById("cuerpo_movimientos");
    const tbodyInvBajo = document.getElementById("cuerpo_inv_bajo");

    const LIMITE_MOVIMIENTOS_INICIAL = 5;
    const UMBRAL_STOCK_BAJO = 10;

    let todosLosMovimientos = [];
    let mostrandoTodosMovimientos = false;

    const formatoMoneda = new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function formatearFolio(prefijo, numero) {
        return `${prefijo}-${String(numero).padStart(4, "0")}`;
    }

    function obtenerClaseChipTipo(tipo) {
        if (tipo === "Venta") return "chip_ok";
        if (tipo === "Compra") return "chip_info";
        return "chip_bajo";
    }

    function actualizarSeccionProductos(productos) {
        // Productos activos que sí tienen existencia (> 0)
        const activosConExistencia = productos.filter(
            (p) => p.estado === "activo" && Number(p.cantidad) > 0
        );

        // Productos activos con stock bajo (<= 10 en existencia)
        const productosStockBajo = productos.filter(
            (p) => p.estado === "activo" && Number(p.cantidad) <= UMBRAL_STOCK_BAJO
        );

        spanProductosActivos.textContent = activosConExistencia.length;
        spanAlertasStock.textContent = productosStockBajo.length;

        renderizarInventarioBajo(productosStockBajo);
    }

    function renderizarInventarioBajo(listaBajo) {
        tbodyInvBajo.innerHTML = "";

        if (listaBajo.length === 0) {
            tbodyInvBajo.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 1.25rem;">
                        No hay productos con stock bajo en este momento.
                    </td>
                </tr>
            `;
            return;
        }

        listaBajo.forEach((prod) => {
            const tr = document.createElement("tr");
            const codigoUrl = encodeURIComponent(prod.codigo_consulta);

            tr.innerHTML = `
                <td class="col_codigo">${prod.codigo_consulta}</td>
                <td class="col_producto">${prod.nombre}</td>
                <td class="col_existencia"><span class="chip chip_bajo">${prod.cantidad} pzas.</span></td>
                <td class="col_compra">
                    <a class="boton_prin boton_compra" href="compra.html?codigo=${codigoUrl}">Registrar compra</a>
                </td>
            `;
            tbodyInvBajo.appendChild(tr);
        });
    }

    function actualizarSeccionMovimientos(movimientos, fechaHoy) {
        todosLosMovimientos = movimientos;

        // Ventas del día actual
        const ventasDeHoy = movimientos.filter(
            (m) => m.tipo === "Venta" && m.fecha_hora.startsWith(fechaHoy)
        );

        const totalVentasHoy = ventasDeHoy.reduce((acum, v) => acum + Number(v.total), 0);

        spanVentasHoy.textContent = formatoMoneda.format(totalVentasHoy);
        spanTicketsEmitidos.textContent = ventasDeHoy.length;

        renderizarMovimientos();
    }

    function renderizarMovimientos() {
        tbodyMovimientos.innerHTML = "";

        if (todosLosMovimientos.length === 0) {
            tbodyMovimientos.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 1.25rem;">
                        Aún no hay movimientos registrados.
                    </td>
                </tr>
            `;
            return;
        }

        // Muestra los primeros 5 o todos al desplegar
        const listaVisible = mostrandoTodosMovimientos
            ? todosLosMovimientos
            : todosLosMovimientos.slice(0, LIMITE_MOVIMIENTOS_INICIAL);

        const contenedorScroll = tbodyMovimientos.closest(".tabla_scroll");
        if (contenedorScroll) {
            contenedorScroll.style.maxHeight = mostrandoTodosMovimientos ? "340px" : "";
            contenedorScroll.style.overflowY = mostrandoTodosMovimientos ? "auto" : "";
        }

        listaVisible.forEach((mov) => {
            const tr = document.createElement("tr");
            const folioTexto = formatearFolio(mov.prefijo, mov.folio);
            const claseChip = obtenerClaseChipTipo(mov.tipo);

            tr.innerHTML = `
                <td class="col_folio">${folioTexto}</td>
                <td class="col_tipo"><span class="chip ${claseChip}">${mov.tipo}</span></td>
                <td class="col_usuario">${mov.usuario}</td>
                <td class="col_fecha">${mov.fecha_hora}</td>
                <td class="col_total al_derecha">$${formatoMoneda.format(mov.total)}</td>
                <td class="col_accion">
                    <a class="enlace_flecha" href="historial_ventas.html" aria-label="Ver detalle de ${folioTexto}">›</a>
                </td>
            `;
            tbodyMovimientos.appendChild(tr);
        });

        // Control para deslizar y ver el resto si hay más de 5
        if (todosLosMovimientos.length > LIMITE_MOVIMIENTOS_INICIAL) {
            const trToggle = document.createElement("tr");
            const restantes = todosLosMovimientos.length - LIMITE_MOVIMIENTOS_INICIAL;

            trToggle.innerHTML = `
                <td colspan="6" style="text-align: center; padding: 0.75rem;">
                    <button type="button" id="btn_toggle_movimientos" class="enlace" style="background: none; border: none; cursor: pointer; font: inherit;">
                        ${mostrandoTodosMovimientos
                            ? "Mostrar solo los 5 más recientes ▲"
                            : `Deslizar / ver ${restantes} movimientos más ▼`}
                    </button>
                </td>
            `;
            tbodyMovimientos.appendChild(trToggle);

            document.getElementById("btn_toggle_movimientos").addEventListener("click", () => {
                mostrandoTodosMovimientos = !mostrandoTodosMovimientos;
                renderizarMovimientos();
            });
        }
    }

    async function inicializarInicio() {
        const fechaHoy = InicioBDD.obtenerFechaHoyISO();
        const [productos, movimientos] = await Promise.all([
            InicioBDD.obtenerProductos(),
            InicioBDD.obtenerMovimientos()
        ]);

        actualizarSeccionProductos(productos);
        actualizarSeccionMovimientos(movimientos, fechaHoy);
    }

    inicializarInicio();
});