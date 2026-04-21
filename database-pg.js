// =====================================================================
// database-pg.js — PostgreSQL adapter for HERGON POS (Railway)
// Drop-in replacement for database.js (sql.js/SQLite)
// Uses the 'pg' library with connection pooling for production use.
// =====================================================================
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway injects DATABASE_URL automatically when you add a PostgreSQL plugin
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,               // max simultaneous connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ===================== Compatibility wrapper =====================
// Mimics the prepare().run/get/all interface used throughout server.js
// so that migration requires ZERO changes to route handlers.
class PGWrapper {
  constructor(pool) { this._pool = pool; }

  prepare(sql) {
    const pool = this._pool;
    // Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);

    return {
      async run(...params) {
        const res = await pool.query(pgSql + ' RETURNING *', params);
        const row = res.rows[0];
        return {
          lastInsertRowid: row ? row.id : 0,
          changes: res.rowCount
        };
      },
      async get(...params) {
        const res = await pool.query(pgSql, params);
        return res.rows[0] || undefined;
      },
      async all(...params) {
        const res = await pool.query(pgSql, params);
        return res.rows;
      }
    };
  }

  async exec(sql) {
    await this._pool.query(sql);
  }

  // No-op — PostgreSQL persists automatically
  save() {}
}

let dbInstance = null;

