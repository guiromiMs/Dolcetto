PRAGMA foreign_keys = ON;

-- 1. Configuración del negocio (para tickets de 80mm y reportes impresos)
CREATE TABLE IF NOT EXISTS CONFIGURACION_NEGOCIO (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nombre_comercial TEXT NOT NULL,
    rfc TEXT,
    domicilio TEXT NOT NULL,
    telefono TEXT NOT NULL,
    mensaje_pie TEXT NOT NULL,
    politica_devolucion TEXT NOT NULL,
    logo BLOB,
    logo_mime TEXT
);

-- 2. Usuarios y roles
CREATE TABLE IF NOT EXISTS USUARIOS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'operador')),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

-- 3. Catálogo de productos e imágenes en BLOB
CREATE TABLE IF NOT EXISTS PRODUCTOS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_consulta TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio REAL NOT NULL CHECK (precio >= 0),
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    imagen BLOB,
    imagen_mime TEXT
);

-- 4. Compras (encabezado y detalle)
CREATE TABLE IF NOT EXISTS COMPRAS (
    folio INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M', 'now', 'localtime')),
    proveedor TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id)
);

CREATE TABLE IF NOT EXISTS DETALLE_COMPRAS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_folio INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario REAL NOT NULL CHECK (costo_unitario >= 0),
    importe REAL NOT NULL CHECK (importe >= 0),
    FOREIGN KEY (compra_folio) REFERENCES COMPRAS(folio),
    FOREIGN KEY (producto_id) REFERENCES PRODUCTOS(id)
);

-- 5. Ventas (encabezado y detalle)
CREATE TABLE IF NOT EXISTS VENTAS (
    folio INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    fecha_hora TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M', 'now', 'localtime')),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    iva REAL NOT NULL DEFAULT 0 CHECK (iva >= 0),
    total REAL NOT NULL CHECK (total >= 0),
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id)
);

CREATE TABLE IF NOT EXISTS DETALLE_VENTAS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_folio INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    importe REAL NOT NULL CHECK (importe >= 0),
    FOREIGN KEY (venta_folio) REFERENCES VENTAS(folio),
    FOREIGN KEY (producto_id) REFERENCES PRODUCTOS(id)
);

-- 6. Devoluciones (encabezado y detalle)
CREATE TABLE IF NOT EXISTS DEVOLUCIONES (
    folio INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_folio INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha_hora TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M', 'now', 'localtime')),
    motivo TEXT NOT NULL,
    total_devuelto REAL NOT NULL CHECK (total_devuelto >= 0),
    FOREIGN KEY (venta_folio) REFERENCES VENTAS(folio),
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id)
);

CREATE TABLE IF NOT EXISTS DETALLE_DEVOLUCIONES (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    devolucion_folio INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    importe REAL NOT NULL CHECK (importe >= 0),
    FOREIGN KEY (devolucion_folio) REFERENCES DEVOLUCIONES(folio),
    FOREIGN KEY (producto_id) REFERENCES PRODUCTOS(id)
);

-- Índices existentes + índices de llaves foráneas para reportes rápidos
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON PRODUCTOS(nombre);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON COMPRAS(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON VENTAS(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha ON DEVOLUCIONES(fecha_hora);

CREATE INDEX IF NOT EXISTS idx_ventas_usuario ON VENTAS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_compras_usuario ON COMPRAS(usuario_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_venta ON DEVOLUCIONES(venta_folio);
CREATE INDEX IF NOT EXISTS idx_devoluciones_usuario ON DEVOLUCIONES(usuario_id);
CREATE INDEX IF NOT EXISTS idx_det_compras_folio ON DETALLE_COMPRAS(compra_folio);
CREATE INDEX IF NOT EXISTS idx_det_ventas_folio ON DETALLE_VENTAS(venta_folio);
CREATE INDEX IF NOT EXISTS idx_det_dev_folio ON DETALLE_DEVOLUCIONES(devolucion_folio);
