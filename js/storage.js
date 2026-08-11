const STORAGE_KEY = "paynest_v1_data";

const DEFAULT_DATA = {
  version: 1,
  contracts: [],
  customers: [],
  settings: { currency: "฿" }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function looksLikeContract(x) {
  return x && typeof x === "object" &&
    ("id" in x || "title" in x) &&
    ("total" in x || "paid" in x);
}

function looksLikeCustomer(x) {
  return x && typeof x === "object" &&
    ("id" in x || "name" in x) &&
    ("name" in x);
}

function collectLocalStorageData() {
  const found = {
    contracts: [],
    customers: []
  };

  const addUnique = (target, items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const id = item.id;
      const duplicate = id
        ? target.some(x => x.id === id)
        : target.some(x => JSON.stringify(x) === JSON.stringify(item));
      if (!duplicate) target.push(item);
    }
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === STORAGE_KEY) continue;

    const raw = localStorage.getItem(key);
    if (!raw) continue;

    const value = parseJSON(raw);
    if (!value) continue;

    // Known legacy formats.
    if (key === "paynest_contracts_v1") {
      addUnique(found.contracts, Array.isArray(value) ? value : value.contracts);
    }
    if (key === "paynest_customers_v1") {
      addUnique(found.customers, Array.isArray(value) ? value : value.customers);
    }

    // Any old PayNest state object.
    if (value && typeof value === "object" && !Array.isArray(value)) {
      addUnique(found.contracts, value.contracts);
      addUnique(found.customers, value.customers);
    }

    // Any standalone array containing recognizable records.
    if (Array.isArray(value)) {
      addUnique(found.contracts, value.filter(looksLikeContract));
      addUnique(found.customers, value.filter(looksLikeCustomer));
    }
  }

  return found;
}

function loadCurrent() {
  try {
    return normalize(parseJSON(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return clone(DEFAULT_DATA);
  }
}

function recoverIfNeeded() {
  const current = loadCurrent();

  // If current data already has records, never replace it.
  if (current.contracts.length || current.customers.length) {
    return current;
  }

  const recovered = collectLocalStorageData();

  if (!recovered.contracts.length && !recovered.customers.length) {
    return current;
  }

  const merged = normalize({
    version: 1,
    contracts: recovered.contracts,
    customers: recovered.customers,
    settings: current.settings
  });

  // Write recovered data to the active key.
  // Never delete or modify the source keys.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

  console.info("PayNest recovery:", {
    contracts: merged.contracts.length,
    customers: merged.customers.length
  });

  return merged;
}

export function loadData() {
  try {
    return recoverIfNeeded();
  } catch (error) {
    console.error("PayNest storage load error:", error);
    return clone(DEFAULT_DATA);
  }
}

export function saveData(data) {
  const safe = normalize(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function resetData() {
  // Only clear the active database.
  // Legacy/source keys are intentionally preserved for recovery.
  localStorage.removeItem(STORAGE_KEY);
  return clone(DEFAULT_DATA);
}

export function exportData(data = loadData()) {
  return JSON.stringify(normalize(data), null, 2);
}

export function importData(text) {
  const parsed = parseJSON(text);
  if (!parsed) throw new Error("Invalid JSON");
  const safe = normalize(parsed);
  saveData(safe);
  return safe;
}

export { STORAGE_KEY };
