import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ShoppingCart, Package, Receipt, Users, Tags, UserCog, BarChart3, Bell, LogOut, ChevronRight, Plus, Minus, Trash2, X, Lock, Eye, Printer, ArrowLeftRight, TrendingUp, AlertTriangle, DollarSign, CreditCard, Smartphone, Banknote, CheckCircle, Wrench } from "lucide-react";

// ============ MOCK DATA ============
const SUCURSALES = [
  { id: 1, nombre: "HERGON Matriz Coatepec", direccion: "Av. Constitución 45, Coatepec", ciudad: "Coatepec", telefono: "228-816-0001" },
  { id: 2, nombre: "HERGON Xalapa Centro", direccion: "Calle Enríquez 120, Centro", ciudad: "Xalapa", telefono: "228-816-0002" },
  { id: 3, nombre: "HERGON Xalapa Sur", direccion: "Av. Lázaro Cárdenas 890", ciudad: "Xalapa", telefono: "228-816-0003" },
  { id: 4, nombre: "HERGON Xalapa Norte", direccion: "Blvd. Xalapa 456", ciudad: "Xalapa", telefono: "228-816-0004" },
];
const CATEGORIAS = [
  { id: 1, nombre: "Tornillos y Tuercas" }, { id: 2, nombre: "Hules y Empaques" }, { id: 3, nombre: "Abrazaderas" },
  { id: 4, nombre: "Mangueras" }, { id: 5, nombre: "Rodamientos" }, { id: 6, nombre: "Retenes y Sellos" },
  { id: 7, nombre: "Soportes Motor/Trans." }, { id: 8, nombre: "Bujes y Gomas" }, { id: 9, nombre: "Juntas y Empaques" }, { id: 10, nombre: "Ferretería General" },
];
const MEMBRESIAS = [
  { id: 1, nombre: "Bronce", descuento: 5 }, { id: 2, nombre: "Plata", descuento: 10 }, { id: 3, nombre: "Oro", descuento: 15 },
];
const USERS_DB = [
  { id: 1, nombre: "Administradora HERGON", usuario: "admin", password: "admin123", rol: "administrador", sucursal_id: 1, sucursal_nombre: "HERGON Matriz Coatepec", pin: "1234", activo: 1, email: "admin@hergon.mx" },
  { id: 2, nombre: "María López", usuario: "maria", password: "cajero123", rol: "cajero", sucursal_id: 1, sucursal_nombre: "HERGON Matriz Coatepec", pin: null, activo: 1, email: "" },
  { id: 3, nombre: "Juan Pérez", usuario: "juan", password: "cajero123", rol: "cajero", sucursal_id: 2, sucursal_nombre: "HERGON Xalapa Centro", pin: null, activo: 1, email: "" },
  { id: 4, nombre: "Ana García", usuario: "ana", password: "cajero123", rol: "cajero", sucursal_id: 3, sucursal_nombre: "HERGON Xalapa Sur", pin: null, activo: 1, email: "" },
  { id: 5, nombre: "Pedro Ruiz", usuario: "pedro", password: "cajero123", rol: "cajero", sucursal_id: 4, sucursal_nombre: "HERGON Xalapa Norte", pin: null, activo: 1, email: "" },
];

const PRODUCTOS_RAW = [
  { id:1, clave:"TOR-001", nombre:"Tornillo hex 1/4 x 1\"", cat:1, pm:3.5, pmm:3.0, pmy:2.5, cmm:10, cmy:25, min:5 },
  { id:2, clave:"TOR-002", nombre:"Tornillo hex 5/16 x 1.5\"", cat:1, pm:4.5, pmm:4.0, pmy:3.5, cmm:10, cmy:25, min:5 },
  { id:3, clave:"TOR-003", nombre:"Tornillo allen 3/8 x 2\"", cat:1, pm:6.0, pmm:5.0, pmy:4.5, cmm:10, cmy:25, min:5 },
  { id:4, clave:"TOR-004", nombre:"Tuerca hex 1/4\"", cat:1, pm:1.5, pmm:1.2, pmy:1.0, cmm:20, cmy:50, min:10 },
  { id:5, clave:"TOR-005", nombre:"Tuerca hex 5/16\"", cat:1, pm:2.0, pmm:1.7, pmy:1.5, cmm:20, cmy:50, min:10 },
  { id:6, clave:"HUL-001", nombre:"Hule soporte motor Tsuru", cat:2, pm:85, pmm:75, pmy:65, cmm:5, cmy:12, min:3 },
  { id:7, clave:"HUL-002", nombre:"Hule soporte motor Jetta A4", cat:2, pm:120, pmm:105, pmy:95, cmm:5, cmy:12, min:3 },
  { id:8, clave:"HUL-003", nombre:"Hule barra estabilizadora universal", cat:2, pm:45, pmm:38, pmy:32, cmm:6, cmy:15, min:4 },
  { id:9, clave:"HUL-004", nombre:"Goma horquilla suspensión", cat:2, pm:35, pmm:30, pmy:25, cmm:8, cmy:20, min:4 },
  { id:10, clave:"ABR-001", nombre:"Abrazadera 1/2\"", cat:3, pm:8, pmm:7, pmy:6, cmm:12, cmy:30, min:8 },
  { id:11, clave:"ABR-002", nombre:"Abrazadera 3/4\"", cat:3, pm:10, pmm:8.5, pmy:7, cmm:12, cmy:30, min:8 },
  { id:12, clave:"ABR-003", nombre:"Clip retención puerta", cat:3, pm:5, pmm:4, pmy:3.5, cmm:15, cmy:40, min:10 },
  { id:13, clave:"MAN-001", nombre:"Manguera radiador Chevy 1\"", cat:4, pm:95, pmm:85, pmy:75, cmm:4, cmy:10, min:3 },
  { id:14, clave:"MAN-002", nombre:"Manguera calefacción 5/8\"", cat:4, pm:65, pmm:55, pmy:48, cmm:5, cmy:12, min:3 },
  { id:15, clave:"ROD-001", nombre:"Rodamiento rueda delantera Tsuru", cat:5, pm:180, pmm:160, pmy:145, cmm:3, cmy:8, min:2 },
  { id:16, clave:"ROD-002", nombre:"Balero 6204", cat:5, pm:55, pmm:48, pmy:42, cmm:6, cmy:15, min:4 },
  { id:17, clave:"RET-001", nombre:"Retén cigüeñal delantero", cat:6, pm:75, pmm:65, pmy:58, cmm:4, cmy:10, min:3 },
  { id:18, clave:"RET-002", nombre:"Sello válvulas (juego)", cat:6, pm:120, pmm:105, pmy:95, cmm:3, cmy:8, min:2 },
  { id:19, clave:"SOP-001", nombre:"Soporte motor derecho Aveo", cat:7, pm:350, pmm:310, pmy:280, cmm:2, cmy:5, min:2 },
  { id:20, clave:"SOP-002", nombre:"Soporte transmisión Jetta A4", cat:7, pm:420, pmm:380, pmy:340, cmm:2, cmy:5, min:2 },
  { id:21, clave:"BUJ-001", nombre:"Buje horquilla inferior Tsuru", cat:8, pm:45, pmm:38, pmy:32, cmm:6, cmy:15, min:4 },
  { id:22, clave:"BUJ-002", nombre:"Goma tirante barra Chevy", cat:8, pm:25, pmm:22, pmy:18, cmm:8, cmy:20, min:5 },
  { id:23, clave:"JUN-001", nombre:"Junta culata Tsuru 16V", cat:9, pm:280, pmm:250, pmy:225, cmm:2, cmy:5, min:2 },
  { id:24, clave:"JUN-002", nombre:"Empaque múltiple admisión", cat:9, pm:85, pmm:75, pmy:65, cmm:3, cmy:8, min:2 },
  { id:25, clave:"FER-001", nombre:"Arandela plana 1/4\"", cat:10, pm:0.8, pmm:0.6, pmy:0.5, cmm:25, cmy:50, min:15 },
  { id:26, clave:"FER-002", nombre:"Rondana presión 5/16\"", cat:10, pm:1.2, pmm:1.0, pmy:0.8, cmm:20, cmy:40, min:10 },
  { id:27, clave:"TOR-006", nombre:"Birlo rueda 12x1.5", cat:1, pm:18, pmm:15, pmy:13, cmm:8, cmy:20, min:6 },
  { id:28, clave:"HUL-005", nombre:"Hule tope suspensión", cat:2, pm:55, pmm:48, pmy:42, cmm:5, cmy:12, min:3 },
  { id:29, clave:"MAN-003", nombre:"Manguera vacío 3mm (metro)", cat:4, pm:15, pmm:12, pmy:10, cmm:10, cmy:25, min:5 },
  { id:30, clave:"ROD-003", nombre:"Rodamiento clutch Chevy", cat:5, pm:195, pmm:175, pmy:158, cmm:3, cmy:8, min:2 },
];

