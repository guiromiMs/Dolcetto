const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Archivo persistente local de SQLite
const dbPath = path.join(__dirname, 'dolcetto.db');
const db = new Database(dbPath);

// Obligatorio en SQLite para que las llaves foráneas realmente se validen
db.pragma('foreign_keys = ON');
// Modo WAL para mejorar estabilidad y evitar bloqueos en lecturas/escrituras simultáneas
db.pragma('journal_mode = WAL');

// Garantiza que todas las tablas e índices existan al iniciar el servidor
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSQL);
}

module.exports = db;
