// PayNest — Safe Firestore Sync
// Explicit cloud operations. LocalStorage remains untouched unless the caller
// explicitly chooses to import/export cloud data.

import { auth, db, doc, getDoc, setDoc } from "./firebase.js";

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("PAYNEST_AUTH_REQUIRED");
  return user;
}

export async function getCloudData() {
  const user = requireUser();
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  const payload = snap.data();
  return payload?.data ?? null;
}

export async function setCloudData(data) {
  const user = requireUser();
  await setDoc(
    doc(db, "users", user.uid),
    {
      data,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  return true;
}
