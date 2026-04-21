const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Auto-detect: use PostgreSQL in production (Railway), SQLite locally
const dbModule = process.env.DATABASE_URL
  ? require('./database-pg')
  : require('./database');
const { initDatabase } = dbModule;

const JWT_SECRET = process.env.JWT_SECRET || 'hergon-secret-key-2026';
const PORT = process.env.PORT || 3000;

let db; // set after async init

async function startServer() {
db = await initDatabase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Servir dependencias locales (sin depender de CDN)
app.use('/lib/react', express.static(path.join(__dirname, 'node_modules/react/umd')));
app.use('/lib/react-dom', express.static(path.join(__dirname, 'node_modules/react-dom/umd')));
app.use('/lib/babel', express.static(path.join(__dirname, 'node_modules/@babel/standalone')));
app.use('/lib/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));

app.use(express.static(path.join(__dirname, 'public')));

// ===================== MIDDLEWARE AUTH =====================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.rol !== 'administrador') return res.status(403).json({ error: 'Solo administradores' });
  next();
}

// Helper: crear notificación y emitir por socket
async function crearNotificacion(tipo, mensaje, sucursalOrigenId, datos = null) {
  const stmt = db.prepare('INSERT INTO notificaciones (tipo, mensaje, sucursal_origen_id, datos) VALUES (?,?,?,?)');
  const result = await stmt.run(tipo, mensaje, sucursalOrigenId, datos ? JSON.stringify(datos) : null);
  const notif = await db.prepare('SELECT n.*, s.nombre as sucursal_nombre FROM notificaciones n LEFT JOIN sucursales s ON n.sucursal_origen_id=s.id WHERE n.id=?').get(result.lastInsertRowid);
  io.emit('notificacion', notif);
  return notif;
}

// Helper: generar número de ticket
async function generarTicket(sucursalId) {
  const fecha = new Date();
  const prefix = `T${sucursalId}-${fecha.getFullYear()}${String(fecha.getMonth()+1).padStart(2,'0')}${String(fecha.getDate()).padStart(2,'0')}`;
  const count = await db.prepare("SELECT COUNT(*) as c FROM ventas WHERE ticket_numero LIKE ?").get(prefix + '%');
  return `${prefix}-${String(count.c + 1).padStart(4, '0')}`;
}

// ===================== AUTH =====================
app.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body;
  const user = await db.prepare('SELECT u.*, s.nombre as sucursal_nombre FROM usuarios u LEFT JOIN sucursales s ON u.sucursal_id=s.id WHERE u.usuario=? AND u.activo=1').get(usuario);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = jwt.sign({ id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol, sucursal_id: user.sucursal_id, sucursal_nombre: user.sucursal_nombre }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol, sucursal_id: user.sucursal_id, sucursal_nombre: user.sucursal_nombre } });
});

app.post('/api/auth/verify-pin', authMiddleware, async (req, res) => {
  const { pin } = req.body;
  const admin = await db.prepare("SELECT * FROM usuarios WHERE rol='administrador' AND activo=1").get();
  if (!admin || !admin.pin || !bcrypt.compareSync(pin, admin.pin)) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }
  res.json({ ok: true, admin_id: admin.id });
});

// ===================== SUCURSALES =====================
app.get('/api/sucursales', authMiddleware, async (req, res) => {
  res.json(await db.prepare('SELECT * FROM sucursales').all());
});

// ===================== CATEGORIAS =====================
app.get('/api/categorias', authMiddleware, async (req, res) => {
  res.json(await db.prepare('SELECT * FROM categorias').all());
});

// ===================== PRODUCTOS =====================
app.get('/api/productos', authMiddleware, async (req, res) => {
  const { q, categoria_id, sucursal_id } = req.query;
  let sql = `SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id=c.id WHERE p.activo=1`;
  const params = [];
  if (q) { sql += ` AND (p.clave LIKE ? OR p.nombre LIKE ?)`; params.push(`%${q}%`, `%${q}%`); }
  if (categoria_id) { sql += ` AND p.categoria_id=?`; params.push(categoria_id); }
  sql += ` ORDER BY p.clave LIMIT 200`;
  const productos = await db.prepare(sql).all(...params);

  // Add stock info
  for (const p of productos) {
    p.inventario = await db.prepare('SELECT i.*, s.nombre as sucursal_nombre FROM inventario i JOIN sucursales s ON i.sucursal_id=s.id WHERE i.producto_id=?').all(p.id);
    if (sucursal_id) {
      const inv = p.inventario.find(i => i.sucursal_id == sucursal_id);
      p.stock_local = inv ? inv.stock : 0;
    }
    p.stock_total = p.inventario.reduce((sum, i) => sum + i.stock, 0);
  }
  res.json(productos);
});

