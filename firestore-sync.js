// PayNest — Firestore Sync
// Cloud is the source of truth once a user document already exists.
// LocalStorage is only used to bootstrap a brand-new Cloud document.

import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "./firebase.js";

let unsubscribeRealtime = null;

function currentUser() {
  return auth.currentUser;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasData(data) {
  return !!data && typeof data === "object";
}

function userDocumentRef() {
  const user = currentUser();
  return user ? doc(db, "users", user.uid) : null;
}

export async function getCloudData() {
  const ref = userDocumentRef();
  if (!ref) return null;

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;

  const cloudData = snapshot.data()?.data;
  return hasData(cloudData) ? clone(cloudData) : null;
}

export async function setCloudData(data) {
  const ref = userDocumentRef();
  if (!ref) return false;

  await setDoc(ref, {
    data: clone(data),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return true;
}

// Initial login rule:
// 1) Existing Cloud data wins completely over stale LocalStorage.
// 2) If Cloud has no user document yet, upload the current LocalStorage once.
export async function syncInitialData(localData) {
  const ref = userDocumentRef();
  if (!ref) return localData;

  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const cloudData = snapshot.data()?.data;
    if (hasData(cloudData)) {
      return clone(cloudData);
    }
  }

  const safeLocal = clone(localData);
  await setDoc(ref, {
    data: safeLocal,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return safeLocal;
}

export function startRealtimeSync(onData) {
  stopRealtimeSync();

  const ref = userDocumentRef();
  if (!ref) return () => {};

  unsubscribeRealtime = onSnapshot(
    ref,
    snapshot => {
      if (!snapshot.exists()) return;

      const cloudData = snapshot.data()?.data;
      if (!hasData(cloudData)) return;

      try {
        onData(clone(cloudData));
      } catch (error) {
        console.error("PayNest realtime data handler error:", error);
      }
    },
    error => {
      console.warn("PayNest realtime sync error:", error);
    }
  );

  return unsubscribeRealtime;
}

export function stopRealtimeSync() {
  if (typeof unsubscribeRealtime === "function") {
    unsubscribeRealtime();
  }
  unsubscribeRealtime = null;
}