async function initDatabase() {
  const db = new PGWrapper(pool);

  // Test connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    throw err;
  }

  // ===================== SCHEMA =====================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sucursales (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      direccion TEXT,
      ciudad TEXT,
      es_matriz INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      usuario TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('administrador','cajero')),
      sucursal_id INTEGER REFERENCES sucursales(id),
      activo INTEGER DEFAULT 1,
      email TEXT,
      pin TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT
    );
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      clave TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id INTEGER REFERENCES categorias(id),
      precio_menudeo REAL NOT NULL DEFAULT 0,
      precio_medio_mayoreo REAL NOT NULL DEFAULT 0,
      precio_mayoreo REAL NOT NULL DEFAULT 0,
      cantidad_medio_mayoreo INTEGER DEFAULT 10,
      cantidad_mayoreo INTEGER DEFAULT 25,
      stock_minimo INTEGER DEFAULT 5,
      activo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inventario (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
      stock INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(producto_id, sucursal_id)
    );
    CREATE TABLE IF NOT EXISTS tipos_membresia (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      descuento REAL DEFAULT 0,
      activo INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      membresia_id INTEGER REFERENCES tipos_membresia(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY,
      ticket_numero TEXT UNIQUE NOT NULL,
      sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
      cajero_id INTEGER NOT NULL REFERENCES usuarios(id),
      cliente_id INTEGER,
      subtotal REAL DEFAULT 0,
      descuento_membresia REAL DEFAULT 0,
      descuento_promocion REAL DEFAULT 0,
      total REAL DEFAULT 0,
      tipo_pago TEXT NOT NULL CHECK(tipo_pago IN ('efectivo','transferencia','tarjeta')),
      autorizado_por INTEGER,
      estado TEXT DEFAULT 'completada' CHECK(estado IN ('completada','devuelta','parcial_devuelta')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS venta_detalle (
      id SERIAL PRIMARY KEY,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      tipo_precio TEXT,
      descuento_promo REAL DEFAULT 0,
      subtotal REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS devoluciones (
      id SERIAL PRIMARY KEY,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      cajero_id INTEGER NOT NULL,
      autorizado_por INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      total REAL DEFAULT 0,
      motivo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS devolucion_detalle (
      id SERIAL PRIMARY KEY,
      devolucion_id INTEGER NOT NULL REFERENCES devoluciones(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cortes_caja (
      id SERIAL PRIMARY KEY,
      cajero_id INTEGER NOT NULL REFERENCES usuarios(id),
      sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
      total_ventas REAL DEFAULT 0,
      total_efectivo REAL DEFAULT 0,
      total_transferencia REAL DEFAULT 0,
      total_tarjeta REAL DEFAULT 0,
      total_devoluciones REAL DEFAULT 0,
      monto_esperado REAL DEFAULT 0,
      monto_real REAL DEFAULT 0,
      diferencia REAL DEFAULT 0,
      num_ventas INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS promociones (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('porcentaje','monto_fijo')),
      valor REAL NOT NULL,
      aplica_a TEXT NOT NULL CHECK(aplica_a IN ('producto','categoria','todo')),
      producto_id INTEGER,
      categoria_id INTEGER,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      activo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida','traspaso_entrada','traspaso_salida','venta','devolucion')),
      cantidad INTEGER NOT NULL,
      referencia TEXT,
      usuario_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notificaciones (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      sucursal_origen_id INTEGER,
      datos TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notificaciones_leidas (
      id SERIAL PRIMARY KEY,
      notificacion_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      leida_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notificacion_id, usuario_id)
    );
  `);

  // ===================== SEED DATA =====================
  const countSuc = await db.prepare('SELECT COUNT(*) as c FROM sucursales').get();
  if (parseInt(countSuc.c) === 0) {
    console.log('🌱 Seeding database...');

    const insertSuc = async (n, d, c, m) => await db.prepare('INSERT INTO sucursales (nombre, direccion, ciudad, es_matriz) VALUES (?,?,?,?)').run(n, d, c, m);
    await insertSuc('HERGON Matriz Coatepec', 'Centro, Coatepec', 'Coatepec', 1);
    await insertSuc('HERGON Xalapa Centro', 'Centro, Xalapa', 'Xalapa', 0);
    await insertSuc('HERGON Xalapa Sur', 'Zona Sur, Xalapa', 'Xalapa', 0);
    await insertSuc('HERGON Xalapa Norte', 'Zona Norte, Xalapa', 'Xalapa', 0);

    const cats = [
      ['Tornillos y tuercas', 'Tornillos, tuercas, rondanas y pernos'],
      ['Hules y empaques', 'Hules automotrices, empaques, juntas y sellos'],
      ['Abrazaderas y clips', 'Abrazaderas metálicas, plástico y clips'],
      ['Mangueras', 'Mangueras de hule, plástico y reforzadas'],
      ['Conectores y terminales', 'Conectores eléctricos y terminales'],
      ['Soportes y bases', 'Soportes de motor, transmisión y bases'],
      ['Bujes y rodamientos', 'Bujes de suspensión y rodamientos'],
      ['Bandas y poleas', 'Bandas de distribución y poleas'],
      ['Filtros', 'Filtros de aceite, aire, gasolina y cabina'],
      ['Accesorios generales', 'Pegamentos, lubricantes y accesorios']
    ];
    for (const [n, d] of cats) await db.prepare('INSERT INTO categorias (nombre, descripcion) VALUES (?,?)').run(n, d);

    const adminPass = bcrypt.hashSync('admin123', 10);
    const adminPin = bcrypt.hashSync('1234', 10);
    const cajeroPass = bcrypt.hashSync('cajero123', 10);
    const ins = async (n, u, p, r, s, pin) => await db.prepare('INSERT INTO usuarios (nombre, usuario, password, rol, sucursal_id, pin) VALUES (?,?,?,?,?,?)').run(n, u, p, r, s, pin);
    await ins('Administradora HERGON', 'admin', adminPass, 'administrador', 1, adminPin);
    await ins('María López', 'maria', cajeroPass, 'cajero', 1, null);
    await ins('Juan Pérez', 'juan', cajeroPass, 'cajero', 1, null);
    await ins('Ana García', 'ana', cajeroPass, 'cajero', 2, null);
    await ins('Pedro Sánchez', 'pedro', cajeroPass, 'cajero', 2, null);
    await ins('Laura Martínez', 'laura', cajeroPass, 'cajero', 3, null);
    await ins('Carlos Ruiz', 'carlos', cajeroPass, 'cajero', 3, null);
    await ins('Rosa Hernández', 'rosa', cajeroPass, 'cajero', 4, null);
    await ins('Diego Torres', 'diego', cajeroPass, 'cajero', 4, null);

    await db.prepare('INSERT INTO tipos_membresia (nombre, descuento) VALUES (?,?)').run('Bronce', 5);
    await db.prepare('INSERT INTO tipos_membresia (nombre, descuento) VALUES (?,?)').run('Plata', 10);
    await db.prepare('INSERT INTO tipos_membresia (nombre, descuento) VALUES (?,?)').run('Oro', 15);

    const productos = [
      ['TOR-001','Tornillo hex 1/4 x 1"','Tornillo hexagonal galvanizado',1,2.50,2.00,1.50,50,200,100],
      ['TOR-002','Tornillo hex 5/16 x 1.5"','Tornillo hexagonal galvanizado',1,3.00,2.50,2.00,50,200,100],
      ['TOR-003','Tornillo hex 3/8 x 2"','Tornillo hexagonal galvanizado',1,4.50,3.80,3.00,50,200,80],
      ['TOR-004','Tuerca hex 1/4"','Tuerca hexagonal galvanizada',1,1.50,1.20,0.90,100,500,200],
      ['TOR-005','Tuerca hex 5/16"','Tuerca hexagonal galvanizada',1,2.00,1.60,1.20,100,500,200],
      ['TOR-006','Rondana plana 1/4"','Rondana plana galvanizada',1,0.80,0.60,0.40,100,500,300],
      ['TOR-007','Perno 3/8 x 3"','Perno grado 5',1,8.00,6.50,5.00,25,100,50],
      ['HUL-001','Hule barra estabilizadora','Hule estabilizador universal',2,45.00,38.00,30.00,10,50,20],
      ['HUL-002','Empaque de válvula','Empaque universal',2,12.00,10.00,8.00,20,100,50],
      ['HUL-003','Junta de cabeza','Junta cabeza 4 cil',2,180.00,155.00,130.00,5,20,8],
      ['HUL-004','Hule soporte motor','Soporte motor universal',2,95.00,80.00,65.00,5,20,10],
      ['HUL-005','Retén de cigüeñal','Retén delantero',2,35.00,28.00,22.00,10,50,15],
      ['ABR-001','Abrazadera 1/2"','Abrazadera inox',3,8.00,6.50,5.00,20,100,50],
      ['ABR-002','Abrazadera 3/4"','Abrazadera inox',3,10.00,8.00,6.50,20,100,50],
      ['ABR-003','Clip retención puerta','Clip plástico',3,5.00,4.00,3.00,50,200,100],
      ['MAN-001','Manguera radiador 1.5"','Manguera superior',4,65.00,55.00,45.00,5,20,10],
      ['MAN-002','Manguera combustible 5/16"','Manguera gasolina/metro',4,25.00,20.00,16.00,10,50,20],
      ['MAN-003','Manguera vacío 3mm','Manguera vacío/metro',4,15.00,12.00,9.00,10,50,30],
      ['CON-001','Conector eléctrico 2 vías','Conector macho-hembra',5,12.00,10.00,8.00,20,100,50],
      ['CON-002','Terminal ojo 1/4"','Terminal anillo aislada',5,3.50,2.80,2.20,50,200,100],
      ['CON-003','Arnés luces traseras','Arnés 7 vías',5,120.00,100.00,85.00,3,10,5],
      ['SOP-001','Soporte motor izquierdo','Soporte hidráulico',6,250.00,215.00,180.00,3,10,5],
      ['SOP-002','Base de transmisión','Base universal',6,185.00,160.00,135.00,3,10,5],
      ['BUJ-001','Buje horquilla inferior','Buje suspensión',7,55.00,45.00,38.00,10,50,15],
      ['BUJ-002','Rodamiento rueda delant','Rodamiento sellado',7,145.00,125.00,105.00,5,20,8],
      ['BAN-001','Banda distribución','Banda dentada',8,95.00,80.00,68.00,5,20,10],
      ['BAN-002','Banda accesorios','Banda serpentina',8,75.00,63.00,52.00,5,20,10],
      ['BAN-003','Polea tensora','Polea tensora banda',8,180.00,155.00,130.00,3,10,5],
      ['FIL-001','Filtro aceite universal','Filtro aceite rosca',9,45.00,38.00,30.00,10,50,20],
      ['FIL-002','Filtro aire rectangular','Filtro aire panel',9,65.00,55.00,45.00,10,50,15],
      ['FIL-003','Filtro de gasolina','Filtro combustible',9,35.00,28.00,22.00,10,50,20],
      ['ACC-001','Pegamento epóxico','Pegamento 2 comp',10,45.00,38.00,30.00,10,50,20],
      ['ACC-002','WD-40 400ml','Lubricante multiusos',10,85.00,72.00,60.00,10,50,15],
      ['ACC-003','Cinta de aislar','Cinta eléctrica 18m',10,18.00,15.00,12.00,20,100,50],
      ['TOR-008','Tornillo allen 5mm x 20mm','Cabeza allen',1,3.50,2.80,2.20,50,200,100],
      ['TOR-009','Tornillo autorroscante #8','Punta broca',1,2.00,1.60,1.20,100,500,200],
      ['HUL-006','Bota de dirección','Guardapolvo cremallera',2,55.00,45.00,38.00,10,50,15],
      ['HUL-007','Hule amortiguador','Tope suspensión',2,35.00,28.00,22.00,10,50,20],
      ['ABR-004','Abrazadera doble oreja','Abrazadera presión',3,6.00,4.80,3.80,50,200,100],
      ['MAN-004','Manguera calefacción 5/8"','Manguera calefacción',4,30.00,25.00,20.00,10,50,20],
      ['CON-004','Fusible blade 15A','Fusible cuchilla',5,5.00,4.00,3.00,50,200,150],
      ['SOP-003','Soporte escape universal','Soporte hule escape',6,25.00,20.00,16.00,10,50,20],
      ['BUJ-003','Balero de clutch','Collarín empuje',7,120.00,100.00,85.00,5,20,8],
      ['FIL-004','Filtro de cabina','Filtro A/C',9,75.00,63.00,52.00,10,50,10],
      ['ACC-004','Silicón rojo alta temp','Sellador 85g',10,55.00,45.00,38.00,10,50,15],
      ['ACC-005','Limpia contactos 300ml','Spray limpiador',10,65.00,55.00,45.00,10,50,15],
      ['TOR-010','Birlo rueda M12x1.5','Birlo rueda',1,15.00,12.00,10.00,20,100,50],
      ['HUL-008','Empaque múltiple admisión','Empaque múltiple',2,85.00,72.00,60.00,5,20,8],
      ['BAN-004','Tensor hidráulico','Tensor automático',8,350.00,300.00,250.00,3,10,3],
      ['MAN-005','Manguera freno DOT3','Manguera freno',4,85.00,72.00,60.00,5,20,10],
    ];

    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    for (let i = 0; i < productos.length; i++) {
      const p = productos[i];
      await db.prepare('INSERT INTO productos (clave, nombre, descripcion, categoria_id, precio_menudeo, precio_medio_mayoreo, precio_mayoreo, cantidad_medio_mayoreo, cantidad_mayoreo, stock_minimo) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...p);
      const prodId = i + 1;
      for (let s = 1; s <= 4; s++) {
        const stock = Math.floor(rand() * 200) + 20;
        await db.prepare('INSERT INTO inventario (producto_id, sucursal_id, stock) VALUES (?,?,?)').run(prodId, s, stock);
      }
    }

    await db.prepare('INSERT INTO clientes (nombre, telefono, membresia_id) VALUES (?,?,?)').run('Taller Mecánico El Rápido', '228-100-0001', 3);
    await db.prepare('INSERT INTO clientes (nombre, telefono, membresia_id) VALUES (?,?,?)').run('Autopartes González', '228-100-0002', 2);
    await db.prepare('INSERT INTO clientes (nombre, telefono, membresia_id) VALUES (?,?,?)').run('Servicio Automotriz López', '228-100-0003', 2);
    await db.prepare('INSERT INTO clientes (nombre, telefono, membresia_id) VALUES (?,?,?)').run('Roberto Sánchez', '228-100-0004', 1);
    await db.prepare('INSERT INTO clientes (nombre, telefono) VALUES (?,?)').run('Público General', null);

    await db.prepare('INSERT INTO promociones (nombre, tipo, valor, aplica_a, categoria_id, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?,?,?)').run('Descuento Filtros Abril', 'porcentaje', 10, 'categoria', 9, '2026-04-01', '2026-04-30');

    console.log('✅ Database seeded successfully.');
  }

  dbInstance = db;
  return db;
}

function getDb() { return dbInstance; }

module.exports = { initDatabase, getDb };