app.post('/api/productos', authMiddleware, adminOnly, async (req, res) => {
  const { clave, nombre, descripcion, categoria_id, precio_menudeo, precio_medio_mayoreo, precio_mayoreo, cantidad_medio_mayoreo, cantidad_mayoreo, stock_minimo, stocks } = req.body;
  try {
    const result = await db.prepare(`INSERT INTO productos (clave, nombre, descripcion, categoria_id, precio_menudeo, precio_medio_mayoreo, precio_mayoreo, cantidad_medio_mayoreo, cantidad_mayoreo, stock_minimo) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(clave, nombre, descripcion || '', categoria_id, precio_menudeo, precio_medio_mayoreo, precio_mayoreo, cantidad_medio_mayoreo || 10, cantidad_mayoreo || 25, stock_minimo || 5);
    const prodId = result.lastInsertRowid;
    // Init inventory
    const sucursales = await db.prepare('SELECT id FROM sucursales').all();
    for (const s of sucursales) {
      const stock = (stocks && stocks[s.id]) || 0;
      await db.prepare('INSERT INTO inventario (producto_id, sucursal_id, stock) VALUES (?,?,?)').run(prodId, s.id, stock);
    }
    await crearNotificacion('producto_nuevo', `Nuevo producto registrado: ${clave} - ${nombre}`, null);
    res.json({ id: prodId, message: 'Producto creado' });
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'La clave ya existe' : e.message });
  }
});

app.put('/api/productos/:id', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, descripcion, categoria_id, precio_menudeo, precio_medio_mayoreo, precio_mayoreo, cantidad_medio_mayoreo, cantidad_mayoreo, stock_minimo } = req.body;
  await db.prepare(`UPDATE productos SET nombre=?, descripcion=?, categoria_id=?, precio_menudeo=?, precio_medio_mayoreo=?, precio_mayoreo=?, cantidad_medio_mayoreo=?, cantidad_mayoreo=?, stock_minimo=? WHERE id=?`)
    .run(nombre, descripcion, categoria_id, precio_menudeo, precio_medio_mayoreo, precio_mayoreo, cantidad_medio_mayoreo, cantidad_mayoreo, stock_minimo, req.params.id);
  res.json({ message: 'Producto actualizado' });
});

// ===================== INVENTARIO =====================
app.get('/api/inventario', authMiddleware, async (req, res) => {
  const { sucursal_id, bajo_stock } = req.query;
  let sql = `SELECT i.*, p.clave, p.nombre as producto_nombre, p.stock_minimo, p.precio_menudeo, s.nombre as sucursal_nombre, c.nombre as categoria_nombre
    FROM inventario i JOIN productos p ON i.producto_id=p.id JOIN sucursales s ON i.sucursal_id=s.id LEFT JOIN categorias c ON p.categoria_id=c.id WHERE p.activo=1`;
  const params = [];
  if (sucursal_id) { sql += ` AND i.sucursal_id=?`; params.push(sucursal_id); }
  if (bajo_stock === '1') { sql += ` AND i.stock <= p.stock_minimo`; }
  sql += ` ORDER BY p.clave`;
  res.json(await db.prepare(sql).all(...params));
});

app.post('/api/inventario/entrada', authMiddleware, async (req, res) => {
  const { producto_id, sucursal_id, cantidad } = req.body;
  await db.prepare('UPDATE inventario SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE producto_id=? AND sucursal_id=?').run(cantidad, producto_id, sucursal_id);
  await db.prepare('INSERT INTO movimientos_inventario (producto_id, sucursal_id, tipo, cantidad, usuario_id) VALUES (?,?,?,?,?)').run(producto_id, sucursal_id, 'entrada', cantidad, req.user.id);
  const prod = await db.prepare('SELECT clave, nombre FROM productos WHERE id=?').get(producto_id);
  const suc = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_id);
  await crearNotificacion('entrada_mercancia', `Entrada de ${cantidad} unidades de ${prod.clave} en ${suc.nombre}`, sucursal_id);
  res.json({ message: 'Entrada registrada' });
});

app.post('/api/inventario/traspaso', authMiddleware, adminOnly, async (req, res) => {
  const { producto_id, sucursal_origen_id, sucursal_destino_id, cantidad } = req.body;
  const inv = await db.prepare('SELECT stock FROM inventario WHERE producto_id=? AND sucursal_id=?').get(producto_id, sucursal_origen_id);
  if (!inv || inv.stock < cantidad) return res.status(400).json({ error: 'Stock insuficiente en sucursal de origen' });

  await db.prepare('UPDATE inventario SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE producto_id=? AND sucursal_id=?').run(cantidad, producto_id, sucursal_origen_id);
  await db.prepare('UPDATE inventario SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE producto_id=? AND sucursal_id=?').run(cantidad, producto_id, sucursal_destino_id);
  await db.prepare('INSERT INTO movimientos_inventario (producto_id, sucursal_id, tipo, cantidad, usuario_id) VALUES (?,?,?,?,?)').run(producto_id, sucursal_origen_id, 'traspaso_salida', cantidad, req.user.id);
  await db.prepare('INSERT INTO movimientos_inventario (producto_id, sucursal_id, tipo, cantidad, usuario_id) VALUES (?,?,?,?,?)').run(producto_id, sucursal_destino_id, 'traspaso_entrada', cantidad, req.user.id);

  const prod = await db.prepare('SELECT clave, nombre FROM productos WHERE id=?').get(producto_id);
  const sucOr = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_origen_id);
  const sucDe = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_destino_id);
  await crearNotificacion('traspaso', `Traspaso de ${cantidad} uds de ${prod.clave} de ${sucOr.nombre} a ${sucDe.nombre}`, sucursal_origen_id);
  res.json({ message: 'Traspaso realizado' });
});

// ===================== PROMOCIONES =====================
app.get('/api/promociones', authMiddleware, async (req, res) => {
  const { activas } = req.query;
  let sql = `SELECT pr.*, p.nombre as producto_nombre, c.nombre as categoria_nombre FROM promociones pr LEFT JOIN productos p ON pr.producto_id=p.id LEFT JOIN categorias c ON pr.categoria_id=c.id`;
  if (activas === '1') {
    sql += ` WHERE pr.activo=1 AND pr.fecha_inicio <= CURRENT_DATE AND pr.fecha_fin >= CURRENT_DATE`;
  }
  sql += ` ORDER BY pr.fecha_fin DESC`;
  res.json(await db.prepare(sql).all());
});

app.post('/api/promociones', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, tipo, valor, aplica_a, producto_id, categoria_id, fecha_inicio, fecha_fin } = req.body;
  const result = await db.prepare('INSERT INTO promociones (nombre, tipo, valor, aplica_a, producto_id, categoria_id, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?,?,?,?)')
    .run(nombre, tipo, valor, aplica_a, producto_id || null, categoria_id || null, fecha_inicio, fecha_fin);
  await crearNotificacion('promocion', `Nueva promoción: ${nombre}`, null);
  res.json({ id: result.lastInsertRowid, message: 'Promoción creada' });
});

app.put('/api/promociones/:id/toggle', authMiddleware, adminOnly, async (req, res) => {
  const promo = await db.prepare('SELECT activo FROM promociones WHERE id=?').get(req.params.id);
  await db.prepare('UPDATE promociones SET activo=? WHERE id=?').run(promo.activo ? 0 : 1, req.params.id);
  res.json({ message: 'Promoción actualizada' });
});

// ===================== CLIENTES =====================
app.get('/api/clientes', authMiddleware, async (req, res) => {
  const { q } = req.query;
  let sql = `SELECT cl.*, tm.nombre as membresia_nombre, tm.descuento FROM clientes cl LEFT JOIN tipos_membresia tm ON cl.membresia_id=tm.id`;
  if (q) { sql += ` WHERE cl.nombre LIKE '%${q}%' OR cl.telefono LIKE '%${q}%'`; }
  sql += ` ORDER BY cl.nombre`;
  res.json(await db.prepare(sql).all());
});

app.post('/api/clientes', authMiddleware, async (req, res) => {
  const { nombre, telefono, email, membresia_id } = req.body;
  const result = await db.prepare('INSERT INTO clientes (nombre, telefono, email, membresia_id) VALUES (?,?,?,?)').run(nombre, telefono, email || null, membresia_id || null);
  res.json({ id: result.lastInsertRowid, message: 'Cliente registrado' });
});

app.put('/api/clientes/:id', authMiddleware, async (req, res) => {
  const { nombre, telefono, email, membresia_id } = req.body;
  await db.prepare('UPDATE clientes SET nombre=?, telefono=?, email=?, membresia_id=? WHERE id=?').run(nombre, telefono, email, membresia_id || null, req.params.id);
  res.json({ message: 'Cliente actualizado' });
});

app.get('/api/clientes/:id/historial', authMiddleware, async (req, res) => {
  const ventas = await db.prepare(`SELECT v.*, s.nombre as sucursal_nombre, u.nombre as cajero_nombre FROM ventas v
    JOIN sucursales s ON v.sucursal_id=s.id JOIN usuarios u ON v.cajero_id=u.id WHERE v.cliente_id=? ORDER BY v.created_at DESC LIMIT 50`).all(req.params.id);
  res.json(ventas);
});

app.get('/api/tipos-membresia', authMiddleware, async (req, res) => {
  res.json(await db.prepare('SELECT * FROM tipos_membresia WHERE activo=1').all());
});

// ===================== VENTAS (POS) =====================
app.post('/api/ventas', authMiddleware, async (req, res) => {
  const { items, cliente_id, tipo_pago, autorizado_por } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No hay productos en la venta' });
  if (tipo_pago === 'tarjeta' && req.user.rol !== 'administrador' && !autorizado_por) {
    return res.status(403).json({ error: 'Pago con tarjeta requiere autorización de administrador' });
  }

  const sucursal_id = req.user.sucursal_id;
  const ticket_numero = await generarTicket(sucursal_id);

  // Get active promotions
  const promos = await db.prepare(`SELECT * FROM promociones WHERE activo=1 AND fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE`).all();

  // Get client membership discount
  let descuentoMembresia = 0;
  if (cliente_id) {
    const cli = await db.prepare('SELECT tm.descuento FROM clientes cl LEFT JOIN tipos_membresia tm ON cl.membresia_id=tm.id WHERE cl.id=?').get(cliente_id);
    if (cli && cli.descuento) descuentoMembresia = cli.descuento;
  }

  let subtotal = 0;
  let totalDescPromo = 0;
  const detalles = [];

  for (const item of items) {
    const prod = await db.prepare('SELECT * FROM productos WHERE id=?').get(item.producto_id);
    if (!prod) return res.status(400).json({ error: `Producto ${item.producto_id} no encontrado` });

    const inv = await db.prepare('SELECT stock FROM inventario WHERE producto_id=? AND sucursal_id=?').get(item.producto_id, sucursal_id);
    if (!inv || inv.stock < item.cantidad) return res.status(400).json({ error: `Stock insuficiente para ${prod.clave}` });

    // Determine price tier
    let precio, tipoPrecio;
    if (item.cantidad >= prod.cantidad_mayoreo) { precio = prod.precio_mayoreo; tipoPrecio = 'mayoreo'; }
    else if (item.cantidad >= prod.cantidad_medio_mayoreo) { precio = prod.precio_medio_mayoreo; tipoPrecio = 'medio_mayoreo'; }
    else { precio = prod.precio_menudeo; tipoPrecio = 'menudeo'; }

    // Check promotions
    let descPromo = 0;
    for (const pr of promos) {
      if (pr.aplica_a === 'todo' || (pr.aplica_a === 'producto' && pr.producto_id === item.producto_id) || (pr.aplica_a === 'categoria' && pr.categoria_id === prod.categoria_id)) {
        if (pr.tipo === 'porcentaje') descPromo = (precio * item.cantidad) * (pr.valor / 100);
        else descPromo = Math.min(pr.valor, precio * item.cantidad);
        break;
      }
    }

    const itemSubtotal = (precio * item.cantidad) - descPromo;
    subtotal += precio * item.cantidad;
    totalDescPromo += descPromo;
    detalles.push({ producto_id: item.producto_id, cantidad: item.cantidad, precio_unitario: precio, tipo_precio: tipoPrecio, descuento_promo: descPromo, subtotal: itemSubtotal });
  }

  const montoDescMembresia = (subtotal - totalDescPromo) * (descuentoMembresia / 100);
  const total = subtotal - totalDescPromo - montoDescMembresia;

  // Insert sale
  const ventaResult = await db.prepare(`INSERT INTO ventas (ticket_numero, sucursal_id, cajero_id, cliente_id, subtotal, descuento_membresia, descuento_promocion, total, tipo_pago, autorizado_por) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(ticket_numero, sucursal_id, req.user.id, cliente_id || null, subtotal, montoDescMembresia, totalDescPromo, total, tipo_pago, autorizado_por || null);
  const ventaId = ventaResult.lastInsertRowid;

  // Insert details & update inventory
  for (const d of detalles) {
    await db.prepare('INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, tipo_precio, descuento_promo, subtotal) VALUES (?,?,?,?,?,?,?)').run(ventaId, d.producto_id, d.cantidad, d.precio_unitario, d.tipo_precio, d.descuento_promo, d.subtotal);
    await db.prepare('UPDATE inventario SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE producto_id=? AND sucursal_id=?').run(d.cantidad, d.producto_id, sucursal_id);
    await db.prepare('INSERT INTO movimientos_inventario (producto_id, sucursal_id, tipo, cantidad, referencia, usuario_id) VALUES (?,?,?,?,?,?)').run(d.producto_id, sucursal_id, 'venta', d.cantidad, ticket_numero, req.user.id);

    // Check low stock alert
    const invAfter = await db.prepare('SELECT i.stock, p.stock_minimo, p.clave, p.nombre FROM inventario i JOIN productos p ON i.producto_id=p.id WHERE i.producto_id=? AND i.sucursal_id=?').get(d.producto_id, sucursal_id);
    if (invAfter && invAfter.stock <= invAfter.stock_minimo) {
      const sucNombre = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_id);
      const tipoAlerta = invAfter.stock === 0 ? 'stock_cero' : 'stock_bajo';
      await crearNotificacion(tipoAlerta, `${tipoAlerta === 'stock_cero' ? 'SIN STOCK' : 'Stock bajo'}: ${invAfter.clave} - ${invAfter.nombre} (${invAfter.stock} uds) en ${sucNombre.nombre}`, sucursal_id);
    }
  }

  const sucNombre = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_id);
  await crearNotificacion('venta', `Venta ${ticket_numero} por $${total.toFixed(2)} (${tipo_pago}) en ${sucNombre.nombre}`, sucursal_id);

  // Return full ticket data
  const venta = await db.prepare(`SELECT v.*, s.nombre as sucursal_nombre, s.direccion as sucursal_direccion, u.nombre as cajero_nombre, cl.nombre as cliente_nombre
    FROM ventas v JOIN sucursales s ON v.sucursal_id=s.id JOIN usuarios u ON v.cajero_id=u.id LEFT JOIN clientes cl ON v.cliente_id=cl.id WHERE v.id=?`).get(ventaId);
  venta.detalles = await db.prepare(`SELECT vd.*, p.clave, p.nombre as producto_nombre FROM venta_detalle vd JOIN productos p ON vd.producto_id=p.id WHERE vd.venta_id=?`).all(ventaId);

  res.json(venta);
});

