export const STORAGE_KEY = "paynest_v1_data";

const DEFAULT_DATA = {
  version: 1,
  contracts: [],
  customers: [],
  settings: { currency: "฿" }
};

const clone = v => JSON.parse(JSON.stringify(v));

function normalizeCustomer(c) {
  if (!c || typeof c !== "object") return null;
  return {
    id: String(c.id || crypto.randomUUID()),
    name: String(c.name || "").trim(),
    phone: String(c.phone || "").trim(),
    note: String(c.note || "").trim(),
    createdAt: c.createdAt || new Date().toISOString()
  };
}

function normalizeContract(c) {
  if (!c || typeof c !== "object") return null;
  const total = Number(c.total || 0);
  const received = Math.max(0, Number(c.received || 0));
  return {
    id: String(c.id || crypto.randomUUID()),
    product: String(c.product || "ไม่ระบุ"),
    customerId: c.customerId ? String(c.customerId) : "",
    customerName: String(c.customerName || "").trim(),
    phone: String(c.phone || "").trim(),
    total,
    received: Math.min(received, total),
    paymentType: c.paymentType || "monthly",
    installments: Math.max(1, Number(c.installments || 1)),
    startDate: c.startDate || new Date().toISOString().slice(0,10),
    dueDate: c.dueDate || c.startDate || new Date().toISOString().slice(0,10),
    status: c.status || (received >= total ? "paid" : "active"),
    payments: Array.isArray(c.payments) ? c.payments : [],
    createdAt: c.createdAt || new Date().toISOString()
  };
}

export function normalize(data) {
  if (!data || typeof data !== "object") return clone(DEFAULT_DATA);
  return {
    version: 1,
    contracts: (Array.isArray(data.contracts) ? data.contracts : []).map(normalizeContract).filter(Boolean),
    customers: (Array.isArray(data.customers) ? data.customers : []).map(normalizeCustomer).filter(Boolean),
    settings: {...DEFAULT_DATA.settings, ...(data.settings || {})}
  };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : clone(DEFAULT_DATA);
  } catch (e) {
    console.error(e);
    return clone(DEFAULT_DATA);
  }
}

export function saveData(data) {
  const safe = normalize(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  return clone(DEFAULT_DATA);
}

export function exportData(data = loadData()) {
  return JSON.stringify(normalize(data), null, 2);
}

export function importData(text) {
  const safe = normalize(JSON.parse(text));
  saveData(safe);
  return safe;
}
