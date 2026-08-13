// PayNest — Firebase Cloud Sync
// Authenticated per-user cloud storage.
// LocalStorage remains available as the local cache.

import { auth, db, doc, getDoc, setDoc } from "./firebase.js";

const COLLECTION = "users";
const FIELD = "data";

function currentUser() {
  return auth.currentUser;
}

export function isSignedIn() {
  return !!currentUser();
}

export async function loadCloudData() {
  const user = currentUser();
  if (!user) return null;

  const snap = await getDoc(doc(db, COLLECTION, user.uid));
  if (!snap.exists()) return null;

  const payload = snap.data();
  return payload?.[FIELD] ?? null;
}

export async function saveCloudData(data) {
  const user = currentUser();
  if (!user) return false;

  await setDoc(
    doc(db, COLLECTION, user.uid),
    {
      [FIELD]: data,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  return true;
}
