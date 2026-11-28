document.addEventListener("DOMContentLoaded", () => {
    const formUsuario = document.querySelector(".usuarios-formulario");
    const inputUsuario = document.getElementById("nuevo-usuario");
    const inputContrasena = document.getElementById("nueva-contrasena");
    const btnGuardar = formUsuario.querySelector(".btn-primario");
    const btnLimpiar = formUsuario.querySelector(".btn-secundario");
    const tituloFormulario = document.querySelector(".usuarios-tarjeta .usuarios-titulo");

    const chipConteo = document.querySelector(".chip-conteo");
    const tbodyUsuarios = document.querySelector(".usuarios-tabla tbody");

    let idEditando = null;

    function resetearModoFormulario() {
        idEditando = null;
        tituloFormulario.textContent = "Agregar nuevo usuario";
        btnGuardar.textContent = "Guardar";
        inputContrasena.placeholder = "Escribe la contraseña";
        formUsuario.reset();
    }

    function renderizarTablaUsuarios(usuarios) {
        tbodyUsuarios.innerHTML = "";
        const total = usuarios.length;
        chipConteo.textContent = total === 1 ? "1 usuario" : `${total} usuarios`;

        if (total === 0) {
            tbodyUsuarios.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 1.25rem;">
                        No hay usuarios registrados.
                    </td>
                </tr>
            `;
            return;
        }

        usuarios.forEach((u) => {
            const tr = document.createElement("tr");
            const esAdminPrincipal = u.usuario === "admin";

            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.usuario} ${u.rol === "admin" ? '<span class="chip chip_ok">Admin</span>' : ""}</td>
                <td>••••••••</td>
                <td class="col-acciones">
                    <div class="usuarios-acciones">
                        <button type="button" class="btn-tabla-editar" data-id="${u.id}" data-usuario="${u.usuario}" title="Editar">
                            <img src="imagenes/lapiz.png" alt="Editar" class="icono_btn">
                        </button>
                        ${
                            esAdminPrincipal
                                ? ""
                                : `<button type="button" class="btn-tabla-eliminar" data-id="${u.id}" data-usuario="${u.usuario}">Eliminar</button>`
                        }
                    </div>
                </td>
            `;
            tbodyUsuarios.appendChild(tr);
        });
    }

    async function cargarUsuarios() {
        try {
            const resp = await fetch("/api/usuarios");
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                throw new Error(datos.mensaje || "Error al cargar usuarios.");
            }

            renderizarTablaUsuarios(datos.usuarios || []);
        } catch (error) {
            console.error("Error al consultar usuarios:", error);
            tbodyUsuarios.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 1.25rem; color: #b42318;">
                        No se pudieron cargar los usuarios desde la base de datos.
                    </td>
                </tr>
            `;
        }
    }

    formUsuario.addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuario = inputUsuario.value.trim();
        const password = inputContrasena.value;

        if (!usuario) {
            alert("Ingresa el nombre de usuario.");
            inputUsuario.focus();
            return;
        }

        if (!idEditando && !password) {
            alert("Ingresa una contraseña para el nuevo usuario.");
            inputContrasena.focus();
            return;
        }

        const url = idEditando ? `/api/usuarios/${idEditando}` : "/api/usuarios";
        const metodo = idEditando ? "PUT" : "POST";

        try {
            btnGuardar.disabled = true;
            const resp = await fetch(url, {
                method: metodo,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, password })
            });
            const datos = await resp.json();

            if (!resp.ok || !datos.ok) {
                alert(datos.mensaje || "No se pudo guardar el usuario.");
                if (datos.campo === "password") {
                    inputContrasena.focus();
                } else {
                    inputUsuario.focus();
                }
                return;
            }

            resetearModoFormulario();
            await cargarUsuarios();
        } catch (error) {
            console.error("Error al guardar usuario:", error);
            alert("Ocurrió un error de conexión al guardar el usuario.");
        } finally {
            btnGuardar.disabled = false;
        }
    });

    btnLimpiar.addEventListener("click", () => {
        setTimeout(() => {
            resetearModoFormulario();
        }, 0);
    });

    tbodyUsuarios.addEventListener("click", async (e) => {
        const btnEditar = e.target.closest(".btn-tabla-editar");
        if (btnEditar) {
            idEditando = btnEditar.dataset.id;
            inputUsuario.value = btnEditar.dataset.usuario;
            inputContrasena.value = "";
            inputContrasena.placeholder = "Nueva contraseña (opcional)";
            tituloFormulario.textContent = `Editando usuario: ${btnEditar.dataset.usuario}`;
            btnGuardar.textContent = "Actualizar";
            inputUsuario.focus();
            return;
        }

        const btnEliminar = e.target.closest(".btn-tabla-eliminar");
        if (btnEliminar) {
            const id = btnEliminar.dataset.id;
            const nombreUsuario = btnEliminar.dataset.usuario;

            const confirmado = confirm(`¿Seguro que deseas eliminar al usuario "${nombreUsuario}"?`);
            if (!confirmado) return;

            try {
                const resp = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
                const datos = await resp.json();

                if (!resp.ok || !datos.ok) {
                    alert(datos.mensaje || "No se pudo eliminar el usuario.");
                    return;
                }

                if (idEditando === id) {
                    resetearModoFormulario();
                }
                await cargarUsuarios();
            } catch (error) {
                console.error("Error al eliminar usuario:", error);
                alert("Ocurrió un error de conexión al eliminar el usuario.");
            }
        }
    });

    cargarUsuarios();
});