/**
    inicio_bdd.js
    Capa de conexión / datos para inicio_admin.html
    Cuando conectes server.js con SQLite, solo reemplazarás el interior de estas funciones por fetch().
 */

const InicioBDD = (() => {
    function obtenerFechaHoyISO() {
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, "0");
        const dia = String(hoy.getDate()).padStart(2, "0");
        return `${anio}-${mes}-${dia}`;
    }

    const HOY = obtenerFechaHoyISO();

    // Simulación de tabla PRODUCTOS (codigo_consulta, nombre, precio, cantidad, estado)
    const PRODUCTOS_BD = [
        { id: 1, codigo_consulta: "DUL-0184", nombre: "Manguitos enchilados", precio: 25.00, cantidad: 4, estado: "activo" },
        { id: 2, codigo_consulta: "7501001", nombre: "Gomitas de Mango", precio: 22.00, cantidad: 8, estado: "activo" },
        { id: 3, codigo_consulta: "7501000000011", nombre: "Pastel Tres Leches", precio: 55.00, cantidad: 20, estado: "activo" },
        { id: 4, codigo_consulta: "7501000000022", nombre: "Cheesecake", precio: 65.00, cantidad: 15, estado: "activo" },
        { id: 5, codigo_consulta: "7501000000033", nombre: "Croissant", precio: 32.00, cantidad: 10, estado: "activo" },
        { id: 6, codigo_consulta: "7501000000044", nombre: "Café Americano", precio: 38.00, cantidad: 50, estado: "activo" },
        { id: 7, codigo_consulta: "7501000000055", nombre: "Capuchino", precio: 52.00, cantidad: 40, estado: "activo" },
        { id: 8, codigo_consulta: "7501000000066", nombre: "Brownie", precio: 42.00, cantidad: 0, estado: "activo" },
        { id: 9, codigo_consulta: "7501000000099", nombre: "Mazapán descontinuado", precio: 10.00, cantidad: 3, estado: "inactivo" }
    ];

    // Simulación de movimientos recientes (VENTAS, COMPRAS, DEVOLUCIONES)
    const MOVIMIENTOS_BD = [
        { folio: 42, prefijo: "V", tipo: "Venta", usuario: "Ana Lisa Meltrozo", fecha_hora: `${HOY} 09:18`, total: 1000.00 },
        { folio: 41, prefijo: "V", tipo: "Venta", usuario: "Ana Lisa Meltrozo", fecha_hora: `${HOY} 08:45`, total: 2500.00 },
        { folio: 31, prefijo: "C", tipo: "Compra", usuario: "Admin", fecha_hora: `${HOY} 08:15`, total: 140.00 },
        { folio: 40, prefijo: "V", tipo: "Venta", usuario: "Admin", fecha_hora: `${HOY} 07:50`, total: 4500.00 },
        { folio: 5, prefijo: "D", tipo: "Devolución", usuario: "Ana Lisa Meltrozo", fecha_hora: `${HOY} 07:30`, total: 110.00 },
        { folio: 39, prefijo: "V", tipo: "Venta", usuario: "Ana Lisa Meltrozo", fecha_hora: "2026-11-25 18:10", total: 640.00 },
        { folio: 38, prefijo: "V", tipo: "Venta", usuario: "Admin", fecha_hora: "2026-11-25 14:22", total: 320.00 }
    ];

    async function obtenerProductos() {
        return PRODUCTOS_BD;
    }

    async function obtenerMovimientos() {
        return [...MOVIMIENTOS_BD].sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));
    }

    return {
        obtenerFechaHoyISO,
        obtenerProductos,
        obtenerMovimientos
    };
})();