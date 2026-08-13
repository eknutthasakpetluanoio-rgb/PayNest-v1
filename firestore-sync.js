// PayNest — Firestore Sync
// Safe merge strategy: never replaces non-empty local data with an empty cloud document.

import { auth, db, doc, getDoc, setDoc } from "./firebase.js";

function currentUser() {
  return auth.currentUser;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeById(localItems, cloudItems) {
  const result = [];
  const seen = new Set();

  for (const item of Array.isArray(localItems) ? localItems : []) {
    if (!item || typeof item !== "object") continue;
    const id = item.id ?? JSON.stringify(item);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }

  for (const item of Array.isArray(cloudItems) ? cloudItems : []) {
    if (!item || typeof item !== "object") continue;
    const id = item.id ?? JSON.stringify(item);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }

  return result;
}

function mergeData(localData, cloudData) {
  if (!cloudData) return clone(localData);
  if (!localData) return clone(cloudData);

  return {
    version: 1,
    contracts: mergeById(localData.contracts, cloudData.contracts),
    customers: mergeById(localData.customers, cloudData.customers),
    settings: {
      ...(cloudData.settings || {}),
      ...(localData.settings || {})
    }
  };
}

export async function getCloudData() {
  const user = currentUser();
  if (!user) return null;

  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) return null;

  return snapshot.data()?.data ?? null;
}

export async function setCloudData(data) {
  const user = currentUser();
  if (!user) return false;

  await setDoc(doc(db, "users", user.uid), {
    data: clone(data),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return true;
}

export async function syncInitialData(localData) {
  const cloudData = await getCloudData();
  const merged = mergeData(localData, cloudData);
  await setCloudData(merged);
  return merged;
}
