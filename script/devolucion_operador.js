document.addEventListener("DOMContentLoaded", () => {
    const main = document.querySelector("main.dol_contenedor");
    const pasos = main.querySelectorAll(".dol_pasos .dol_paso");
    const seccionesPaso1 = main.querySelectorAll("section.tarjeta-seccion");

    const formBuscar = main.querySelector(".form-buscar");
    const inputFolio = document.getElementById("folio-venta");
    const inputFecha = document.getElementById("fecha-venta");
    const tbodyVentas = seccionesPaso1[1].querySelector("tbody");
    const contenedorPaginacion = seccionesPaso1[1].querySelector(".dol_paginacion");

    
    const contenedorPaso2 = document.createElement("div");
    contenedorPaso2.id = "paso-2-devolucion";
    contenedorPaso2.style.display = "none";
    contenedorPaso2.innerHTML = `
        <section class="tarjeta bloque_compra" aria-labelledby="titulo_venta">
            <h2 class="titulo_bloque" id="titulo_venta">Venta seleccionada</h2>
            <div class="datos_venta">
                <div class="dato_item"><span>Folio</span><strong id="dev-folio-venta">-</strong></div>
                <div class="dato_item"><span>Fecha / hora</span><strong id="dev-fecha-venta">-</strong></div>
                <div class="dato_item"><span>Cajero</span><strong id="dev-cajero-venta">-</strong></div>
                <div class="dato_item"><span>Total</span><strong class="total_rojo" id="dev-total-venta">$0.00</strong></div>
            </div>
        </section>

        <section class="tarjeta bloque_tabla tabla_devolucion" aria-labelledby="titulo_productos">
            <div class="bloque_titulo">
                <h2 class="titulo_bloque" id="titulo_productos">Productos a devolver</h2>
            </div>
            <div class="tabla_scroll">
                <table class="tabla">
                    <thead>
                        <tr>
                            <th class="col_codigo" scope="col">Código</th>
                            <th class="col_producto" scope="col">Producto</th>
                            <th class="col_cantidad" scope="col">Vendido</th>
                            <th class="col_cantidad" scope="col">Ya devuelto</th>
                            <th class="col_cantidad" scope="col">Disponible</th>
                            <th class="col_cantidad" scope="col">Cantidad a devolver</th>
                            <th class="col_total al_derecha" scope="col">Importe ajustado</th>
                            <th class="col_motivo" scope="col">Motivo</th>
                        </tr>
                    </thead>
                    <tbody id="cuerpo_devolucion_op"></tbody>
                </table>
            </div>
            <p class="nota nota_tabla">La cantidad a devolver no puede superar lo disponible.</p>
            <p class="msj_error oculto" id="msj_error_dev">La cantidad supera lo vendido menos las devoluciones anteriores.</p>
            <div class="barra_total barra_pad">
                <div class="resumen_devolucion">
                    <p>Unidades a devolver <strong id="unidades_dev_op">0</strong></p>
                    <p>Importe a devolver <span class="dato_grande">$<span id="importe_dev_op">0.00</span></span></p>
                </div>
                <div class="acciones_total">
                    <button type="button" class="boton_sec" id="btn-cancelar-dev">Cancelar</button>
                    <button type="button" class="boton_ok" id="btn-confirmar-dev">Confirmar devolución</button>
                </div>
            </div>
        </section>
    `;
    main.appendChild(contenedorPaso2);

    const elFolioVenta = document.getElementById("dev-folio-venta");
    const elFechaVenta = document.getElementById("dev-fecha-venta");
    const elCajeroVenta = document.getElementById("dev-cajero-venta");
    const elTotalVenta = document.getElementById("dev-total-venta");
    const tbodyDetalle = document.getElementById("cuerpo_devolucion_op");
    const elUnidadesDev = document.getElementById("unidades_dev_op");
    const elImporteDev = document.getElementById("importe_dev_op");
    const msjErrorDev = document.getElementById("msj_error_dev");
    const btnCancelarDev = document.getElementById("btn-cancelar-dev");
    const btnConfirmarDev = document.getElementById("btn-confirmar-dev");

    let paginaActual = 1;
    let ventaSeleccionada = null;
    let renglonesDevolucion = [];

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

    function mostrarPaso(numeroPaso) {
        if (numeroPaso === 1) {
            pasos[0].classList.add("activo");
            pasos[1].classList.remove("activo");
            seccionesPaso1.forEach((sec) => (sec.style.display = ""));
            contenedorPaso2.style.display = "none";
            ventaSeleccionada = null;
            renglonesDevolucion = [];
        } else {
            pasos[0].classList.remove("activo");
            pasos[1].classList.add("activo");
            seccionesPaso1.forEach((sec) => (sec.style.display = "none"));
            contenedorPaso2.style.display = "";
        }
    }

    function renderizarPaginacion(paginacion) {
        contenedorPaginacion.innerHTML = "";
        const { pagina, totalPaginas } = paginacion;

        const btnPrev = document.createElement("button");
        btnPrev.type = "button";
        btnPrev.className = "btn-pag";
        btnPrev.textContent = "‹";
        btnPrev.disabled = pagina <= 1;
        btnPrev.addEventListener("click", () => {
            if (pagina > 1) cargarVentas(pagina - 1);
        });
        contenedorPaginacion.appendChild(btnPrev);

        for (let p = 1; p <= totalPaginas; p++) {
            const btnNum = document.createElement("button");
            btnNum.type = "button";
            btnNum.className = p === pagina ? "btn-pag activa" : "btn-pag";
            btnNum.textContent = String(p);
            btnNum.addEventListener("click", () => {
                if (p !== pagina) cargarVentas(p);
            });
            contenedorPaginacion.appendChild(btnNum);
        }

        const btnNext = document.createElement("button");
        btnNext.type = "button";
        btnNext.className = "btn-pag";
        btnNext.textContent = "›";
        btnNext.disabled = pagina >= totalPaginas;
        btnNext.addEventListener("click", () => {
            if (pagina < totalPaginas) cargarVentas(pagina + 1);
        });
        contenedorPaginacion.appendChild(btnNext);
    }

    function renderizarTablaVentas(ventas) {
        tbodyVentas.innerHTML = "";

        if (!ventas || ventas.length === 0) {
            tbodyVentas.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 1.25rem;">
                        No se encontraron ventas con esos criterios.
                    </td>
                </tr>
            `;
            return;
        }

        ventas.forEach((v) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${v.folioFormateado}</td>
                <td>${v.fecha_hora}</td>
                <td>${v.cajero}</td>
                <td>$${formatoMoneda.format(v.total)}</td>
                <td>
                    <button type="button" class="btn-seleccionar" data-folio="${v.folio}">Seleccionar</button>
                </td>
            `;
            tbodyVentas.appendChild(tr);
        });
    }

    async function cargarVentas(pagina = 1) {
        paginaActual = pagina;
        const params = new URLSearchParams();
        const folio = inputFolio.value.trim();
        const fecha = inputFecha.value;

        if (folio) params.set("folio", folio);
        if (fecha) params.set("fecha", fecha);
        params.set("pagina", String(pagina));
        params.set("limite", "5");

        try {
            const resp = await fetch(`/api/devoluciones/ventas?${params.toString()}`);
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                throw new Error(datos.mensaje || "Error al buscar ventas.");
            }

            renderizarTablaVentas(datos.ventas || []);
            renderizarPaginacion(datos.paginacion || { pagina: 1, totalPaginas: 1 });
        } catch (error) {
            console.error("Error al consultar ventas:", error);
            tbodyVentas.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 1.25rem; color: #b42318;">
                        No se pudieron cargar las ventas desde la base de datos.
                    </td>
                </tr>
            `;
        }
    }

    function actualizarTotalesPaso2() {
        let totalUnidades = 0;
        let totalImporte = 0;

        renglonesDevolucion.forEach((r) => {
            totalUnidades += r.cantidadDevolver;
            totalImporte = Number((totalImporte + r.cantidadDevolver * r.precio_unitario).toFixed(2));
        });

        elUnidadesDev.textContent = String(totalUnidades);
        elImporteDev.textContent = formatoMoneda.format(totalImporte);
        btnConfirmarDev.disabled = totalUnidades <= 0;
    }

    function renderizarDetallePaso2() {
        elFolioVenta.textContent = ventaSeleccionada.folioFormateado;
        elFechaVenta.textContent = ventaSeleccionada.fecha_hora;
        elCajeroVenta.textContent = ventaSeleccionada.cajero;
        elTotalVenta.textContent = `$${formatoMoneda.format(ventaSeleccionada.total)}`;

        tbodyDetalle.innerHTML = "";
        msjErrorDev.classList.add("oculto");

        renglonesDevolucion.forEach((item, idx) => {
            const tr = document.createElement("tr");
            const importeFila = Number((item.cantidadDevolver * item.precio_unitario).toFixed(2));
            const sinDisponibles = item.disponible <= 0;

            tr.innerHTML = `
                <td class="col_codigo">${item.codigo_consulta}</td>
                <td class="col_producto">${item.nombre}</td>
                <td class="col_cantidad">${item.vendido}</td>
                <td class="col_cantidad">${item.ya_devuelto}</td>
                <td class="col_cantidad">${item.disponible}</td>
                <td class="col_cantidad">
                    <div class="control_cantidad">
                        <button type="button" class="btn-dev-menos" data-idx="${idx}" ${sinDisponibles ? "disabled" : ""} aria-label="Reducir cantidad">−</button>
                        <span class="cant-dev-valor">${item.cantidadDevolver}</span>
                        <button type="button" class="btn-dev-mas" data-idx="${idx}" ${sinDisponibles ? "disabled" : ""} aria-label="Aumentar cantidad">+</button>
                    </div>
                </td>
                <td class="col_total al_derecha">$${formatoMoneda.format(importeFila)}</td>
                <td class="col_motivo">
                    <select class="campo_texto sel-motivo-dev" data-idx="${idx}" ${sinDisponibles ? "disabled" : ""}>
                        <option value="producto_danado" ${item.motivo === "producto_danado" ? "selected" : ""}>Producto dañado</option>
                        <option value="error_cobro" ${item.motivo === "error_cobro" ? "selected" : ""}>Error de cobro</option>
                        <option value="producto_equivocado" ${item.motivo === "producto_equivocado" ? "selected" : ""}>Producto equivocado</option>
                        <option value="otro" ${item.motivo === "otro" ? "selected" : ""}>Otro</option>
                    </select>
                    <input
                        class="campo_texto motivo_otro inp-motivo-otro"
                        data-idx="${idx}"
                        type="text"
                        placeholder="Escribe el motivo"
                        maxlength="120"
                        value="${item.motivoOtro}"
                        style="display: ${item.motivo === "otro" ? "block" : "none"}; margin-top: 0.4rem;"
                        ${sinDisponibles ? "disabled" : ""}
                    />
                </td>
            `;
            tbodyDetalle.appendChild(tr);
        });

        actualizarTotalesPaso2();
    }

    async function seleccionarVenta(folio) {
        try {
            const resp = await fetch(`/api/devoluciones/venta/${encodeURIComponent(folio)}`);
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                alert(datos.mensaje || "No se pudo cargar el detalle de la venta.");
                return;
            }

            ventaSeleccionada = datos.venta;
            renglonesDevolucion = (datos.venta.items || []).map((item) => ({
                ...item,
                cantidadDevolver: 0,
                motivo: "producto_danado",
                motivoOtro: ""
            }));

            mostrarPaso(2);
            renderizarDetallePaso2();
        } catch (error) {
            console.error("Error al seleccionar venta:", error);
            alert("Error de conexión al cargar los productos de la venta.");
        }
    }

    // Eventos Paso 1
    formBuscar.addEventListener("submit", (e) => {
        e.preventDefault();
        cargarVentas(1);
    });

    tbodyVentas.addEventListener("click", (e) => {
        const btnSel = e.target.closest(".btn-seleccionar");
        if (!btnSel) return;
        seleccionarVenta(btnSel.dataset.folio);
    });

    // Eventos Paso 2
    tbodyDetalle.addEventListener("click", (e) => {
        const btnMenos = e.target.closest(".btn-dev-menos");
        if (btnMenos) {
            const idx = Number(btnMenos.dataset.idx);
            const item = renglonesDevolucion[idx];
            if (item && item.cantidadDevolver > 0) {
                item.cantidadDevolver--;
                msjErrorDev.classList.add("oculto");
                renderizarDetallePaso2();
            }
            return;
        }

        const btnMas = e.target.closest(".btn-dev-mas");
        if (btnMas) {
            const idx = Number(btnMas.dataset.idx);
            const item = renglonesDevolucion[idx];
            if (!item) return;

            if (item.cantidadDevolver >= item.disponible) {
                msjErrorDev.classList.remove("oculto");
                return;
            }
            item.cantidadDevolver++;
            msjErrorDev.classList.add("oculto");
            renderizarDetallePaso2();
        }
    });

    tbodyDetalle.addEventListener("change", (e) => {
        const sel = e.target.closest(".sel-motivo-dev");
        if (!sel) return;
        const idx = Number(sel.dataset.idx);
        const item = renglonesDevolucion[idx];
        if (!item) return;

        item.motivo = sel.value;
        renderizarDetallePaso2();
    });

    tbodyDetalle.addEventListener("input", (e) => {
        const inp = e.target.closest(".inp-motivo-otro");
        if (!inp) return;
        const idx = Number(inp.dataset.idx);
        const item = renglonesDevolucion[idx];
        if (item) {
            item.motivoOtro = inp.value;
        }
    });

    btnCancelarDev.addEventListener("click", () => {
        mostrarPaso(1);
    });

    btnConfirmarDev.addEventListener("click", async () => {
        if (!ventaSeleccionada) return;

        const usuarioSesion = obtenerUsuarioSesion();
        if (!usuarioSesion || !usuarioSesion.id) {
            alert("No se detectó la sesión del operador. Inicia sesión nuevamente.");
            window.location.replace("index.html");
            return;
        }

        const itemsAEnviar = renglonesDevolucion
            .filter((r) => r.cantidadDevolver > 0)
            .map((r) => ({
                productoId: r.producto_id,
                cantidad: r.cantidadDevolver,
                motivo: r.motivo,
                motivoOtro: r.motivoOtro
            }));

        if (itemsAEnviar.length === 0) {
            alert("Aumenta la cantidad a devolver de al menos un producto.");
            return;
        }

        for (const it of itemsAEnviar) {
            if (it.motivo === "otro" && !it.motivoOtro.trim()) {
                alert("Escribe el motivo específico en los productos marcados con 'Otro'.");
                return;
            }
        }

        try {
            btnConfirmarDev.disabled = true;
            btnConfirmarDev.textContent = "Registrando...";

            const resp = await fetch("/api/devoluciones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ventaFolio: ventaSeleccionada.folio,
                    usuarioId: usuarioSesion.id,
                    items: itemsAEnviar
                })
            });
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                alert(datos.mensaje || "No se pudo registrar la devolución.");
                btnConfirmarDev.disabled = false;
                btnConfirmarDev.textContent = "Confirmar devolución";
                return;
            }

            // Deja disponible el comprobante para el mOdulo de impresiOn
            window.ultimaDevolucionDolcetto = datos.devolucion;
            window.dispatchEvent(
                new CustomEvent("dolcetto:devolucion-completada", { detail: datos.devolucion })
            );

            alert(
                `Devolución ${datos.devolucion.folioFormateado} registrada por $${formatoMoneda.format(
                    datos.devolucion.total_devuelto
                )}. El stock fue reingresado al inventario.`
            );

            btnConfirmarDev.textContent = "Confirmar devolución";
            mostrarPaso(1);
            await cargarVentas(paginaActual);
        } catch (error) {
            console.error("Error al confirmar devolución:", error);
            alert("Error de conexión al registrar la devolución.");
            btnConfirmarDev.disabled = false;
            btnConfirmarDev.textContent = "Confirmar devolución";
        }
    });

    // Cargar listado inicial de ventas
    mostrarPaso(1);
    cargarVentas(1);
});