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

    function obtenerEnlaceMovimiento(mov, folioTexto) {
        if (mov.tipo === "Venta") {
            return `historial_ventas.html?folio=${encodeURIComponent(folioTexto)}`;
        }
        if (mov.tipo === "Compra") {
            return "compra_historial.html";
        }
        return "devolucion_historial.html";
    }

    function renderizarIndicadores(indicadores) {
        spanVentasHoy.textContent = formatoMoneda.format(Number(indicadores.ventasHoy || 0));
        spanTicketsEmitidos.textContent = Number(indicadores.ticketsEmitidos || 0);
        spanProductosActivos.textContent = Number(indicadores.productosActivos || 0);
        spanAlertasStock.textContent = Number(indicadores.alertasStock || 0);
    }

    function renderizarInventarioBajo(listaBajo) {
        tbodyInvBajo.innerHTML = "";

        if (!listaBajo || listaBajo.length === 0) {
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

    function renderizarMovimientos() {
        tbodyMovimientos.innerHTML = "";

        if (todosLosMovimientos.length === 0) {
            tbodyMovimientos.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 1.25rem;">
                        Aún no hay movimientos registrados en la base de datos.
                    </td>
                </tr>
            `;
            return;
        }

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
            const urlDestino = obtenerEnlaceMovimiento(mov, folioTexto);

            tr.innerHTML = `
                <td class="col_folio">${folioTexto}</td>
                <td class="col_tipo"><span class="chip ${claseChip}">${mov.tipo}</span></td>
                <td class="col_usuario">${mov.usuario}</td>
                <td class="col_fecha">${mov.fecha_hora}</td>
                <td class="col_total al_derecha">$${formatoMoneda.format(Number(mov.total || 0))}</td>
                <td class="col_accion">
                    <a class="enlace_flecha" href="${urlDestino}" aria-label="Ver detalle de ${folioTexto}">›</a>
                </td>
            `;
            tbodyMovimientos.appendChild(tr);
        });

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
        try {
            const respuesta = await fetch(`/api/inicio?umbral=${UMBRAL_STOCK_BAJO}`);
            const datos = await respuesta.json();

            if (!respuesta.ok || !datos.ok) {
                throw new Error(datos.mensaje || "Error al consultar el servidor.");
            }

            renderizarIndicadores(datos.indicadores);
            todosLosMovimientos = datos.movimientos || [];
            renderizarMovimientos();
            renderizarInventarioBajo(datos.inventarioBajo || []);
        } catch (error) {
            console.error("Error al inicializar inicio_admin:", error);
            tbodyMovimientos.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 1.25rem; color: #b42318;">
                        No se pudieron cargar los movimientos desde la base de datos.
                    </td>
                </tr>
            `;
            tbodyInvBajo.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 1.25rem; color: #b42318;">
                        No se pudo cargar el inventario bajo.
                    </td>
                </tr>
            `;
        }
    }

    inicializarInicio();
});