app.get('/api/ventas', authMiddleware, async (req, res) => {
  const { sucursal_id, cajero_id, fecha_desde, fecha_hasta, tipo_pago, limit: lim } = req.query;
  let sql = `SELECT v.*, s.nombre as sucursal_nombre, u.nombre as cajero_nombre, cl.nombre as cliente_nombre FROM ventas v
    JOIN sucursales s ON v.sucursal_id=s.id JOIN usuarios u ON v.cajero_id=u.id LEFT JOIN clientes cl ON v.cliente_id=cl.id WHERE 1=1`;
  const params = [];
  if (sucursal_id) { sql += ` AND v.sucursal_id=?`; params.push(sucursal_id); }
  if (cajero_id) { sql += ` AND v.cajero_id=?`; params.push(cajero_id); }
  if (fecha_desde) { sql += ` AND DATE(v.created_at) >= ?`; params.push(fecha_desde); }
  if (fecha_hasta) { sql += ` AND DATE(v.created_at) <= ?`; params.push(fecha_hasta); }
  if (tipo_pago) { sql += ` AND v.tipo_pago=?`; params.push(tipo_pago); }
  sql += ` ORDER BY v.created_at DESC LIMIT ?`;
  params.push(parseInt(lim) || 100);
  res.json(await db.prepare(sql).all(...params));
});