function initInventario() {
  const inv = {};
  PRODUCTOS_RAW.forEach(p => {
    inv[p.id] = {};
    SUCURSALES.forEach(s => {
      inv[p.id][s.id] = Math.floor(Math.random() * 25) + 2;
    });
  });
  return inv;
}

function initClientes() {
  return [
    { id: 1, nombre: "Autopartes González", telefono: "228-100-1234", email: "gonzalez@auto.mx", membresia_id: 2, membresia_nombre: "Plata", descuento: 10 },
    { id: 2, nombre: "Público General", telefono: "", email: "", membresia_id: null, membresia_nombre: null, descuento: 0 },
    { id: 3, nombre: "Roberto Sánchez", telefono: "228-200-5678", email: "rsanchez@mail.com", membresia_id: 1, membresia_nombre: "Bronce", descuento: 5 },
    { id: 4, nombre: "Taller Mecánico Hernández", telefono: "228-300-9012", email: "taller.hdz@mail.com", membresia_id: 3, membresia_nombre: "Oro", descuento: 15 },
    { id: 5, nombre: "Laura Martínez", telefono: "228-400-3456", email: "", membresia_id: null, membresia_nombre: null, descuento: 0 },
  ];
}

// ============ GLOBAL STATE ============
let INVENTARIO = initInventario();
let CLIENTES = initClientes();
let VENTAS = [];
let CORTES = [];
let NOTIFICACIONES = [];
let PROMOS = [{ id: 1, nombre: "Promo Tornillos 10%", tipo: "porcentaje", valor: 10, aplica_a: "categoria", categoria_id: 1, categoria_nombre: "Tornillos y Tuercas", producto_id: null, producto_nombre: null, fecha_inicio: "2026-01-01", fecha_fin: "2026-12-31", activo: 1 }];
let ventaIdCounter = 1;
let corteIdCounter = 1;
let notifIdCounter = 1;

function addNotif(tipo, mensaje) {
  NOTIFICACIONES.unshift({ id: notifIdCounter++, tipo, mensaje, created_at: new Date().toISOString(), leida: false });
}

// ============ STYLES ============
const colors = { p: "#1a56db", pd: "#1e3a8a", ok: "#059669", warn: "#d97706", err: "#dc2626", bg: "#f0f2f5", card: "#fff", brd: "#e5e7eb", txt: "#1a1a2e", txtl: "#6b7280" };

// ============ LOGIN ============
function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const user = USERS_DB.find(x => x.usuario === u && x.password === p && x.activo);
    if (!user) { setErr("Usuario o contraseña incorrectos"); return; }
    onLogin({ ...user });
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1e3a5f,#0f1b2d)" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 36, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <Wrench size={36} color={colors.p} style={{ marginBottom: 4 }} />
          <h1 style={{ color: colors.pd, fontSize: 24 }}>HERGON</h1>
        </div>
        <p style={{ textAlign: "center", color: colors.txtl, marginBottom: 20, fontSize: 13 }}>Sistema de Gestión - Punto de Venta</p>
        {err && <div style={{ background: "#fee2e2", color: "#991b1b", padding: 8, borderRadius: 7, marginBottom: 10, fontSize: 12 }}>{err}</div>}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Usuario</label>
            <input value={u} onChange={e => setU(e.target.value)} placeholder="admin" autoFocus style={{ padding: "8px 12px", border: `1px solid ${colors.brd}`, borderRadius: 7, fontSize: 14, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Contraseña</label>
            <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="admin123" style={{ padding: "8px 12px", border: `1px solid ${colors.brd}`, borderRadius: 7, fontSize: 14, width: "100%", boxSizing: "border-box" }} />
          </div>
          <button type="submit" style={{ width: "100%", padding: "10px 20px", background: colors.p, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Iniciar Sesión</button>
        </form>
        <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.6 }}>
          <b>Admin:</b> admin / admin123<br /><b>Cajero:</b> maria / cajero123
        </div>
      </div>
    </div>
  );
}

