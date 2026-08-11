export const STORAGE_KEY = "paynest_v1_data";

const DEFAULT_DATA = {
  version: 1,
  contracts: [],
  customers: [],
  settings: { currency: "฿" }
};

const clone = value => JSON.parse(JSON.stringify(value));

function makeId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeCustomer(c) {
  if (!c || typeof c !== "object") return null;
  return {
    id: String(c.id || makeId()),
    name: String(c.name || "").trim(),
    phone: String(c.phone || "").trim(),
    note: String(c.note || "").trim(),
    createdAt: c.createdAt || new Date().toISOString()
  };
}

function normalizeContract(c) {
  if (!c || typeof c !== "object") return null;

  const total = Math.max(0, Number(c.total || 0));
  const received = Math.min(total, Math.max(0, Number(c.received || 0)));
  const installments = Math.max(1, Math.floor(Number(c.installments || 1)));

  return {
    id: String(c.id || makeId()),
    product: String(c.product || "ไม่ระบุ").trim() || "ไม่ระบุ",
    customerId: c.customerId ? String(c.customerId) : "",
    customerName: String(c.customerName || "").trim(),
    phone: String(c.phone || "").trim(),
    total,
    received,
    paymentType: ["daily", "weekly", "monthly"].includes(c.paymentType) ? c.paymentType : "monthly",
    installments,
    startDate: c.startDate || localToday(),
    dueDate: c.dueDate || c.startDate || localToday(),
    status: received >= total && total > 0 ? "paid" : "active",
    payments: Array.isArray(c.payments)
      ? c.payments.map(p => ({
          id: String(p?.id || makeId()),
          amount: Math.max(0, Number(p?.amount || 0)),
          date: p?.date || localToday()
        })).filter(p => p.amount > 0)
      : [],
    createdAt: c.createdAt || new Date().toISOString()
  };
}

export function normalize(input) {
  if (!input || typeof input !== "object") return clone(DEFAULT_DATA);

  const customers = (Array.isArray(input.customers) ? input.customers : [])
    .map(normalizeCustomer)
    .filter(Boolean);

  const contracts = (Array.isArray(input.contracts) ? input.contracts : [])
    .map(normalizeContract)
    .filter(Boolean);

  return {
    version: 1,
    contracts,
    customers,
    settings: {
      ...DEFAULT_DATA.settings,
      ...(input.settings || {})
    }
  };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : clone(DEFAULT_DATA);
  } catch (error) {
    console.error("PayNest load error:", error);
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
  const parsed = JSON.parse(text);
  const safe = normalize(parsed);
  saveData(safe);
  return safe;
}