app.get('/api/ventas/:id', authMiddleware, async (req, res) => {
  const venta = await db.prepare(`SELECT v.*, s.nombre as sucursal_nombre, s.direccion as sucursal_direccion, s.ciudad as sucursal_ciudad, u.nombre as cajero_nombre, cl.nombre as cliente_nombre
    FROM ventas v JOIN sucursales s ON v.sucursal_id=s.id JOIN usuarios u ON v.cajero_id=u.id LEFT JOIN clientes cl ON v.cliente_id=cl.id WHERE v.id=?`).get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  venta.detalles = await db.prepare(`SELECT vd.*, p.clave, p.nombre as producto_nombre FROM venta_detalle vd JOIN productos p ON vd.producto_id=p.id WHERE vd.venta_id=?`).all(venta.id);
  res.json(venta);
});

// ===================== DEVOLUCIONES =====================
app.post('/api/devoluciones', authMiddleware, async (req, res) => {
  const { venta_id, items, motivo, admin_pin } = req.body;
  // Verify admin PIN
  const admin = await db.prepare("SELECT * FROM usuarios WHERE rol='administrador' AND activo=1").get();
  if (!admin || !admin.pin || !bcrypt.compareSync(admin_pin, admin.pin)) {
    return res.status(401).json({ error: 'PIN de administrador incorrecto' });
  }

  const venta = await db.prepare('SELECT * FROM ventas WHERE id=?').get(venta_id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  let totalDev = 0;
  const devResult = await db.prepare('INSERT INTO devoluciones (venta_id, cajero_id, autorizado_por, sucursal_id, motivo) VALUES (?,?,?,?,?)')
    .run(venta_id, req.user.id, admin.id, venta.sucursal_id, motivo || '');
  const devId = devResult.lastInsertRowid;

  for (const item of items) {
    const detalle = await db.prepare('SELECT * FROM venta_detalle WHERE venta_id=? AND producto_id=?').get(venta_id, item.producto_id);
    if (!detalle) continue;
    const subtotal = detalle.precio_unitario * item.cantidad;
    totalDev += subtotal;
    await db.prepare('INSERT INTO devolucion_detalle (devolucion_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?)').run(devId, item.producto_id, item.cantidad, detalle.precio_unitario, subtotal);
    await db.prepare('UPDATE inventario SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE producto_id=? AND sucursal_id=?').run(item.cantidad, item.producto_id, venta.sucursal_id);
    await db.prepare('INSERT INTO movimientos_inventario (producto_id, sucursal_id, tipo, cantidad, referencia, usuario_id) VALUES (?,?,?,?,?,?)').run(item.producto_id, venta.sucursal_id, 'devolucion', item.cantidad, venta.ticket_numero, req.user.id);
  }

  await db.prepare('UPDATE devoluciones SET total=? WHERE id=?').run(totalDev, devId);
  await db.prepare("UPDATE ventas SET estado='parcial_devuelta' WHERE id=?").run(venta_id);

  const sucNombre = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(venta.sucursal_id);
  await crearNotificacion('devolucion', `Devolución de $${totalDev.toFixed(2)} del ticket ${venta.ticket_numero} en ${sucNombre.nombre}`, venta.sucursal_id);
  res.json({ id: devId, total: totalDev, message: 'Devolución procesada' });
});

// ===================== CORTES DE CAJA =====================
app.get('/api/cortes', authMiddleware, async (req, res) => {
  const { cajero_id, sucursal_id } = req.query;
  let sql = `SELECT cc.*, u.nombre as cajero_nombre, s.nombre as sucursal_nombre FROM cortes_caja cc
    JOIN usuarios u ON cc.cajero_id=u.id JOIN sucursales s ON cc.sucursal_id=s.id WHERE 1=1`;
  const params = [];
  if (cajero_id) { sql += ` AND cc.cajero_id=?`; params.push(cajero_id); }
  if (sucursal_id) { sql += ` AND cc.sucursal_id=?`; params.push(sucursal_id); }
  sql += ` ORDER BY cc.created_at DESC LIMIT 50`;
  res.json(await db.prepare(sql).all(...params));
});

app.get('/api/cortes/resumen', authMiddleware, async (req, res) => {
  const cajeroId = req.user.id;
  const sucursalId = req.user.sucursal_id;
  const lastCorte = await db.prepare('SELECT created_at FROM cortes_caja WHERE cajero_id=? ORDER BY created_at DESC LIMIT 1').get(cajeroId);
  const since = lastCorte ? lastCorte.created_at : '2000-01-01';

  const ventas = await db.prepare(`SELECT * FROM ventas WHERE cajero_id=? AND sucursal_id=? AND created_at > ? AND estado != 'devuelta'`).all(cajeroId, sucursalId, since);
  const devoluciones = await db.prepare(`SELECT d.* FROM devoluciones d WHERE d.cajero_id=? AND d.sucursal_id=? AND d.created_at > ?`).all(cajeroId, sucursalId, since);

  const resumen = {
    num_ventas: ventas.length,
    total_ventas: ventas.reduce((s, v) => s + v.total, 0),
    total_efectivo: ventas.filter(v => v.tipo_pago === 'efectivo').reduce((s, v) => s + v.total, 0),
    total_transferencia: ventas.filter(v => v.tipo_pago === 'transferencia').reduce((s, v) => s + v.total, 0),
    total_tarjeta: ventas.filter(v => v.tipo_pago === 'tarjeta').reduce((s, v) => s + v.total, 0),
    total_devoluciones: devoluciones.reduce((s, d) => s + d.total, 0),
    monto_esperado: ventas.filter(v => v.tipo_pago === 'efectivo').reduce((s, v) => s + v.total, 0) - devoluciones.reduce((s, d) => s + d.total, 0),
  };
  res.json(resumen);
});

app.post('/api/cortes', authMiddleware, async (req, res) => {
  const { monto_real } = req.body;
  const cajeroId = req.user.id;
  const sucursalId = req.user.sucursal_id;
  const lastCorte = await db.prepare('SELECT created_at FROM cortes_caja WHERE cajero_id=? ORDER BY created_at DESC LIMIT 1').get(cajeroId);
  const since = lastCorte ? lastCorte.created_at : '2000-01-01';

  const ventas = await db.prepare(`SELECT * FROM ventas WHERE cajero_id=? AND sucursal_id=? AND created_at > ? AND estado != 'devuelta'`).all(cajeroId, sucursalId, since);
  const devoluciones = await db.prepare(`SELECT d.* FROM devoluciones d WHERE d.cajero_id=? AND d.sucursal_id=? AND d.created_at > ?`).all(cajeroId, sucursalId, since);

  const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
  const totalEfectivo = ventas.filter(v => v.tipo_pago === 'efectivo').reduce((s, v) => s + v.total, 0);
  const totalTransferencia = ventas.filter(v => v.tipo_pago === 'transferencia').reduce((s, v) => s + v.total, 0);
  const totalTarjeta = ventas.filter(v => v.tipo_pago === 'tarjeta').reduce((s, v) => s + v.total, 0);
  const totalDevoluciones = devoluciones.reduce((s, d) => s + d.total, 0);
  const montoEsperado = totalEfectivo - totalDevoluciones;
  const diferencia = monto_real - montoEsperado;

  const result = await db.prepare(`INSERT INTO cortes_caja (cajero_id, sucursal_id, total_ventas, total_efectivo, total_transferencia, total_tarjeta, total_devoluciones, monto_esperado, monto_real, diferencia, num_ventas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(cajeroId, sucursalId, totalVentas, totalEfectivo, totalTransferencia, totalTarjeta, totalDevoluciones, montoEsperado, monto_real, diferencia, ventas.length);

  const sucNombre = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursalId);
  await crearNotificacion('corte_caja', `Corte de caja de ${req.user.nombre} en ${sucNombre.nombre}: $${totalVentas.toFixed(2)} (dif: $${diferencia.toFixed(2)})`, sucursalId);

  if (Math.abs(diferencia) > 100) {
    await crearNotificacion('alerta_corte', `Diferencia significativa en corte de ${req.user.nombre}: $${diferencia.toFixed(2)} en ${sucNombre.nombre}`, sucursalId);
  }

  res.json({ id: result.lastInsertRowid, diferencia, message: 'Corte registrado' });
});

// ===================== USUARIOS =====================
app.get('/api/usuarios', authMiddleware, adminOnly, async (req, res) => {
  res.json(await db.prepare(`SELECT u.id, u.nombre, u.usuario, u.rol, u.sucursal_id, u.activo, u.email, u.created_at, s.nombre as sucursal_nombre FROM usuarios u LEFT JOIN sucursales s ON u.sucursal_id=s.id ORDER BY u.nombre`).all());
});

app.post('/api/usuarios', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, usuario, password, rol, sucursal_id, email, pin } = req.body;
  try {
    const hashedPass = bcrypt.hashSync(password, 10);
    const hashedPin = pin ? bcrypt.hashSync(pin, 10) : null;
    const result = await db.prepare('INSERT INTO usuarios (nombre, usuario, password, rol, sucursal_id, email, pin) VALUES (?,?,?,?,?,?,?)')
      .run(nombre, usuario, hashedPass, rol, sucursal_id, email || null, hashedPin);
    res.json({ id: result.lastInsertRowid, message: 'Usuario creado' });
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'El nombre de usuario ya existe' : e.message });
  }
});

app.put('/api/usuarios/:id', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, rol, sucursal_id, activo, email, password, pin } = req.body;
  let sql = 'UPDATE usuarios SET nombre=?, rol=?, sucursal_id=?, activo=?, email=?';
  const params = [nombre, rol, sucursal_id, activo, email];
  if (password) { sql += ', password=?'; params.push(bcrypt.hashSync(password, 10)); }
  if (pin) { sql += ', pin=?'; params.push(bcrypt.hashSync(pin, 10)); }
  sql += ' WHERE id=?';
  params.push(req.params.id);
  await db.prepare(sql).run(...params);
  res.json({ message: 'Usuario actualizado' });
});

// ===================== NOTIFICACIONES =====================
app.get('/api/notificaciones', authMiddleware, async (req, res) => {
  const notifs = await db.prepare(`SELECT n.*, s.nombre as sucursal_nombre,
    (SELECT COUNT(*) FROM notificaciones_leidas nl WHERE nl.notificacion_id=n.id AND nl.usuario_id=?) as leida
    FROM notificaciones n LEFT JOIN sucursales s ON n.sucursal_origen_id=s.id ORDER BY n.created_at DESC LIMIT 100`).all(req.user.id);
  res.json(notifs);
});

app.post('/api/notificaciones/:id/leer', authMiddleware, async (req, res) => {
  try {
    await db.prepare('INSERT INTO notificaciones_leidas (notificacion_id, usuario_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(req.params.id, req.user.id);
  } catch (e) { /* already read */ }
  res.json({ ok: true });
});

app.get('/api/notificaciones/no-leidas', authMiddleware, async (req, res) => {
  const count = await db.prepare(`SELECT COUNT(*) as c FROM notificaciones n WHERE n.id NOT IN (SELECT notificacion_id FROM notificaciones_leidas WHERE usuario_id=?)`).get(req.user.id);
  res.json({ count: count.c });
});

// ===================== REPORTES =====================
app.get('/api/reportes/ventas', authMiddleware, async (req, res) => {
  const { sucursal_id, cajero_id, fecha_desde, fecha_hasta, tipo_pago, agrupar } = req.query;
  let conditions = '1=1';
  const params = [];
  if (sucursal_id) { conditions += ` AND v.sucursal_id=?`; params.push(sucursal_id); }
  if (cajero_id) { conditions += ` AND v.cajero_id=?`; params.push(cajero_id); }
  if (fecha_desde) { conditions += ` AND DATE(v.created_at) >= ?`; params.push(fecha_desde); }
  if (fecha_hasta) { conditions += ` AND DATE(v.created_at) <= ?`; params.push(fecha_hasta); }
  if (tipo_pago) { conditions += ` AND v.tipo_pago=?`; params.push(tipo_pago); }

  const resumen = await db.prepare(`SELECT COUNT(*) as total_ventas, COALESCE(SUM(v.total),0) as monto_total,
    COALESCE(SUM(CASE WHEN v.tipo_pago='efectivo' THEN v.total ELSE 0 END),0) as total_efectivo,
    COALESCE(SUM(CASE WHEN v.tipo_pago='transferencia' THEN v.total ELSE 0 END),0) as total_transferencia,
    COALESCE(SUM(CASE WHEN v.tipo_pago='tarjeta' THEN v.total ELSE 0 END),0) as total_tarjeta,
    COALESCE(SUM(v.descuento_membresia),0) as total_desc_membresia,
    COALESCE(SUM(v.descuento_promocion),0) as total_desc_promocion
    FROM ventas v WHERE ${conditions}`).get(...params);

  let detalle;
  if (agrupar === 'sucursal') {
    detalle = await db.prepare(`SELECT s.nombre as grupo, COUNT(*) as ventas, SUM(v.total) as monto FROM ventas v JOIN sucursales s ON v.sucursal_id=s.id WHERE ${conditions} GROUP BY v.sucursal_id, s.nombre`).all(...params);
  } else if (agrupar === 'cajero') {
    detalle = await db.prepare(`SELECT u.nombre as grupo, COUNT(*) as ventas, SUM(v.total) as monto FROM ventas v JOIN usuarios u ON v.cajero_id=u.id WHERE ${conditions} GROUP BY v.cajero_id, u.nombre`).all(...params);
  } else if (agrupar === 'dia') {
    detalle = await db.prepare(`SELECT DATE(v.created_at) as grupo, COUNT(*) as ventas, SUM(v.total) as monto FROM ventas v WHERE ${conditions} GROUP BY DATE(v.created_at) ORDER BY grupo`).all(...params);
  } else {
    detalle = await db.prepare(`SELECT v.ticket_numero, v.total, v.tipo_pago, v.created_at, s.nombre as sucursal, u.nombre as cajero FROM ventas v JOIN sucursales s ON v.sucursal_id=s.id JOIN usuarios u ON v.cajero_id=u.id WHERE ${conditions} ORDER BY v.created_at DESC LIMIT 200`).all(...params);
  }

  res.json({ resumen, detalle });
});

app.get('/api/reportes/productos-top', authMiddleware, async (req, res) => {
  const { sucursal_id, fecha_desde, fecha_hasta, limit: lim } = req.query;
  let conditions = '1=1';
  const params = [];
  if (sucursal_id) { conditions += ` AND v.sucursal_id=?`; params.push(sucursal_id); }
  if (fecha_desde) { conditions += ` AND DATE(v.created_at) >= ?`; params.push(fecha_desde); }
  if (fecha_hasta) { conditions += ` AND DATE(v.created_at) <= ?`; params.push(fecha_hasta); }

  const top = await db.prepare(`SELECT p.clave, p.nombre, SUM(vd.cantidad) as total_vendido, SUM(vd.subtotal) as total_monto
    FROM venta_detalle vd JOIN ventas v ON vd.venta_id=v.id JOIN productos p ON vd.producto_id=p.id
    WHERE ${conditions} GROUP BY vd.producto_id, p.clave, p.nombre ORDER BY total_vendido DESC LIMIT ?`).all(...params, parseInt(lim) || 20);
  res.json(top);
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const ventasHoy = await db.prepare(`SELECT COUNT(*) as num, COALESCE(SUM(total),0) as monto FROM ventas WHERE DATE(created_at) = ?`).get(hoy);
  const alertasStock = await db.prepare(`SELECT COUNT(*) as c FROM inventario i JOIN productos p ON i.producto_id=p.id WHERE i.stock <= p.stock_minimo AND p.activo=1`).get();
  const totalProductos = await db.prepare(`SELECT COUNT(*) as c FROM productos WHERE activo=1`).get();
  const ventasPorSucursal = await db.prepare(`SELECT s.nombre, COUNT(v.id) as ventas, COALESCE(SUM(v.total),0) as monto FROM sucursales s LEFT JOIN ventas v ON s.id=v.sucursal_id AND DATE(v.created_at)=? GROUP BY s.id, s.nombre`).all(hoy);

  res.json({
    ventas_hoy: ventasHoy,
    alertas_stock: alertasStock.c,
    total_productos: totalProductos.c,
    ventas_por_sucursal: ventasPorSucursal
  });
});


// ===================== ASISTENTE IA (Búsqueda inteligente) =====================
app.get('/api/asistente', authMiddleware, async (req, res) => {
  const { consulta, sucursal_id } = req.query;
  if (!consulta || consulta.trim().length < 2) return res.json({ respuesta: 'Escribe al menos 2 caracteres para buscar.', productos: [] });

  const q = consulta.toLowerCase().trim();
  
  // Normalize common terms
  const aliases = {
    'tornillo': ['tornillo','perno','birlo'],
    'tuerca': ['tuerca','nut'],
    'hule': ['hule','goma','caucho','rubber'],
    'manguera': ['manguera','tubo flexible'],
    'abrazadera': ['abrazadera','clamp','cincho'],
    'rondana': ['rondana','arandela','washer'],
    'sello': ['sello','junta','empaque','gasket'],
    'soporte': ['soporte','base','montura'],
    'aceite': ['aceite','lubricante','grasa'],
  };

  // Expand search terms
  let searchTerms = [q];
  for (const [key, synonyms] of Object.entries(aliases)) {
    if (synonyms.some(s => q.includes(s))) {
      searchTerms = [...searchTerms, ...synonyms.filter(s => s !== q)];
    }
  }

  // Build LIKE conditions for each term
  const conditions = searchTerms.map(() => `(LOWER(p.nombre) LIKE ? OR LOWER(p.clave) LIKE ? OR LOWER(p.descripcion) LIKE ?)`).join(' OR ');
  const params = searchTerms.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]);

  const sql = `SELECT p.*, c.nombre as categoria_nombre FROM productos p 
    LEFT JOIN categorias c ON p.categoria_id=c.id WHERE p.activo=1 AND (${conditions}) ORDER BY p.nombre LIMIT 30`;
  
  const productos = await db.prepare(sql).all(...params);

  // Add stock info
  for (const p of productos) {
    p.inventario = await db.prepare('SELECT i.*, s.nombre as sucursal_nombre FROM inventario i JOIN sucursales s ON i.sucursal_id=s.id WHERE i.producto_id=?').all(p.id);
    p.stock_total = p.inventario.reduce((sum, i) => sum + i.stock, 0);
    if (sucursal_id) {
      const inv = p.inventario.find(i => i.sucursal_id == sucursal_id);
      p.stock_local = inv ? inv.stock : 0;
    }
  }

  // Generate smart response
  let respuesta = '';
  if (productos.length === 0) {
    respuesta = `No encontré productos que coincidan con "${consulta}". Intenta con otro término o revisa la ortografía.`;
  } else if (productos.length === 1) {
    const p = productos[0];
    const stockInfo = sucursal_id ? `Stock en tu sucursal: ${p.stock_local} uds.` : `Stock total: ${p.stock_total} uds.`;
    respuesta = `Encontré: ${p.clave} - ${p.nombre}. Precio menudeo: $${p.precio_menudeo.toFixed(2)}, medio mayoreo: $${p.precio_medio_mayoreo.toFixed(2)}, mayoreo: $${p.precio_mayoreo.toFixed(2)}. ${stockInfo}`;
  } else {
    const conStock = productos.filter(p => sucursal_id ? p.stock_local > 0 : p.stock_total > 0);
    const sinStock = productos.length - conStock.length;
    respuesta = `Encontré ${productos.length} productos relacionados con "${consulta}". ${conStock.length} con stock disponible${sinStock > 0 ? ` y ${sinStock} sin stock` : ''}.`;
  }

  res.json({ respuesta, productos, total: productos.length });
});

// ===================== SYNC OFFLINE (Cola de ventas) =====================
app.post('/api/sync/ventas', authMiddleware, async (req, res) => {
  const { ventas_offline } = req.body;
  if (!ventas_offline || !Array.isArray(ventas_offline)) return res.status(400).json({ error: 'Se requiere un array de ventas' });

  const resultados = [];
  for (const ventaOffline of ventas_offline) {
    try {
      const { items, cliente_id, tipo_pago, autorizado_por, timestamp_offline } = ventaOffline;
      if (!items || items.length === 0) { resultados.push({ offline_id: ventaOffline.offline_id, status: 'error', error: 'Sin productos' }); continue; }

      const sucursal_id = req.user.sucursal_id;
      const ticket_numero = await generarTicket(sucursal_id);
      const promos = await db.prepare(`SELECT * FROM promociones WHERE activo=1 AND fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE`).all();

      let descuentoMembresia = 0;
      if (cliente_id) {
        const cli = await db.prepare('SELECT tm.descuento FROM clientes cl LEFT JOIN tipos_membresia tm ON cl.membresia_id=tm.id WHERE cl.id=?').get(cliente_id);
        if (cli && cli.descuento) descuentoMembresia = cli.descuento;
      }

      let subtotal = 0, totalDescPromo = 0;
      const detalles = [];

      for (const item of items) {
        const prod = await db.prepare('SELECT * FROM productos WHERE id=?').get(item.producto_id);
        if (!prod) { resultados.push({ offline_id: ventaOffline.offline_id, status: 'error', error: `Producto ${item.producto_id} no encontrado` }); continue; }
        const inv = await db.prepare('SELECT stock FROM inventario WHERE producto_id=? AND sucursal_id=?').get(item.producto_id, sucursal_id);
        if (!inv || inv.stock < item.cantidad) { resultados.push({ offline_id: ventaOffline.offline_id, status: 'error', error: `Stock insuficiente para ${prod.clave}` }); continue; }

        let precio, tipoPrecio;
        if (item.cantidad >= prod.cantidad_mayoreo) { precio = prod.precio_mayoreo; tipoPrecio = 'mayoreo'; }
        else if (item.cantidad >= prod.cantidad_medio_mayoreo) { precio = prod.precio_medio_mayoreo; tipoPrecio = 'medio_mayoreo'; }
        else { precio = prod.precio_menudeo; tipoPrecio = 'menudeo'; }

        let descPromo = 0;
        for (const pr of promos) {
          if (pr.aplica_a === 'todo' || (pr.aplica_a === 'producto' && pr.producto_id === item.producto_id) || (pr.aplica_a === 'categoria' && pr.categoria_id === prod.categoria_id)) {
            if (pr.tipo === 'porcentaje') descPromo = (precio * item.cantidad) * (pr.valor / 100);
            else descPromo = Math.min(pr.valor, precio * item.cantidad);
            break;
          }
        }
        const itemSubtotal = (precio * item.cantidad) - descPromo;
        subtotal += precio * item.cantidad;
        totalDescPromo += descPromo;
        detalles.push({ producto_id: item.producto_id, cantidad: item.cantidad, precio_unitario: precio, tipo_precio: tipoPrecio, descuento_promo: descPromo, subtotal: itemSubtotal });
      }

      if (detalles.length === 0) continue;

      const montoDescMembresia = (subtotal - totalDescPromo) * (descuentoMembresia / 100);
      const total = subtotal - totalDescPromo - montoDescMembresia;

      const ventaResult = await db.prepare(`INSERT INTO ventas (ticket_numero, sucursal_id, cajero_id, cliente_id, subtotal, descuento_membresia, descuento_promocion, total, tipo_pago, autorizado_por) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(ticket_numero, sucursal_id, req.user.id, cliente_id || null, subtotal, montoDescMembresia, totalDescPromo, total, tipo_pago, autorizado_por || null);
      const ventaId = ventaResult.lastInsertRowid;

      for (const d of detalles) {
        await db.prepare('INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario, tipo_precio, descuento_promo, subtotal) VALUES (?,?,?,?,?,?,?)').run(ventaId, d.producto_id, d.cantidad, d.precio_unitario, d.tipo_precio, d.descuento_promo, d.subtotal);
        await db.prepare('UPDATE inventario SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE producto_id=? AND sucursal_id=?').run(d.cantidad, d.producto_id, sucursal_id);
        await db.prepare('INSERT INTO movimientos_inventario (producto_id, sucursal_id, tipo, cantidad, referencia, usuario_id) VALUES (?,?,?,?,?,?)').run(d.producto_id, sucursal_id, 'venta', d.cantidad, ticket_numero, req.user.id);

        const invAfter = await db.prepare('SELECT i.stock, p.stock_minimo, p.clave, p.nombre FROM inventario i JOIN productos p ON i.producto_id=p.id WHERE i.producto_id=? AND i.sucursal_id=?').get(d.producto_id, sucursal_id);
        if (invAfter && invAfter.stock <= invAfter.stock_minimo) {
          const sucNombre = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_id);
          const tipoAlerta = invAfter.stock === 0 ? 'stock_cero' : 'stock_bajo';
          await crearNotificacion(tipoAlerta, `${tipoAlerta === 'stock_cero' ? 'SIN STOCK' : 'Stock bajo'}: ${invAfter.clave} - ${invAfter.nombre} (${invAfter.stock} uds) en ${sucNombre.nombre}`, sucursal_id);
        }
      }

      const sucNombre = await db.prepare('SELECT nombre FROM sucursales WHERE id=?').get(sucursal_id);
      await crearNotificacion('venta', `Venta offline sincronizada: ${ticket_numero} por $${total.toFixed(2)} (${tipo_pago}) en ${sucNombre.nombre}`, sucursal_id);

      resultados.push({ offline_id: ventaOffline.offline_id, status: 'ok', ticket_numero, total, venta_id: ventaId });
    } catch (e) {
      resultados.push({ offline_id: ventaOffline.offline_id, status: 'error', error: e.message });
    }
  }

  res.json({ sincronizadas: resultados.filter(r => r.status === 'ok').length, errores: resultados.filter(r => r.status === 'error').length, resultados });
});