// ============ PILL ============
function Pill({ color, children }) {
  const colorMap = { green: { bg: "#dcfce7", fg: "#166534" }, yellow: { bg: "#fef9c3", fg: "#854d0e" }, red: { bg: "#fee2e2", fg: "#991b1b" }, blue: { bg: "#dbeafe", fg: "#1e40af" }, gray: { bg: "#f3f4f6", fg: "#374151" }, purple: { bg: "#f3e8ff", fg: "#6b21a8" } };
  const c = colorMap[color] || colorMap.gray;
  return <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, display: "inline-block", background: c.bg, color: c.fg }}>{children}</span>;
}

// ============ BUTTON ============
function Btn({ variant = "primary", size = "md", children, ...props }) {
  const variants = { primary: { bg: colors.p, color: "#fff" }, success: { bg: colors.ok, color: "#fff" }, warning: { bg: colors.warn, color: "#fff" }, danger: { bg: colors.err, color: "#fff" }, outline: { bg: "transparent", color: colors.txt, border: `1px solid ${colors.brd}` } };
  const sizes = { sm: { padding: "4px 8px", fontSize: 11 }, md: { padding: "7px 14px", fontSize: 13 }, lg: { padding: "10px 20px", fontSize: 15 } };
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  return <button {...props} style={{ ...v, ...s, border: v.border || "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, transition: ".2s", ...props.style }}>{children}</button>;
}

// ============ INPUT ============
function Input(props) {
  return <input {...props} style={{ padding: "7px 10px", border: `1px solid ${colors.brd}`, borderRadius: 7, fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit", ...props.style }} />;
}
function Select({ children, ...props }) {
  return <select {...props} style={{ padding: "7px 10px", border: `1px solid ${colors.brd}`, borderRadius: 7, fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit", ...props.style }}>{children}</select>;
}

// ============ MODAL ============
function Modal({ children, wide, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: wide ? 850 : 560, width: "92%", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ============ SIDEBAR ============
function Sidebar({ page, setPage, user, onLogout }) {
  const isAdmin = user.rol === "administrador";
  const items = [
    { id: "dashboard", icon: <BarChart3 size={16} />, label: "Dashboard" },
    { id: "pos", icon: <ShoppingCart size={16} />, label: "Punto de Venta" },
    { id: "inventario", icon: <Package size={16} />, label: "Inventario" },
    { id: "cortes", icon: <Receipt size={16} />, label: "Cortes de Caja" },
    { id: "div1" },
    { id: "clientes", icon: <Users size={16} />, label: "Clientes" },
    ...(isAdmin ? [
      { id: "promociones", icon: <Tags size={16} />, label: "Promociones" },
      { id: "usuarios", icon: <UserCog size={16} />, label: "Usuarios" },
      { id: "reportes", icon: <TrendingUp size={16} />, label: "Reportes" },
    ] : []),
  ];
  return (
    <div style={{ width: 230, background: "linear-gradient(180deg,#1e3a5f,#0f1b2d)", color: "#fff", height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 18, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <h2 style={{ fontSize: 17, color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Wrench size={18} /> HERGON POS</h2>
        <small style={{ color: "#94a3b8", fontSize: 11 }}>Tornillos y Hules Automotrices</small>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {items.map((it, i) => it.id.startsWith("div") ? <div key={i} style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "6px 14px" }} /> :
          <div key={it.id} onClick={() => setPage(it.id)} style={{ display: "flex", alignItems: "center", padding: "11px 18px", color: page === it.id ? "#60a5fa" : "#cbd5e1", cursor: "pointer", borderLeft: `3px solid ${page === it.id ? "#60a5fa" : "transparent"}`, background: page === it.id ? "rgba(96,165,250,.15)" : "transparent", fontSize: 13, gap: 10, transition: ".2s" }}>
            {it.icon}<span>{it.label}</span>
          </div>
        )}
      </div>
      <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.1)", fontSize: 12, color: "#94a3b8" }}>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{user.nombre}</div>
        <div>{user.sucursal_nombre} · {user.rol === "administrador" ? "Admin" : "Cajero"}</div>
        <button onClick={onLogout} style={{ marginTop: 8, width: "100%", padding: "5px 8px", background: "transparent", border: "1px solid rgba(255,255,255,.2)", borderRadius: 5, color: "#cbd5e1", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><LogOut size={12} /> Cerrar sesión</button>
      </div>
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard({ user }) {
  const sucId = user.sucursal_id;
  const ventasHoy = VENTAS.filter(v => v.sucursal_id === sucId);
  const monto = ventasHoy.reduce((s, v) => s + v.total, 0);
  const alertas = Object.entries(INVENTARIO).filter(([pid, inv]) => {
    const prod = PRODUCTOS_RAW.find(p => p.id === parseInt(pid));
    return prod && Object.values(inv).some(stock => stock <= prod.min);
  }).length;
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard icon={<ShoppingCart size={28} color="#93c5fd" />} value={ventasHoy.length} label="Ventas hoy" />
        <StatCard icon={<DollarSign size={28} color="#93c5fd" />} value={`$${monto.toFixed(2)}`} label="Monto total hoy" />
        <StatCard icon={<AlertTriangle size={28} color="#fbbf24" />} value={alertas} label="Alertas de stock" color={colors.warn} />
        <StatCard icon={<Package size={28} color="#93c5fd" />} value={PRODUCTOS_RAW.length} label="Productos activos" />
      </div>
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Ventas por Sucursal (Hoy)</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Sucursal", "Ventas", "Monto"].map(h => <th key={h} style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` }}>{h}</th>)}</tr></thead>
          <tbody>{SUCURSALES.map(s => {
            const vs = VENTAS.filter(v => v.sucursal_id === s.id);
            return <tr key={s.id}><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{s.nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{vs.length}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13, fontWeight: 700 }}>${vs.reduce((s, v) => s + v.total, 0).toFixed(2)}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 16, border: `1px solid ${colors.brd}` }}>
      <div style={{ float: "right", marginTop: -6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || colors.p }}>{value}</div>
      <div style={{ fontSize: 12, color: colors.txtl, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ============ POS ============
function POS({ user }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [tipoPago, setTipoPago] = useState("efectivo");
  const [showTicket, setShowTicket] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [showCli, setShowCli] = useState(false);

  const prods = PRODUCTOS_RAW.filter(p => {
    if (q && !p.clave.toLowerCase().includes(q.toLowerCase()) && !p.nombre.toLowerCase().includes(q.toLowerCase())) return false;
    if (cat && p.cat !== parseInt(cat)) return false;
    return true;
  }).map(p => ({ ...p, stock_local: INVENTARIO[p.id]?.[user.sucursal_id] || 0 }));

  const addToCart = (prod) => {
    setCart(c => {
      const ex = c.find(i => i.producto_id === prod.id);
      if (ex) return c.map(i => i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + 1, precio: getPrice(prod, i.cantidad + 1) } : i);
      return [...c, { producto_id: prod.id, clave: prod.clave, nombre: prod.nombre, cantidad: 1, precio: prod.pm, stock: prod.stock_local, p_men: prod.pm, p_mmed: prod.pmm, p_may: prod.pmy, c_mmed: prod.cmm, c_may: prod.cmy }];
    });
  };

  const getPrice = (prod, qty) => {
    if (qty >= prod.cmy) return prod.pmy;
    if (qty >= prod.cmm) return prod.pmm;
    return prod.pm;
  };

  const updQty = (pid, delta) => {
    setCart(c => c.map(i => {
      if (i.producto_id !== pid) return i;
      const nq = Math.max(0, i.cantidad + delta);
      const prod = PRODUCTOS_RAW.find(p => p.id === pid);
      let pr = prod.pm;
      if (nq >= prod.cmy) pr = prod.pmy;
      else if (nq >= prod.cmm) pr = prod.pmm;
      return nq === 0 ? null : { ...i, cantidad: nq, precio: pr };
    }).filter(Boolean));
  };

  const subtotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const completeSale = () => {
    const suc = SUCURSALES.find(s => s.id === user.sucursal_id);
    const ticket = `T${user.sucursal_id}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(VENTAS.length + 1).padStart(4, "0")}`;
    let descMemb = 0;
    if (cliente?.descuento) descMemb = subtotal * (cliente.descuento / 100);
    const total = subtotal - descMemb;
    const detalles = cart.map(i => ({ clave: i.clave, nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio, subtotal: i.precio * i.cantidad }));

    // Deduct stock
    cart.forEach(i => { if (INVENTARIO[i.producto_id]?.[user.sucursal_id] !== undefined) INVENTARIO[i.producto_id][user.sucursal_id] = Math.max(0, INVENTARIO[i.producto_id][user.sucursal_id] - i.cantidad); });

    const venta = { id: ventaIdCounter++, ticket_numero: ticket, total, subtotal, descuento_membresia: descMemb, descuento_promocion: 0, tipo_pago: tipoPago, sucursal_id: user.sucursal_id, sucursal_nombre: suc.nombre, sucursal_direccion: suc.direccion, cajero_nombre: user.nombre, cajero_id: user.id, cliente_nombre: cliente?.nombre || null, detalles, created_at: new Date().toISOString() };
    VENTAS.push(venta);
    addNotif("venta", `Venta ${ticket} por $${total.toFixed(2)} (${tipoPago}) en ${suc.nombre}`);

    // Check low stock
    cart.forEach(i => {
      const prod = PRODUCTOS_RAW.find(p => p.id === i.producto_id);
      const stock = INVENTARIO[i.producto_id]?.[user.sucursal_id] || 0;
      if (prod && stock <= prod.min && stock > 0) addNotif("stock_bajo", `Stock bajo: ${prod.clave} - ${prod.nombre} (${stock} uds) en ${suc.nombre}`);
      if (stock === 0) addNotif("stock_cero", `SIN STOCK: ${prod.clave} - ${prod.nombre} en ${suc.nombre}`);
    });

    setShowTicket(venta);
    setCart([]);
    setCliente(null);
    setTipoPago("efectivo");
  };

  const handlePay = () => {
    if (cart.length === 0) return alert("Agrega productos al carrito");
    if (tipoPago === "tarjeta" && user.rol !== "administrador") { setShowPin(true); setPin(""); setPinErr(""); return; }
    completeSale();
  };

  const verifyPin = () => {
    const admin = USERS_DB.find(u => u.rol === "administrador" && u.pin === pin);
    if (!admin) { setPinErr("PIN incorrecto"); return; }
    setShowPin(false);
    completeSale();
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14, height: "calc(100vh - 120px)" }}>
        {/* Products */}
        <div style={{ overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Input placeholder="Buscar por clave o nombre..." value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
            <Select value={cat} onChange={e => setCat(e.target.value)} style={{ width: 180 }}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
            {prods.map(p => (
              <div key={p.id} onClick={() => p.stock_local > 0 && addToCart(p)} style={{ background: "#fff", border: `1px solid ${colors.brd}`, borderRadius: 8, padding: 12, cursor: p.stock_local > 0 ? "pointer" : "not-allowed", opacity: p.stock_local > 0 ? 1 : .6, transition: ".2s" }}>
                <div style={{ fontSize: 10, color: colors.p, fontWeight: 700 }}>{p.clave}</div>
                <div style={{ fontSize: 13, fontWeight: 600, margin: "3px 0" }}>{p.nombre}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: colors.ok }}>${p.pm.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: p.stock_local === 0 ? colors.err : p.stock_local <= p.min ? colors.warn : colors.txtl }}>
                  Stock: {p.stock_local} {p.stock_local === 0 && "· SIN STOCK"}
                </div>
              </div>
            ))}
            {prods.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 36, color: colors.txtl }}><Search size={42} color="#d1d5db" style={{ display: "block", margin: "0 auto 12px" }} /><p>Busca productos para agregar</p></div>}
          </div>
        </div>

        {/* Cart */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}`, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><ShoppingCart size={16} /> Carrito</span>
            <Pill color="blue">{cart.length} items</Pill>
          </div>
          {/* Client */}
          <div style={{ marginBottom: 10 }}>
            <Btn variant="outline" size="sm" onClick={() => setShowCli(true)}><Users size={12} /> {cliente ? cliente.nombre : "Asignar cliente"}</Btn>
            {cliente && <Btn variant="danger" size="sm" onClick={() => setCliente(null)} style={{ marginLeft: 4 }}>×</Btn>}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {cart.map(i => (
              <div key={i.producto_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{i.clave}</div>
                  <div style={{ fontSize: 11, color: colors.txtl }}>{i.nombre}</div>
                  <div style={{ fontSize: 11, color: colors.ok }}>${i.precio.toFixed(2)} c/u</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <button onClick={() => updQty(i.producto_id, -1)} style={{ width: 26, height: 26, border: `1px solid ${colors.brd}`, borderRadius: 5, background: "#fff", cursor: "pointer", fontWeight: 700 }}>-</button>
                  <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{i.cantidad}</span>
                  <button onClick={() => i.cantidad < i.stock && updQty(i.producto_id, 1)} style={{ width: 26, height: 26, border: `1px solid ${colors.brd}`, borderRadius: 5, background: "#fff", cursor: "pointer", fontWeight: 700 }}>+</button>
                  <button onClick={() => setCart(c => c.filter(x => x.producto_id !== i.producto_id))} style={{ background: "none", border: "none", cursor: "pointer", color: colors.err }}><Trash2 size={14} /></button>
                </div>
                <div style={{ minWidth: 65, textAlign: "right", fontWeight: 700, fontSize: 13 }}>${(i.precio * i.cantidad).toFixed(2)}</div>
              </div>
            ))}
            {cart.length === 0 && <div style={{ textAlign: "center", padding: 36, color: colors.txtl }}><ShoppingCart size={42} color="#d1d5db" style={{ display: "block", margin: "0 auto 12px" }} /><p>Carrito vacío</p></div>}
          </div>
          <div style={{ borderTop: `2px solid ${colors.txt}`, paddingTop: 10, marginTop: 6 }}>
            {cliente?.descuento > 0 && <div style={{ fontSize: 12, color: colors.p, marginBottom: 4 }}>Descuento membresía {cliente.membresia_nombre}: -{cliente.descuento}%</div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>TOTAL:</span><span>${(cliente?.descuento ? subtotal * (1 - cliente.descuento / 100) : subtotal).toFixed(2)}</span>
            </div>
            <div style={{ marginTop: 10, marginBottom: 6 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Tipo de pago</label>
              <Select value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </Select>
            </div>
            <Btn variant="success" size="lg" onClick={handlePay} style={{ width: "100%", justifyContent: "center" }}><CheckCircle size={18} /> Cobrar</Btn>
          </div>
        </div>
      </div>

      {/* PIN Modal */}
      {showPin && <Modal onClose={() => setShowPin(false)}>
        <h3 style={{ fontSize: 17, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Lock size={18} /> Autorización requerida</h3>
        <p style={{ fontSize: 13, marginBottom: 12 }}>El pago con tarjeta requiere PIN de administrador.</p>
        {pinErr && <div style={{ background: "#fee2e2", color: "#991b1b", padding: 8, borderRadius: 7, marginBottom: 10, fontSize: 12 }}>{pinErr}</div>}
        <Input type="password" placeholder="PIN de administrador (1234)" value={pin} onChange={e => setPin(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && verifyPin()} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}><Btn variant="success" onClick={verifyPin}>Autorizar</Btn><Btn variant="outline" onClick={() => setShowPin(false)}>Cancelar</Btn></div>
      </Modal>}

      {/* Client Modal */}
      {showCli && <Modal onClose={() => setShowCli(false)}>
        <h3 style={{ fontSize: 17, marginBottom: 14 }}>Seleccionar Cliente</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Nombre", "Teléfono", "Membresía", ""].map(h => <th key={h} style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` }}>{h}</th>)}</tr></thead>
          <tbody>{CLIENTES.map(c => <tr key={c.id}><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{c.nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{c.telefono || "-"}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{c.membresia_nombre ? <Pill color="blue">{c.membresia_nombre} ({c.descuento}%)</Pill> : "-"}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}><Btn variant="primary" size="sm" onClick={() => { setCliente(c); setShowCli(false); }}>Seleccionar</Btn></td></tr>)}</tbody>
        </table>
        <Btn variant="outline" onClick={() => setShowCli(false)} style={{ marginTop: 10 }}>Cerrar</Btn>
      </Modal>}

      {/* Ticket Modal */}
      {showTicket && <Modal onClose={() => setShowTicket(null)}>
        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 12, maxWidth: 300, margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}><b>TORNILLOS Y HULES</b><br />AUTOMOTRICES HERGON<br />{showTicket.sucursal_nombre}<br />{showTicket.sucursal_direccion}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div><b>Ticket:</b> {showTicket.ticket_numero}<br /><b>Fecha:</b> {new Date(showTicket.created_at).toLocaleString("es-MX")}<br /><b>Cajero:</b> {showTicket.cajero_nombre}
            {showTicket.cliente_nombre && <><br /><b>Cliente:</b> {showTicket.cliente_nombre}</>}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <table style={{ width: "100%", fontSize: 11 }}><thead><tr><td><b>Prod</b></td><td><b>Cant</b></td><td><b>P.U.</b></td><td style={{ textAlign: "right" }}><b>Subt</b></td></tr></thead>
            <tbody>{showTicket.detalles.map((d, i) => <tr key={i}><td style={{ padding: "1px 0", border: "none" }}>{d.clave}</td><td style={{ padding: "1px 0", border: "none" }}>{d.cantidad}</td><td style={{ padding: "1px 0", border: "none" }}>${d.precio_unitario.toFixed(2)}</td><td style={{ textAlign: "right", padding: "1px 0", border: "none" }}>${d.subtotal.toFixed(2)}</td></tr>)}</tbody>
          </table>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {showTicket.descuento_membresia > 0 && <div>Desc. membresía: -${showTicket.descuento_membresia.toFixed(2)}</div>}
          <div style={{ fontSize: 16, fontWeight: 800 }}>TOTAL: ${showTicket.total.toFixed(2)}</div>
          <div>Pago: {showTicket.tipo_pago.toUpperCase()}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ textAlign: "center" }}>Gracias por su compra!</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
          <Btn variant="outline" onClick={() => setShowTicket(null)}>Cerrar</Btn>
        </div>
      </Modal>}
    </div>
  );
}

// ============ INVENTARIO ============
function Inventario({ user }) {
  const [suc, setSuc] = useState("");
  const [bajo, setBajo] = useState(false);
  const [showEntrada, setShowEntrada] = useState(false);
  const [entProd, setEntProd] = useState("");
  const [entSuc, setEntSuc] = useState(String(user.sucursal_id));
  const [entCant, setEntCant] = useState("");
  const [showTraspaso, setShowTraspaso] = useState(false);
  const [trProd, setTrProd] = useState("");
  const [trOrig, setTrOrig] = useState("");
  const [trDest, setTrDest] = useState("");
  const [trCant, setTrCant] = useState("");
  const [, forceUpdate] = useState(0);
  const isAdmin = user.rol === "administrador";

  const inv = [];
  PRODUCTOS_RAW.forEach(p => {
    const sucursales = suc ? [SUCURSALES.find(s => s.id === parseInt(suc))].filter(Boolean) : SUCURSALES;
    sucursales.forEach(s => {
      const stock = INVENTARIO[p.id]?.[s.id] || 0;
      if (bajo && stock > p.min) return;
      inv.push({ clave: p.clave, producto_nombre: p.nombre, categoria_nombre: CATEGORIAS.find(c => c.id === p.cat)?.nombre || "", sucursal_nombre: s.nombre, stock, stock_minimo: p.min });
    });
  });

  const doEntrada = () => {
    const pid = parseInt(entProd); const sid = parseInt(entSuc); const cant = parseInt(entCant);
    if (!pid || !sid || !cant || cant <= 0) return alert("Completa todos los campos");
    INVENTARIO[pid][sid] = (INVENTARIO[pid][sid] || 0) + cant;
    const prod = PRODUCTOS_RAW.find(p => p.id === pid);
    addNotif("entrada", `Entrada: ${cant} uds de ${prod.clave} en ${SUCURSALES.find(s => s.id === sid).nombre}`);
    setShowEntrada(false); setEntProd(""); setEntCant(""); forceUpdate(n => n + 1);
    alert("Entrada registrada");
  };

  const doTraspaso = () => {
    const pid = parseInt(trProd); const orig = parseInt(trOrig); const dest = parseInt(trDest); const cant = parseInt(trCant);
    if (!pid || !orig || !dest || !cant || orig === dest) return alert("Completa todos los campos correctamente");
    if ((INVENTARIO[pid]?.[orig] || 0) < cant) return alert("Stock insuficiente en origen");
    INVENTARIO[pid][orig] -= cant;
    INVENTARIO[pid][dest] = (INVENTARIO[pid][dest] || 0) + cant;
    const prod = PRODUCTOS_RAW.find(p => p.id === pid);
    addNotif("traspaso", `Traspaso: ${cant} uds de ${prod.clave} de ${SUCURSALES.find(s => s.id === orig).nombre} a ${SUCURSALES.find(s => s.id === dest).nombre}`);
    setShowTraspaso(false); forceUpdate(n => n + 1);
    alert("Traspaso realizado");
  };

  const thStyle = { background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` };
  const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Package size={16} /> Inventario</span>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn variant="success" onClick={() => setShowEntrada(true)}><Plus size={14} /> Entrada</Btn>
            {isAdmin && <Btn variant="primary" onClick={() => setShowTraspaso(true)}><ArrowLeftRight size={14} /> Traspaso</Btn>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Select value={suc} onChange={e => setSuc(e.target.value)} style={{ width: 200 }}>
            <option value="">Todas las sucursales</option>
            {SUCURSALES.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={bajo} onChange={e => setBajo(e.target.checked)} /> Solo stock bajo
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Clave", "Producto", "Categoría", "Sucursal", "Stock", "Mín", "Estado"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{inv.slice(0, 60).map((r, i) => (
              <tr key={i}><td style={{ ...tdStyle, fontWeight: 700 }}>{r.clave}</td><td style={tdStyle}>{r.producto_nombre}</td><td style={tdStyle}>{r.categoria_nombre}</td><td style={tdStyle}>{r.sucursal_nombre}</td><td style={{ ...tdStyle, fontWeight: 700 }}>{r.stock}</td><td style={tdStyle}>{r.stock_minimo}</td>
                <td style={tdStyle}>{r.stock === 0 ? <Pill color="red">Sin stock</Pill> : r.stock <= r.stock_minimo ? <Pill color="yellow">Bajo</Pill> : <Pill color="green">OK</Pill>}</td></tr>
            ))}</tbody>
          </table>
          {inv.length > 60 && <p style={{ fontSize: 12, color: colors.txtl, marginTop: 8 }}>Mostrando 60 de {inv.length} registros. Usa los filtros para refinar.</p>}
        </div>
      </div>

      {showEntrada && <Modal onClose={() => setShowEntrada(false)}>
        <h3 style={{ fontSize: 17, marginBottom: 14 }}>Registrar Entrada de Mercancía</h3>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Producto</label>
          <Select value={entProd} onChange={e => setEntProd(e.target.value)}><option value="">Seleccionar...</option>{PRODUCTOS_RAW.map(p => <option key={p.id} value={p.id}>{p.clave} - {p.nombre}</option>)}</Select></div>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Sucursal</label>
          <Select value={entSuc} onChange={e => setEntSuc(e.target.value)}>{SUCURSALES.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select></div>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Cantidad</label>
          <Input type="number" value={entCant} onChange={e => setEntCant(e.target.value)} min="1" /></div>
        <div style={{ display: "flex", gap: 8 }}><Btn variant="success" onClick={doEntrada}>Registrar</Btn><Btn variant="outline" onClick={() => setShowEntrada(false)}>Cancelar</Btn></div>
      </Modal>}

      {showTraspaso && <Modal onClose={() => setShowTraspaso(false)}>
        <h3 style={{ fontSize: 17, marginBottom: 14 }}>Traspaso entre Sucursales</h3>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Producto</label>
          <Select value={trProd} onChange={e => setTrProd(e.target.value)}><option value="">Seleccionar...</option>{PRODUCTOS_RAW.map(p => <option key={p.id} value={p.id}>{p.clave} - {p.nombre}</option>)}</Select></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Sucursal Origen</label>
            <Select value={trOrig} onChange={e => setTrOrig(e.target.value)}><option value="">Seleccionar...</option>{SUCURSALES.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select></div>
          <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Sucursal Destino</label>
            <Select value={trDest} onChange={e => setTrDest(e.target.value)}><option value="">Seleccionar...</option>{SUCURSALES.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select></div>
        </div>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Cantidad</label>
          <Input type="number" value={trCant} onChange={e => setTrCant(e.target.value)} min="1" /></div>
        <div style={{ display: "flex", gap: 8 }}><Btn variant="primary" onClick={doTraspaso}>Traspasar</Btn><Btn variant="outline" onClick={() => setShowTraspaso(false)}>Cancelar</Btn></div>
      </Modal>}
    </div>
  );
}

// ============ CORTES DE CAJA ============
function CorteCaja({ user }) {
  const [tab, setTab] = useState("hacer");
  const [monto, setMonto] = useState("");
  const [, forceUpdate] = useState(0);

  const misVentas = VENTAS.filter(v => v.cajero_id === user.id);
  const totalVentas = misVentas.reduce((s, v) => s + v.total, 0);
  const totalEfectivo = misVentas.filter(v => v.tipo_pago === "efectivo").reduce((s, v) => s + v.total, 0);
  const totalTransferencia = misVentas.filter(v => v.tipo_pago === "transferencia").reduce((s, v) => s + v.total, 0);
  const totalTarjeta = misVentas.filter(v => v.tipo_pago === "tarjeta").reduce((s, v) => s + v.total, 0);

  const hacerCorte = () => {
    if (!monto) return alert("Ingresa el monto en caja");
    const montoReal = parseFloat(monto);
    const diferencia = montoReal - totalEfectivo;
    const corte = { id: corteIdCounter++, cajero_nombre: user.nombre, cajero_id: user.id, sucursal_nombre: user.sucursal_nombre, num_ventas: misVentas.length, total_ventas: totalVentas, total_efectivo: totalEfectivo, total_transferencia: totalTransferencia, total_tarjeta: totalTarjeta, monto_esperado: totalEfectivo, monto_real: montoReal, diferencia, created_at: new Date().toISOString() };
    CORTES.push(corte);
    addNotif("corte_caja", `Corte de caja de ${user.nombre} en ${user.sucursal_nombre}: $${totalVentas.toFixed(2)}`);
    if (Math.abs(diferencia) > 10) addNotif("alerta_corte", `Diferencia significativa en corte de ${user.nombre}: $${diferencia.toFixed(2)}`);
    alert(`Corte registrado. Diferencia: $${diferencia.toFixed(2)}`);
    setMonto(""); setTab("historial"); forceUpdate(n => n + 1);
  };

  const thStyle = { background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` };
  const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: `2px solid ${colors.brd}` }}>
        {["hacer", "historial"].map(t => <div key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tab === t ? colors.p : colors.txtl, borderBottom: `2px solid ${tab === t ? colors.p : "transparent"}`, marginBottom: -2 }}>{t === "hacer" ? "Realizar Corte" : "Historial"}</div>)}
      </div>
      {tab === "hacer" && <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}>
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Resumen del Turno Actual</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
          <StatCard icon={<ShoppingCart size={24} color="#93c5fd" />} value={misVentas.length} label="Ventas" />
          <StatCard icon={<DollarSign size={24} color="#93c5fd" />} value={`$${totalVentas.toFixed(2)}`} label="Total vendido" />
          <StatCard icon={<Banknote size={24} color="#34d399" />} value={`$${totalEfectivo.toFixed(2)}`} label="Efectivo" color={colors.ok} />
          <StatCard icon={<Smartphone size={24} color="#93c5fd" />} value={`$${totalTransferencia.toFixed(2)}`} label="Transferencia" />
          <StatCard icon={<CreditCard size={24} color="#a78bfa" />} value={`$${totalTarjeta.toFixed(2)}`} label="Tarjeta" color="#8b5cf6" />
        </div>
        <div style={{ background: "#f0fdf4", padding: 14, borderRadius: 8, marginBottom: 14 }}>
          <b>Monto esperado en caja (efectivo): ${totalEfectivo.toFixed(2)}</b>
        </div>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Monto real en caja</label>
          <Input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" step="0.01" /></div>
        {monto && <div style={{ padding: 8, borderRadius: 6, background: Math.abs(parseFloat(monto) - totalEfectivo) > 1 ? "#fef2f2" : "#f0fdf4", marginBottom: 10 }}>
          Diferencia: <b>${(parseFloat(monto || 0) - totalEfectivo).toFixed(2)}</b>
        </div>}
        <Btn variant="success" size="lg" onClick={hacerCorte}><CheckCircle size={18} /> Confirmar Corte</Btn>
      </div>}
      {tab === "historial" && <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Fecha", "Cajero", "Sucursal", "Ventas", "Total", "Esperado", "Real", "Diferencia"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{CORTES.map(c => <tr key={c.id}><td style={tdStyle}>{new Date(c.created_at).toLocaleString("es-MX")}</td><td style={tdStyle}>{c.cajero_nombre}</td><td style={tdStyle}>{c.sucursal_nombre}</td><td style={tdStyle}>{c.num_ventas}</td><td style={tdStyle}>${c.total_ventas.toFixed(2)}</td><td style={tdStyle}>${c.monto_esperado.toFixed(2)}</td><td style={tdStyle}>${c.monto_real.toFixed(2)}</td><td style={{ ...tdStyle, color: Math.abs(c.diferencia) > 1 ? colors.err : colors.ok, fontWeight: 700 }}>${c.diferencia.toFixed(2)}</td></tr>)}</tbody>
        </table>
        {CORTES.length === 0 && <div style={{ textAlign: "center", padding: 36, color: colors.txtl }}>Sin cortes registrados</div>}
      </div>}
    </div>
  );
}

