const STORAGE_KEY = "paynest_v1_data";

const DEFAULT_DATA = {
  version: 1,
  contracts: [],
  customers: [],
  settings: { currency: "฿" }
};

// PayNest has had several storage formats during v1 development.
// Never delete these automatically; only read and migrate them.
const KNOWN_LEGACY_KEYS = [
  "paynest_contracts_v1",
  "paynest_contracts",
  "paynest_v1_contracts",
  "paynest_customers_v1",
  "paynest_customers",
  "paynest_v1_customers",
  "paynest_data_v1",
  "paynest_data",
  "paynest_v1",
  "paynest"
];

const clone = value => JSON.parse(JSON.stringify(value));

function text(value) {
  return value == null ? "" : String(value).trim();
}

function first(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function numberFrom(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeCustomer(raw, fallbackId) {
  if (!raw || typeof raw !== "object") return null;

  return {
    id: text(first(raw.id, raw.customerId, fallbackId)),
    name: text(first(raw.name, raw.customerName, raw.fullName, raw.customer, "ไม่ระบุลูกค้า")),
    phone: text(first(raw.phone, raw.tel, raw.mobile, raw.phoneNumber))
  };
}

function normalizeContract(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  const total = Math.max(0, numberFrom(
    raw.total,
    raw.totalAmount,
    raw.contractTotal,
    raw.amount,
    raw.price,
    raw.principal,
    raw.value
  ));

  const paid = Math.max(0, Math.min(total, numberFrom(
    raw.paid,
    raw.paidAmount,
    raw.amountPaid,
    raw.received,
    raw.receivedAmount,
    raw.collected,
    raw.paymentReceived
  )));

  return {
    id: text(first(
      raw.id,
      raw.contractId,
      raw.uuid,
      `con_migrated_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`
    )),
    customerId: text(first(raw.customerId, raw.customer_id)),
    customerName: text(first(
      raw.customerName,
      raw.customer_name,
      raw.customer,
      raw.nameOfCustomer
    )),
    title: text(first(
      raw.title,
      raw.contractName,
      raw.productName,
      raw.product,
      raw.item,
      raw.name,
      "สัญญาไม่มีชื่อ"
    )),
    total,
    paid,
    nextDue: text(first(
      raw.nextDue,
      raw.dueDate,
      raw.nextPaymentDate,
      raw.paymentDate,
      raw.installmentDate,
      ""
    )),
    createdAt: text(first(raw.createdAt, raw.created, raw.date, new Date().toISOString()))
  };
}

function normalize(data) {
  if (!data || typeof data !== "object") return clone(DEFAULT_DATA);

  const rawContracts = Array.isArray(data.contracts) ? data.contracts : [];
  const rawCustomers = Array.isArray(data.customers) ? data.customers : [];

  const customers = rawCustomers
    .map((c, i) => normalizeCustomer(c, `cus_${i}`))
    .filter(Boolean);

  const contracts = rawContracts
    .map((c, i) => normalizeContract(c, i))
    .filter(Boolean);

  // Rebuild missing customer records from contracts.
  const byId = new Map(customers.map(c => [String(c.id), c]));
  const byName = new Map(customers.map(c => [c.name, c]));

  for (const contract of contracts) {
    if (contract.customerId && byId.has(String(contract.customerId))) {
      const customer = byId.get(String(contract.customerId));
      if (!contract.customerName) contract.customerName = customer.name;
      continue;
    }

    if (contract.customerName && byName.has(contract.customerName)) {
      contract.customerId = byName.get(contract.customerName).id;
      continue;
    }

    if (contract.customerName) {
      const customer = {
        id: `cus_migrated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: contract.customerName,
        phone: ""
      };
      customers.push(customer);
      byId.set(customer.id, customer);
      byName.set(customer.name, customer);
      contract.customerId = customer.id;
    }
  }

  return {
    version: 1,
    contracts,
    customers,
    settings: {
      ...DEFAULT_DATA.settings,
      ...(data.settings || {})
    }
  };
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function scoreCandidate(data) {
  if (!data || typeof data !== "object") return -1;

  const contracts = Array.isArray(data.contracts) ? data.contracts : [];
  const customers = Array.isArray(data.customers) ? data.customers : [];

  if (!contracts.length && !customers.length) return -1;

  let score = contracts.length * 10 + customers.length * 3;

  // Prefer records that look like PayNest contracts.
  for (const c of contracts.slice(0, 20)) {
    if (!c || typeof c !== "object") continue;
    if (c.total !== undefined || c.totalAmount !== undefined || c.amount !== undefined) score += 8;
    if (c.paid !== undefined || c.paidAmount !== undefined || c.amountPaid !== undefined) score += 6;
    if (c.customerName !== undefined || c.customerId !== undefined) score += 4;
  }

  return score;
}

function extractCandidate(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  // Direct PayNest shape.
  if (Array.isArray(parsed.contracts) || Array.isArray(parsed.customers)) {
    return parsed;
  }

  // Some older versions wrapped data inside `data`.
  if (parsed.data && typeof parsed.data === "object") {
    if (Array.isArray(parsed.data.contracts) || Array.isArray(parsed.data.customers)) {
      return parsed.data;
    }
  }

  return null;
}

function scanLocalStorage() {
  const candidates = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    try {
      const parsed = parseJSON(localStorage.getItem(key));
      const candidate = extractCandidate(parsed);
      if (!candidate) continue;

      const normalized = normalize(candidate);
      const score = scoreCandidate(normalized);

      if (score >= 0) {
        candidates.push({ key, normalized, score });
      }
    } catch (error) {
      console.warn("PayNest storage scan failed:", key, error);
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function findBestStoredData() {
  const candidates = scanLocalStorage();

  if (!candidates.length) return null;

  // Current key wins only when it actually contains useful records.
  const current = candidates.find(c => c.key === STORAGE_KEY);
  if (current && current.score > 0) return current.normalized;

  return candidates[0].normalized;
}

function loadCurrent() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed = parseJSON(raw);
  if (!parsed) return null;

  return normalize(parsed);
}

export function loadData() {
  try {
    const current = loadCurrent();

    // If current data is useful, use it.
    if (current && (current.contracts.length || current.customers.length)) {
      // Save canonicalized fields so the rest of the app always sees one shape.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return current;
    }

    // Current key is empty or absent: search every localStorage key.
    const recovered = findBestStoredData();

    if (recovered && (recovered.contracts.length || recovered.customers.length)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recovered));
      return recovered;
    }

    return clone(DEFAULT_DATA);
  } catch (error) {
    console.error("PayNest storage load error:", error);

    try {
      const recovered = findBestStoredData();
      if (recovered) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recovered));
        return recovered;
      }
    } catch (recoveryError) {
      console.error("PayNest recovery error:", recoveryError);
    }

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

export function importData(textValue) {
  const parsed = JSON.parse(textValue);
  const safe = normalize(parsed);

  if (!safe.contracts.length && !safe.customers.length) {
    throw new Error("ข้อมูลที่นำเข้าไม่มีสัญญาหรือลูกค้า");
  }

  saveData(safe);
  return safe;
}

export { STORAGE_KEY };
