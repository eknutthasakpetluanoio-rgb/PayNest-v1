const STORAGE_KEY = "paynest_v1_data";

// Legacy keys used by older PayNest builds.
// We read them only for migration so old data is not lost.
const LEGACY_CONTRACT_KEYS = [
  "paynest_contracts_v1",
  "paynest_contracts",
  "paynest_v1_contracts"
];

const LEGACY_CUSTOMER_KEYS = [
  "paynest_customers_v1",
  "paynest_customers",
  "paynest_v1_customers"
];

const DEFAULT_DATA = {
  version: 1,
  contracts: [],
  customers: [],
  settings: {
    currency: "฿"
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function arrayFromStorage(keys) {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      console.warn("PayNest legacy storage read failed:", key, error);
    }
  }
  return [];
}

function normalize(data) {
  if (!data || typeof data !== "object") return clone(DEFAULT_DATA);

  return {
    version: 1,
    contracts: Array.isArray(data.contracts) ? data.contracts : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
    settings: {
      ...DEFAULT_DATA.settings,
      ...(data.settings || {})
    }
  };
}

function migrateLegacyData() {
  const contracts = arrayFromStorage(LEGACY_CONTRACT_KEYS);
  const customers = arrayFromStorage(LEGACY_CUSTOMER_KEYS);

  if (!contracts.length && !customers.length) return null;

  // Older versions sometimes stored customerName directly on contracts.
  // Rebuild missing customer records so the customer page works again.
  const customerMap = new Map(
    customers
      .filter(c => c && c.id)
      .map(c => [String(c.id), c])
  );

  for (const contract of contracts) {
    if (!contract || typeof contract !== "object") continue;

    if (contract.customerId && !customerMap.has(String(contract.customerId))) {
      customerMap.set(String(contract.customerId), {
        id: String(contract.customerId),
        name: String(contract.customerName || "ไม่ระบุลูกค้า"),
        phone: String(contract.phone || "")
      });
    }

    if (!contract.customerId && contract.customerName) {
      const name = String(contract.customerName).trim();
      let customer = [...customerMap.values()].find(
        c => String(c.name || "").trim() === name
      );

      if (!customer) {
        customer = {
          id: `cus_migrated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          phone: String(contract.phone || "")
        };
        customerMap.set(customer.id, customer);
      }

      contract.customerId = customer.id;
    }
  }

  return normalize({
    version: 1,
    contracts,
    customers: [...customerMap.values()],
    settings: DEFAULT_DATA.settings
  });
}

export function loadData() {
  try {
    // 1. Load the current database first.
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const current = normalize(JSON.parse(raw));

      // If the current database is empty but an older database still exists,
      // prefer the older data instead of silently showing ฿0.
      if (!current.contracts.length && !current.customers.length) {
        const migrated = migrateLegacyData();
        if (migrated) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }

      return current;
    }

    // 2. No current database: migrate old data automatically.
    const migrated = migrateLegacyData();
    if (migrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return clone(DEFAULT_DATA);
  } catch (error) {
    console.error("PayNest storage load error:", error);

    // Even if the current JSON is damaged, try the legacy stores.
    try {
      const migrated = migrateLegacyData();
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (migrationError) {
      console.error("PayNest migration error:", migrationError);
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
  for (const key of [...LEGACY_CONTRACT_KEYS, ...LEGACY_CUSTOMER_KEYS]) {
    localStorage.removeItem(key);
  }
  return clone(DEFAULT_DATA);
}

export function exportData(data = loadData()) {
  return JSON.stringify(normalize(data), null, 2);
}

export function importData(text) {
  const parsed = JSON.parse(text);
  const safe = normalize(parsed);

  if (!safe.contracts.length && !safe.customers.length) {
    throw new Error("ข้อมูลที่นำเข้าไม่มีสัญญาหรือลูกค้า");
  }

  saveData(safe);
  return safe;
}

export { STORAGE_KEY };
