const STORAGE_KEY = "paynest_v1_data";

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

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_DATA);
    return normalize(JSON.parse(raw));
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

export { STORAGE_KEY };