// ============ CLIENTES ============
function ClientesView({ user }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", membresia_id: "" });
  const [, forceUpdate] = useState(0);

  const filtered = CLIENTES.filter(c => !q || c.nombre.toLowerCase().includes(q.toLowerCase()));

  const save = () => {
    if (!f.nombre) return alert("El nombre es obligatorio");
    const memb = MEMBRESIAS.find(m => m.id === parseInt(f.membresia_id));
    if (edit) {
      const idx = CLIENTES.findIndex(c => c.id === edit.id);
      CLIENTES[idx] = { ...CLIENTES[idx], ...f, membresia_nombre: memb?.nombre || null, descuento: memb?.descuento || 0 };
    } else {
      CLIENTES.push({ id: CLIENTES.length + 1, ...f, membresia_id: f.membresia_id ? parseInt(f.membresia_id) : null, membresia_nombre: memb?.nombre || null, descuento: memb?.descuento || 0 });
    }
    setShow(false); setEdit(null); forceUpdate(n => n + 1);
  };

  const thStyle = { background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` };
  const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Users size={16} /> Clientes</span>
          <Btn variant="primary" onClick={() => { setEdit(null); setF({ nombre: "", telefono: "", email: "", membresia_id: "" }); setShow(true); }}><Plus size={14} /> Nuevo</Btn>
        </div>
        <div style={{ marginBottom: 14 }}><Input placeholder="Buscar cliente..." value={q} onChange={e => setQ(e.target.value)} /></div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Nombre", "Teléfono", "Membresía", "Descuento", "Acciones"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(c => <tr key={c.id}><td style={{ ...tdStyle, fontWeight: 700 }}>{c.nombre}</td><td style={tdStyle}>{c.telefono || "-"}</td><td style={tdStyle}>{c.membresia_nombre ? <Pill color="blue">{c.membresia_nombre}</Pill> : "-"}</td><td style={tdStyle}>{c.descuento ? c.descuento + "%" : "-"}</td><td style={tdStyle}><Btn variant="outline" size="sm" onClick={() => { setEdit(c); setF({ nombre: c.nombre, telefono: c.telefono || "", email: c.email || "", membresia_id: c.membresia_id || "" }); setShow(true); }}>Editar</Btn></td></tr>)}</tbody>
        </table>
      </div>

      {show && <Modal onClose={() => setShow(false)}>
        <h3 style={{ fontSize: 17, marginBottom: 14 }}>{edit ? "Editar" : "Nuevo"} Cliente</h3>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Nombre</label><Input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Teléfono</label><Input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} /></div>
          <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Email</label><Input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.txtl, marginBottom: 3 }}>Membresía</label>
          <Select value={f.membresia_id} onChange={e => setF({ ...f, membresia_id: e.target.value })}><option value="">Sin membresía</option>{MEMBRESIAS.map(m => <option key={m.id} value={m.id}>{m.nombre} ({m.descuento}%)</option>)}</Select></div>
        <div style={{ display: "flex", gap: 8 }}><Btn variant="success" onClick={save}>Guardar</Btn><Btn variant="outline" onClick={() => setShow(false)}>Cancelar</Btn></div>
      </Modal>}
    </div>
  );
}

// ============ NOTIFICACIONES ============
function NotifPanel({ open, onClose }) {
  const typeColors = { venta: colors.ok, stock_bajo: colors.warn, stock_cero: colors.err, traspaso: colors.p, corte_caja: "#8b5cf6", alerta_corte: colors.err, entrada: colors.ok };
  return (
    <div style={{ position: "fixed", right: 0, top: 0, width: 360, height: "100vh", background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,.1)", zIndex: 150, overflowY: "auto", padding: 18, transform: open ? "translateX(0)" : "translateX(100%)", transition: ".3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Bell size={18} /> Notificaciones</h3>
        <Btn variant="outline" size="sm" onClick={onClose}><X size={14} /></Btn>
      </div>
      {NOTIFICACIONES.map(n => (
        <div key={n.id} onClick={() => { n.leida = true; }} style={{ padding: 10, borderRadius: 7, marginBottom: 6, borderLeft: `4px solid ${typeColors[n.tipo] || colors.brd}`, background: !n.leida ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{n.mensaje}</div>
          <div style={{ color: colors.txtl, fontSize: 11 }}>{new Date(n.created_at).toLocaleString("es-MX")}</div>
        </div>
      ))}
      {NOTIFICACIONES.length === 0 && <div style={{ textAlign: "center", padding: 36, color: colors.txtl }}>Sin notificaciones</div>}
    </div>
  );
}

// ============ APP PRINCIPAL ============
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [notifOpen, setNotifOpen] = useState(false);

  const logout = () => setUser(null);
  if (!user) return <Login onLogin={setUser} />;

  const titles = { dashboard: "Dashboard", pos: "Punto de Venta", inventario: "Inventario", cortes: "Cortes de Caja", clientes: "Clientes", promociones: "Promociones", usuarios: "Usuarios", reportes: "Reportes" };
  const unread = NOTIFICACIONES.filter(n => !n.leida).length;

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: colors.bg, color: colors.txt, minHeight: "100vh" }}>
      <Sidebar page={page} setPage={setPage} user={user} onLogout={logout} />
      <div style={{ marginLeft: 230, minHeight: "100vh" }}>
        <div style={{ background: "#fff", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${colors.brd}`, position: "sticky", top: 0, zIndex: 50 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{titles[page] || "HERGON POS"}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: colors.txtl }}>{user.sucursal_nombre}</span>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: colors.txtl, padding: 4 }}>
              <Bell size={20} />
              {unread > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: colors.err, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
            </button>
          </div>
        </div>
        {page === "dashboard" && <Dashboard user={user} />}
        {page === "pos" && <POS user={user} />}
        {page === "inventario" && <Inventario user={user} />}
        {page === "cortes" && <CorteCaja user={user} />}
        {page === "clientes" && <ClientesView user={user} />}
        {page === "promociones" && <div style={{ padding: 20 }}><div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}><h3 style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Tags size={16} /> Promociones</h3><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Nombre", "Tipo", "Valor", "Aplica a", "Estado"].map(h => <th key={h} style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` }}>{h}</th>)}</tr></thead><tbody>{PROMOS.map(p => <tr key={p.id}><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13, fontWeight: 700 }}>{p.nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{p.tipo === "porcentaje" ? "%" : "$"}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{p.valor}{p.tipo === "porcentaje" ? "%" : ""}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{p.aplica_a === "todo" ? "Toda la tienda" : p.aplica_a === "categoria" ? p.categoria_nombre : p.producto_nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{p.activo ? <Pill color="green">Activa</Pill> : <Pill color="red">Inactiva</Pill>}</td></tr>)}</tbody></table></div></div>}
        {page === "usuarios" && <div style={{ padding: 20 }}><div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}><h3 style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><UserCog size={16} /> Usuarios</h3><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Nombre", "Usuario", "Rol", "Sucursal", "Estado"].map(h => <th key={h} style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` }}>{h}</th>)}</tr></thead><tbody>{USERS_DB.map(u => <tr key={u.id}><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13, fontWeight: 700 }}>{u.nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{u.usuario}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}><Pill color={u.rol === "administrador" ? "blue" : "gray"}>{u.rol}</Pill></td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{u.sucursal_nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{u.activo ? <Pill color="green">Activo</Pill> : <Pill color="red">Inactivo</Pill>}</td></tr>)}</tbody></table></div></div>}
        {page === "reportes" && <div style={{ padding: 20 }}><div style={{ background: "#fff", borderRadius: 10, padding: 18, border: `1px solid ${colors.brd}` }}><h3 style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={16} /> Reportes de Ventas</h3>{VENTAS.length > 0 ? <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Ticket", "Fecha", "Sucursal", "Cajero", "Total", "Pago"].map(h => <th key={h} style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.txtl, textTransform: "uppercase", borderBottom: `2px solid ${colors.brd}` }}>{h}</th>)}</tr></thead><tbody>{VENTAS.map(v => <tr key={v.id}><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13, fontWeight: 700 }}>{v.ticket_numero}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{new Date(v.created_at).toLocaleString("es-MX")}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{v.sucursal_nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}>{v.cajero_nombre}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13, fontWeight: 700 }}>${v.total.toFixed(2)}</td><td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.brd}`, fontSize: 13 }}><Pill color="gray">{v.tipo_pago}</Pill></td></tr>)}</tbody></table> : <div style={{ textAlign: "center", padding: 36, color: colors.txtl }}>Realiza ventas en el POS para ver reportes aqui</div>}</div></div>}
      </div>
      <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}