document.addEventListener("DOMContentLoaded", () => {
    const formFiltros = document.getElementById("form_filtros");
    const chkFolio = document.getElementById("chk_folio");
    const inputFolio = document.getElementById("buscar_folio");

    const chkFecha = document.getElementById("chk_fecha");
    const inputFechaInicial = document.getElementById("fecha_inicial");
    const inputFechaFinal = document.getElementById("fecha_final");

    const chkCajero = document.getElementById("chk_cajero");
    const selCajero = document.getElementById("sel_cajero");

    const btnLimpiar = document.getElementById("btn_limpiar");

    const spanVentasRegistradas = document.getElementById("ventas_registradas");
    const spanTotalFacturado = document.getElementById("total_facturado");
    const tbodyVentas = document.getElementById("cuerpo_ventas");
    const navPaginacion = document.getElementById("paginacion");

    let paginaActual = 1;

    const formatoMoneda = new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    function formatearFolio(numero) {
        return `V-${String(numero).padStart(4, "0")}`;
    }

    function obtenerClaseEstado(estado) {
        if (estado === "Completada") return "chip_ok";
        if (estado === "Dev. parcial") return "chip_info";
        return "chip_bajo";
    }

    inputFolio.addEventListener("input", () => {
        chkFolio.checked = inputFolio.value.trim() !== "";
    });

    [inputFechaInicial, inputFechaFinal].forEach((campoFecha) => {
        campoFecha.addEventListener("change", () => {
            chkFecha.checked = Boolean(inputFechaInicial.value || inputFechaFinal.value);
        });
    });

    selCajero.addEventListener("change", () => {
        chkCajero.checked = selCajero.value !== "";
    });

    chkFolio.addEventListener("change", () => {
        if (!chkFolio.checked) inputFolio.value = "";
    });

    chkFecha.addEventListener("change", () => {
        if (!chkFecha.checked) {
            inputFechaInicial.value = "";
            inputFechaFinal.value = "";
        }
    });

    chkCajero.addEventListener("change", () => {
        if (!chkCajero.checked) selCajero.value = "";
    });

    async function cargarCajeros() {
        try {
            const resp = await fetch("/api/ventas/cajeros");
            const datos = await resp.json();
            if (!resp.ok || !datos.ok) return;

            selCajero.innerHTML = '<option value="">Todos los cajeros</option>';
            datos.cajeros.forEach((c) => {
                const option = document.createElement("option");
                option.value = c.usuario;
                option.textContent = `${c.nombre} (${c.usuario})`;
                selCajero.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar lista de cajeros:", error);
        }
    }

    function construirQueryParams(pagina) {
        const params = new URLSearchParams();
        params.set("pagina", String(pagina));

        if (chkFolio.checked && inputFolio.value.trim()) {
            params.set("folio", inputFolio.value.trim());
        }

        if (chkFecha.checked) {
            if (inputFechaInicial.value) params.set("fechaInicial", inputFechaInicial.value);
            if (inputFechaFinal.value) params.set("fechaFinal", inputFechaFinal.value);
        }

        if (chkCajero.checked && selCajero.value) {
            params.set("cajero", selCajero.value);
        }

        return params.toString();
    }

    function renderizarTablaVentas(ventas) {
        tbodyVentas.innerHTML = "";

        if (!ventas || ventas.length === 0) {
            tbodyVentas.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 1.5rem;">
                        No se encontraron ventas con los filtros seleccionados.
                    </td>
                </tr>
            `;
            return;
        }

        ventas.forEach((venta) => {
            const tr = document.createElement("tr");
            const folioTexto = formatearFolio(venta.folio);
            const claseEstado = obtenerClaseEstado(venta.estado);

            tr.innerHTML = `
                <td class="col_folio">${folioTexto}</td>
                <td class="col_fecha">${venta.fecha_hora}</td>
                <td class="col_cajero">${venta.cajero}</td>
                <td class="col_articulos">${venta.articulos}</td>
                <td class="col_total al_derecha">$${formatoMoneda.format(Number(venta.total || 0))}</td>
                <td class="col_estado"><span class="chip ${claseEstado}">${venta.estado}</span></td>
                <td class="col_acciones">
                    <a class="enlace_accion btn_ver_detalle" href="#" data-folio="${venta.folio}">Ver detalle</a>
                    <span>·</span>
                    <a class="enlace_accion btn_reimprimir" href="#" data-folio="${venta.folio}">Reimprimir</a>
                </td>
            `;
            tbodyVentas.appendChild(tr);
        });
    }

    function renderizarPaginacion(pagina, totalPaginas) {
        navPaginacion.innerHTML = "";

        if (totalPaginas <= 1) return;

        const btnAnterior = document.createElement("a");
        btnAnterior.className = "pag_boton";
        btnAnterior.href = "#";
        btnAnterior.setAttribute("aria-label", "Página anterior");
        btnAnterior.textContent = "‹";
        if (pagina <= 1) {
            btnAnterior.style.opacity = "0.4";
            btnAnterior.style.pointerEvents = "none";
        }
        btnAnterior.addEventListener("click", (e) => {
            e.preventDefault();
            if (pagina > 1) consultarVentas(pagina - 1);
        });
        navPaginacion.appendChild(btnAnterior);

        for (let i = 1; i <= totalPaginas; i++) {
            if (i === pagina) {
                const spanActual = document.createElement("span");
                spanActual.className = "pag_actual";
                spanActual.setAttribute("aria-current", "page");
                spanActual.textContent = String(i);
                navPaginacion.appendChild(spanActual);
            } else {
                const enlacePagina = document.createElement("a");
                enlacePagina.className = "pag_boton";
                enlacePagina.href = "#";
                enlacePagina.textContent = String(i);
                enlacePagina.addEventListener("click", (e) => {
                    e.preventDefault();
                    consultarVentas(i);
                });
                navPaginacion.appendChild(enlacePagina);
            }
        }

        const btnSiguiente = document.createElement("a");
        btnSiguiente.className = "pag_boton";
        btnSiguiente.href = "#";
        btnSiguiente.setAttribute("aria-label", "Página siguiente");
        btnSiguiente.textContent = "›";
        if (pagina >= totalPaginas) {
            btnSiguiente.style.opacity = "0.4";
            btnSiguiente.style.pointerEvents = "none";
        }
        btnSiguiente.addEventListener("click", (e) => {
            e.preventDefault();
            if (pagina < totalPaginas) consultarVentas(pagina + 1);
        });
        navPaginacion.appendChild(btnSiguiente);
    }

    async function consultarVentas(pagina = 1) {
        paginaActual = pagina;
        const query = construirQueryParams(paginaActual);

        try {
            const resp = await fetch(`/api/ventas?${query}`);
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                throw new Error(datos.mensaje || "Error al consultar ventas.");
            }

            spanVentasRegistradas.textContent = Number(datos.resumen.ventasRegistradas || 0);
            spanTotalFacturado.textContent = formatoMoneda.format(
                Number(datos.resumen.totalFacturado || 0)
            );

            renderizarTablaVentas(datos.ventas || []);
            renderizarPaginacion(datos.pagina || 1, datos.totalPaginas || 1);
        } catch (error) {
            console.error("Error al consultar historial de ventas:", error);
            tbodyVentas.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 1.5rem; color: #b42318;">
                        No se pudo cargar el historial de ventas desde la base de datos.
                    </td>
                </tr>
            `;
        }
    }

    formFiltros.addEventListener("submit", (e) => {
        e.preventDefault();
        consultarVentas(1);
    });

    btnLimpiar.addEventListener("click", () => {
        setTimeout(() => {
            if (window.location.search) {
                window.history.replaceState({}, "", window.location.pathname);
            }
            consultarVentas(1);
        }, 0);
    });

    // Deja listos los enlaces de Ver detalle y Reimprimir para que tu compañera agregue su lógica
    tbodyVentas.addEventListener("click", (e) => {
        const enlace = e.target.closest(".btn_ver_detalle, .btn_reimprimir");
        if (enlace) {
            e.preventDefault();
        }
    });

    async function inicializarHistorialVentas() {
        await cargarCajeros();

        const paramsUrl = new URLSearchParams(window.location.search);
        const folioUrl = paramsUrl.get("folio");
        if (folioUrl) {
            chkFolio.checked = true;
            inputFolio.value = folioUrl;
        }

        await consultarVentas(1);
    }

    inicializarHistorialVentas();
});