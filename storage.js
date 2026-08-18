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

  const contracts = Array.isArray(data.contracts)
    ? data.contracts.filter(item => item && typeof item === "object")
    : [];

  const customers = Array.isArray(data.customers)
    ? data.customers.filter(item => item && typeof item === "object")
    : [];

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

export function validateImportData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {ok: false, message: "ไฟล์ต้องเป็นข้อมูล PayNest JSON"};
  }

  if (!Array.isArray(data.contracts) || !Array.isArray(data.customers)) {
    return {ok: false, message: "ไฟล์นี้ไม่ใช่ข้อมูลสำรองของ PayNest"};
  }

  for (const contract of data.contracts) {
    if (!contract || typeof contract !== "object") {
      return {ok: false, message: "พบข้อมูลสัญญาที่ไม่ถูกต้อง"};
    }
  }

  for (const customer of data.customers) {
    if (!customer || typeof customer !== "object") {
      return {ok: false, message: "พบข้อมูลลูกค้าที่ไม่ถูกต้อง"};
    }
  }

  return {ok: true};
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

// Local-only persistence. Used when Firestore sends a newer snapshot so
// the incoming Cloud data cannot be sent straight back to Cloud again.
export function saveLocalData(data) {
  const safe = normalize(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return safe;
}

export function saveData(data) {
  const safe = saveLocalData(data);

  // User-initiated local changes are synced to Cloud.
  import("./firestore-sync.js")
    .then(({setCloudData}) => setCloudData(safe))
    .catch(error => console.warn("PayNest cloud sync skipped:", error));

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
  const validation = validateImportData(parsed);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const safe = normalize(parsed);
  saveData(safe);
  return safe;
}

export { STORAGE_KEY };