// ===================== CACHE DATA (para modo offline) =====================
app.get('/api/cache/productos', authMiddleware, async (req, res) => {
  const { sucursal_id } = req.query;
  const productos = await db.prepare(`SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id=c.id WHERE p.activo=1 ORDER BY p.clave`).all();
  for (const p of productos) {
    if (sucursal_id) {
      const inv = await db.prepare('SELECT stock FROM inventario WHERE producto_id=? AND sucursal_id=?').get(p.id, sucursal_id);
      p.stock_local = inv ? inv.stock : 0;
    }
    const invAll = await db.prepare('SELECT SUM(stock) as total FROM inventario WHERE producto_id=?').get(p.id);
    p.stock_total = invAll ? invAll.total : 0;
  }
  const categorias = await db.prepare('SELECT * FROM categorias').all();
  const clientes = await db.prepare('SELECT cl.*, tm.nombre as membresia_nombre, tm.descuento FROM clientes cl LEFT JOIN tipos_membresia tm ON cl.membresia_id=tm.id ORDER BY cl.nombre').all();
  res.json({ productos, categorias, clientes, timestamp: new Date().toISOString() });
});
// ===================== HEALTH CHECK =====================
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.prepare('SELECT 1 as ok').get();
    res.json({ status: 'ok', db: result ? 'connected' : 'error', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// ===================== SOCKET.IO =====================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ===================== CATCH-ALL: SERVE SPA =====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================== START =====================
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  HERGON POS - Sistema de Gestión`);
  console.log(`  Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`  DB: ${process.env.DATABASE_URL ? 'PostgreSQL (Railway)' : 'SQLite (local)'}`);
  console.log(`========================================`);
  console.log(`  Admin: usuario=admin, password=admin123, PIN=1234`);
  console.log(`  Cajero: usuario=maria (o juan/ana/pedro/etc), password=cajero123`);
  console.log(`========================================\n`);
});

} // end startServer

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});