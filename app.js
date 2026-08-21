/* =========================================================
   PAYPREMINIQ – Smart Payment Intelligence
   Single-file application controller.
   The original PAYPREMINIQ business/UI logic is preserved here;
   storage, Firebase sync, and PWA controller are consolidated
   so the project remains exactly six files.
========================================================= */

(async function bootPaypreminiq(){

/* ---------- Firebase (safe lazy bootstrap) ----------
   Firebase must never be allowed to prevent the UI from booting.
   GitHub Pages can temporarily fail to load a remote module; in that case
   PAYPREMINIQ remains usable from its local data and cloud features are
   simply disabled until the page is reloaded.
--------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCGc0iB3dZe_CZe8vLfEuPwgnn5XCgI5gs",
  authDomain: "paynest-cloud.firebaseapp.com",
  projectId: "paynest-cloud",
  storageBucket: "paynest-cloud.firebasestorage.app",
  messagingSenderId: "469151372030",
  appId: "1:469151372030:web:625320d22038fe42484baf"
};

let firebaseReady = false;
let firebaseError = null;
let firebaseAuthPromise = null;
let auth = { currentUser: null };
let db = null;
let initializeApp, getAuth, firebaseOnAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail;
let createUserWithEmailAndPassword, signOut, getFirestore, doc, getDoc;
let setDoc, onSnapshot, serverTimestamp;

async function initializeFirebaseInBackground() {
  try {
    // IMPORTANT: Auth must not depend on Firestore loading.
    // A Firestore/module failure must never make login/reset appear unavailable.
    const [appMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js")
    ]);

    ({ initializeApp } = appMod);
    ({ getAuth, onAuthStateChanged: firebaseOnAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail,
       createUserWithEmailAndPassword, signOut } = authMod);

    const firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    firebaseReady = true;
    firebaseError = null;

    // Auth is ready now, independently of Firestore.
    firebaseOnAuthStateChanged(auth, async user => {
      renderAuthButton();
      if (!user) {
        stopRealtimeSync();
        return;
      }
      await bootstrapCloud();
    });

    // Firestore is loaded separately so it cannot block Authentication.
    try {
      const firestoreMod = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js");
      ({ getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } = firestoreMod);
      db = getFirestore(firebaseApp);
      // If the user was already authenticated before Firestore finished loading, hydrate now.
      if (auth.currentUser) await bootstrapCloud();
    } catch (firestoreError) {
      console.warn("PAYPREMINIQ: Firestore unavailable; Authentication remains available.", firestoreError);
    }
  } catch (error) {
    firebaseError = error;
    console.warn("PAYPREMINIQ: Firebase unavailable; local mode enabled.", error);
    throw error;
  }
}

function waitForFirebaseAuth(timeoutMs = 12000) {
  if (firebaseReady && auth && typeof signInWithEmailAndPassword === "function") return Promise.resolve(true);
  if (!firebaseAuthPromise) {
    firebaseAuthPromise = initializeFirebaseInBackground().catch(() => false);
  }
  return Promise.race([
    firebaseAuthPromise.then(() => firebaseReady),
    new Promise(resolve => setTimeout(() => resolve(false), timeoutMs))
  ]);
}


/* ---------- Local Storage ---------- */

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
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return clone(DEFAULT_DATA);
  }

  const contracts = Array.isArray(data.contracts)
    ? data.contracts.filter(item => item && typeof item === "object")
    : [];

  const customers = Array.isArray(data.customers)
    ? data.customers.filter(item => item && typeof item === "object").map(customer => ({
        ...customer,
        contacts: customer.contacts && typeof customer.contacts === "object" ? customer.contacts : {},
        address: String(customer.address || ""),
        note: String(customer.note || ""),
        photo: String(customer.photo || "")
      }))
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

function validateImportData(imported) {
  if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
    return {ok: false, message: "ไฟล์ต้องเป็นข้อมูล PAYPREMINIQ JSON"};
  }

  if (!Array.isArray(imported.contracts) || !Array.isArray(imported.customers)) {
    return {ok: false, message: "ไฟล์นี้ไม่ใช่ข้อมูลสำรองของ PAYPREMINIQ"};
  }

  for (const contract of imported.contracts) {
    if (!contract || typeof contract !== "object") {
      return {ok: false, message: "พบข้อมูลสัญญาที่ไม่ถูกต้อง"};
    }
  }

  for (const customer of imported.customers) {
    if (!customer || typeof customer !== "object") {
      return {ok: false, message: "พบข้อมูลลูกค้าที่ไม่ถูกต้อง"};
    }
  }

  return {ok: true};
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_DATA);
    return normalize(JSON.parse(raw));
  } catch (error) {
    console.error("PAYPREMINIQ storage load error:", error);
    return clone(DEFAULT_DATA);
  }
}

const RECOVERY_KEY = "paynest_v1_recovery";

function saveLocalData(value) {
  const safe = normalize(value);
  const serialized = JSON.stringify(safe);

  try {
    // Keep the previous non-empty database as an emergency local recovery copy.
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      try {
        const previousData = normalize(JSON.parse(previous));
        if (hasMeaningfulData(previousData)) {
          localStorage.setItem(RECOVERY_KEY, JSON.stringify(previousData));
        }
      } catch (_) {}
    }

    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("PAYPREMINIQ local save error:", error);
    throw error;
  }

  return safe;
}

function exportData(value = loadData()) {
  return JSON.stringify(normalize(value), null, 2);
}

function importData(text) {
  const parsed = JSON.parse(text);
  const validation = validateImportData(parsed);
  if (!validation.ok) throw new Error(validation.message);

  const safe = normalize(parsed);
  saveLocalData(safe);
  setCloudData(safe).catch(error =>
    console.warn("PAYPREMINIQ cloud sync skipped:", error)
  );
  return safe;
}

function resetData() {
  const current = loadData();
  if (hasMeaningfulData(current)) {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(current));
  }
  localStorage.removeItem(STORAGE_KEY);
  return clone(DEFAULT_DATA);
}

/* ---------- Firestore Sync ---------- */

let unsubscribeRealtime = null;

function currentUser() {
  return auth.currentUser;
}

function userDocumentRef() {
  const user = currentUser();
  return firebaseReady && db && user ? doc(db, "users", user.uid) : null;
}

async function getCloudData() {
  const ref = userDocumentRef();
  if (!ref) return null;

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;

  const cloudData = snapshot.data()?.data;
  return cloudData && typeof cloudData === "object" ? clone(cloudData) : null;
}

async function setCloudData(value) {
  const ref = userDocumentRef();
  if (!ref) return false;

  await setDoc(ref, {
    data: clone(normalize(value)),
    updatedAt: serverTimestamp()
  }, {merge: true});

  return true;
}

function hasMeaningfulData(value) {
  const safe = normalize(value);
  return safe.contracts.length > 0 || safe.customers.length > 0;
}

function mergeDataWithoutLoss(localValue, cloudValue) {
  const localSafe = normalize(localValue);
  const cloudSafe = normalize(cloudValue);

  // IMPORTANT: an empty cloud document must never erase non-empty local data.
  // This is the protection that prevents a fresh/empty Firebase account from
  // replacing an existing PAYPREMINIQ database on the device.
  if (hasMeaningfulData(localSafe) && !hasMeaningfulData(cloudSafe)) {
    return localSafe;
  }

  // If the device is empty but Cloud has data, restore Cloud to the device.
  if (!hasMeaningfulData(localSafe) && hasMeaningfulData(cloudSafe)) {
    return cloudSafe;
  }

  // If both have data, keep the device copy for this safety-first build.
  // Without per-record revision timestamps, choosing Cloud blindly can erase
  // newer local records. The next safe sync writes this preserved copy back.
  return localSafe;
}

async function syncInitialData(localData) {
  const ref = userDocumentRef();
  const safeLocal = clone(normalize(localData));
  if (!ref) return safeLocal;

  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      data: safeLocal,
      updatedAt: serverTimestamp()
    }, {merge: true});
    return safeLocal;
  }

  const cloudData = snapshot.data()?.data;
  const chosen = mergeDataWithoutLoss(safeLocal, cloudData);

  // If local contains real data and Cloud is empty/invalid, repair Cloud from
  // the local copy instead of destroying the local copy.
  if (hasMeaningfulData(safeLocal) && !hasMeaningfulData(cloudData)) {
    await setDoc(ref, {
      data: clone(chosen),
      updatedAt: serverTimestamp()
    }, {merge: true});
  } else if (!hasMeaningfulData(safeLocal) && hasMeaningfulData(cloudData)) {
    saveLocalData(chosen);
  }

  return clone(chosen);
}

function startRealtimeSync(onData) {
  stopRealtimeSync();

  const ref = userDocumentRef();
  if (!ref) return () => {};

  unsubscribeRealtime = onSnapshot(
    ref,
    snapshot => {
      if (!snapshot.exists()) return;

      const cloudData = snapshot.data()?.data;
      if (!cloudData || typeof cloudData !== "object") return;

      if (cloudWriteInProgress) return;

      // Safety-first realtime rule: a Cloud snapshot may restore an empty
      // device, but it must not replace an already populated local database.
      const incoming = normalize(cloudData);
      if (hasMeaningfulData(data)) {
        console.warn("PAYPREMINIQ: ignored Cloud snapshot because local data is populated");
        return;
      }

      try {
        onData(clone(incoming));
      } catch (error) {
        console.error("PAYPREMINIQ realtime data handler error:", error);
      }
    },
    error => console.warn("PAYPREMINIQ realtime sync error:", error)
  );

  return unsubscribeRealtime;
}

function stopRealtimeSync() {
  if (typeof unsubscribeRealtime === "function") unsubscribeRealtime();
  unsubscribeRealtime = null;
}

/* ---------- PWA ---------- */

(() => {
  "use strict";

  const SW_URL = "./sw.js";
  const SW_SCOPE = "./";
  let deferredInstallPrompt = null;

  const getById = id => document.getElementById(id);

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true;

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;

    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: SW_SCOPE,
        updateViaCache: "none"
      });
      try { await registration.update(); } catch (_) {}
      return registration;
    } catch (error) {
      console.error("[PAYPREMINIQ PWA] Service Worker registration failed:", error);
      return null;
    }
  }

  function showInstallButton() {
    const el = getById("installApp");
    if (!el) return;
    const hidden = isStandalone() && !deferredInstallPrompt;
    el.hidden = hidden;
    el.setAttribute("aria-hidden", String(hidden));
  }

  function closeInstallHelp() {
    const root = getById("pwaInstallRoot");
    if (root) root.innerHTML = "";
  }

  function showInstallHelp() {
    let root = getById("pwaInstallRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "pwaInstallRoot";
      document.body.appendChild(root);
    }

    root.innerHTML = `
      <div class="overlay" role="dialog" aria-modal="true" aria-label="ติดตั้ง PAYPREMINIQ">
        <div class="modal small">
          <div class="modal-head">
            <div>
              <div class="eyebrow">PAYPREMINIQ PWA</div>
              <h2>ติดตั้ง PAYPREMINIQ</h2>
            </div>
            <button class="icon-btn" type="button" data-pwa-close aria-label="ปิด">×</button>
          </div>

          <div class="form-note">
            <b>เพิ่ม PAYPREMINIQ ลงหน้าจอหลัก</b>
            <span>
              หาก Chrome ยังไม่แสดงหน้าต่างติดตั้งอัตโนมัติ
              ให้เปิดเมนู <b>⋮</b> ของ Chrome แล้วเลือก
              <b>ติดตั้งแอป</b> หรือ <b>เพิ่มไปยังหน้าจอหลัก</b>
            </span>
          </div>

          <button class="wide-btn" type="button" data-pwa-close>เข้าใจแล้ว</button>
        </div>
      </div>`;

    root.querySelectorAll("[data-pwa-close]").forEach(el =>
      el.addEventListener("click", closeInstallHelp)
    );
  }

  async function install() {
    if (isStandalone()) return;

    if (!deferredInstallPrompt) {
      showInstallHelp();
      return;
    }

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (error) {
      console.warn("[PAYPREMINIQ PWA] Install prompt failed:", error);
    }

    showInstallButton();
  }

  registerServiceWorker();

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    showInstallButton();
  });

  window.addEventListener("DOMContentLoaded", () => {
    getById("installApp")?.addEventListener("click", install);
    showInstallButton();
  });

  window.addEventListener("pageshow", showInstallButton);
})();

let data = loadData();
let page = "dashboard";
let contractFilter = "active";
let contractQuery = "";
let customerQuery = "";

const $ = selector => document.querySelector(selector);
const uid = () => globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[char]));

const money = value =>
  `${data.settings.currency}${Number(value || 0).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  })}`;

/* ---------- Product image helpers (UI-only, existing data remains intact) ---------- */
function productInitials(product) {
  const text = String(product || "สินค้า").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function defaultProductImage(product) {
  const text = String(product || "").toLowerCase();
  if (text.includes("vivo") && text.includes("v70")) return "./products/vivo-v70.png";
  if (text.includes("soundcore") && text.includes("r60i")) return "./products/soundcore-r60i-nc.png";
  if (text.includes("redmi") && text.includes("watch") && text.includes("5")) return "./products/redmi-watch-5-lite.png";
  return "";
}

function productThumb(product, imageData = "", size = "small") {
  const safeImage = String(imageData || "");
  const fallback = defaultProductImage(product);
  // For the three catalog products, always use the supplied sharp transparent
  // product asset so legacy LocalStorage imageData cannot bring the old image back.
  const src = fallback || (safeImage.startsWith("data:image/") ? safeImage : "");
  return `<div class="product-thumb product-thumb-${size}" aria-hidden="true">${
    src ? `<img src="${esc(src)}" alt="">` : `<span>${esc(productInitials(product))}</span>`
  }</div>`;
}

function compressProductImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type.startsWith("image/")) return reject(new Error("กรุณาเลือกไฟล์รูปภาพ"));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านรูปภาพไม่สำเร็จ"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("รูปภาพไม่ถูกต้อง"));
      img.onload = () => {
        const max = 320;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric"
      });
}

let cloudWriteInProgress = false;

function persist() {
  data = saveLocalData(data);
  render();

  if (currentUser()) {
    cloudWriteInProgress = true;
    setCloudData(data)
      .catch(error => {
        console.error("PAYPREMINIQ cloud save error:", error);
        console.warn("ข้อมูลถูกเก็บไว้ในเครื่อง แต่การบันทึก Firebase ไม่สำเร็จ");
      })
      .finally(() => {
        cloudWriteInProgress = false;
      });
  }

  return data;
}

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง — หากจำรหัสไม่ได้ ให้ใช้ “ลืมรหัสผ่าน”";
  if (code.includes("email-already-in-use")) return "อีเมลนี้ถูกใช้แล้ว";
  if (code.includes("weak-password")) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  if (code.includes("invalid-email")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (code.includes("network-request-failed")) return "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้";
  if (code.includes("operation-not-allowed")) return "Firebase ยังไม่ได้เปิด Email/Password Authentication";
  if (code.includes("too-many-requests")) return "ลองเข้าสู่ระบบใหม่อีกครั้งภายหลัง";
  return "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่";
}

function openAuthModal() {
  $("#modalRoot").innerHTML = `
    <div class="overlay">
      <div class="modal small auth-modal" role="dialog" aria-modal="true" aria-label="บัญชี PAYPREMINIQ">
        <div class="modal-head">
          <div>
            <div class="eyebrow">PAYPREMINIQ CLOUD</div>
            <h2>บัญชีของคุณ</h2>
          </div>
          <button class="icon-btn" data-close type="button" aria-label="ปิด">×</button>
        </div>

        <div class="form-note">
          <b>ซิงก์ข้อมูลกับ Firebase Cloud</b>
          <span>เข้าสู่ระบบเพื่อเก็บข้อมูล PAYPREMINIQ ไว้บนบัญชีของคุณ และใช้งานข้อมูลเดิมจากเครื่องอื่นได้</span>
        </div>

        <label>อีเมล
          <input id="authEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com">
        </label>

        <label>รหัสผ่าน
          <input id="authPassword" type="password" autocomplete="current-password" placeholder="อย่างน้อย 6 ตัวอักษร">
        </label>

        <div class="modal-actions">
          <button class="primary-btn" id="authLogin" type="button">เข้าสู่ระบบ</button>
          <button class="wide-btn" id="authRegister" type="button">สร้างบัญชีใหม่</button>
        </div>

        <button class="auth-reset-btn" id="authReset" type="button">ลืมรหัสผ่าน?</button>
        <p id="authStatus" class="muted auth-status" role="status" aria-live="polite"></p>
      </div>
    </div>`;

  const status = $("#authStatus");
  const email = $("#authEmail");
  const password = $("#authPassword");

  async function resetPassword() {
    const emailValue = email.value.trim();
    if (!emailValue) {
      status.textContent = "กรุณากรอกอีเมลก่อน แล้วกด “ลืมรหัสผ่าน?”";
      email.focus();
      return;
    }
    status.textContent = "กำลังเชื่อมต่อ Firebase Authentication...";
    const ready = await waitForFirebaseAuth();
    if (!ready || !auth || typeof sendPasswordResetEmail !== "function") {
      const code = firebaseError?.code || "";
      status.textContent = code ? `Firebase Authentication เชื่อมต่อไม่ได้ (${code})` : "เชื่อมต่อ Firebase Authentication ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
      return;
    }

    status.textContent = "กำลังส่งลิงก์รีเซ็ตรหัสผ่าน...";
    try {
      await sendPasswordResetEmail(auth, emailValue);
      status.textContent = "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจ Inbox หรือ Spam";
    } catch (error) {
      console.error("PAYPREMINIQ password reset error:", error);
      const code = error?.code || "";
      if (code.includes("invalid-email")) {
        status.textContent = "รูปแบบอีเมลไม่ถูกต้อง";
      } else if (code.includes("user-not-found")) {
        status.textContent = "ไม่พบบัญชีจากอีเมลนี้";
      } else if (code.includes("too-many-requests")) {
        status.textContent = "ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่";
      } else if (code.includes("network-request-failed")) {
        status.textContent = "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้";
      } else {
        status.textContent = "ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ กรุณาลองใหม่";
      }
    }
  }

  async function runAuth(action) {
    const emailValue = email.value.trim();
    const passwordValue = password.value;
    if (!emailValue || !passwordValue) {
      status.textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
      return;
    }
    status.textContent = "กำลังเชื่อมต่อ Firebase Authentication...";
    const ready = await waitForFirebaseAuth();
    if (!ready || !auth || typeof signInWithEmailAndPassword !== "function") {
      const code = firebaseError?.code || "";
      status.textContent = code ? `Firebase Authentication เชื่อมต่อไม่ได้ (${code})` : "เชื่อมต่อ Firebase Authentication ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
      return;
    }
    try {
      if (action === "login") {
        await signInWithEmailAndPassword(auth, emailValue, passwordValue);
      } else {
        await createUserWithEmailAndPassword(auth, emailValue, passwordValue);
      }
      $("#modalRoot").innerHTML = "";
    } catch (error) {
      console.error(error);
      status.textContent = authErrorMessage(error);
    }
  }

  $("#authLogin").addEventListener("click", () => runAuth("login"));
  $("#authRegister").addEventListener("click", () => runAuth("register"));
  $("#authReset").addEventListener("click", resetPassword);
}

function renderAuthButton() {
  const button = $("#cloudAccount");
  if (!button) return;
  const user = auth.currentUser;
  button.textContent = user ? "☁" : "☁";
  button.title = user ? `Cloud: ${user.email} — กดเพื่อออกจากระบบ` : "เข้าสู่ระบบ PAYPREMINIQ Cloud";
  button.setAttribute("aria-label", button.title);
}

async function bootstrapCloud() {
  try {
    // Safety-first sync: populated local data is preserved. Cloud is used to
    // restore an empty device, or initialized from the device when empty.
    const cloudData = await syncInitialData(data);
    data = saveLocalData(cloudData);
    render();

    // After the safety decision, publish the preserved device copy to Cloud.
    // This repairs an empty/stale Cloud document instead of allowing it to
    // erase the device database.
    cloudWriteInProgress = true;
    try {
      await setCloudData(data);
    } catch (error) {
      console.warn("PAYPREMINIQ cloud repair skipped:", error);
    } finally {
      cloudWriteInProgress = false;
    }

    startRealtimeSync(cloudData => {
      // Never call saveData() here: that would write the incoming Cloud
      // snapshot back to Cloud and can create a sync loop.
      data = saveLocalData(cloudData);
      render();
    });
  } catch (error) {
    stopRealtimeSync();
    console.warn("PAYPREMINIQ initial cloud sync skipped:", error);
  }
}

function customerById(id) {
  return data.customers.find(customer => customer.id === id);
}

function remaining(contract) {
  return Math.max(0, Number(contract.total) - Number(contract.received));
}

function getStatus(contract) {
  return remaining(contract) <= 0 && Number(contract.total) > 0 ? "paid" : "active";
}

function installmentAmount(contract, index) {
  const total = Math.max(0, Number(contract.total || 0));
  const count = Math.max(1, Number(contract.installments || 1));
  const base = Math.round((total / count) * 100) / 100;
  if (index === count - 1) {
    const previous = base * (count - 1);
    return Math.round((total - previous) * 100) / 100;
  }
  return base;
}

function addPeriod(dateValue, index, type) {
  const source = new Date(`${dateValue || localToday()}T00:00:00`);
  if (Number.isNaN(source.getTime())) return localToday();

  const d = new Date(source);
  if (type === "daily") {
    d.setDate(d.getDate() + index);
  } else if (type === "weekly") {
    d.setDate(d.getDate() + (index * 7));
  } else {
    // Monthly dates are clamped to the last valid day of the target month.
    const originalDay = d.getDate();
    const targetMonth = d.getMonth() + index;
    d.setDate(1);
    d.setMonth(targetMonth);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(originalDay, lastDay));
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getInstallmentSchedule(contract) {
  const count = Math.max(1, Number(contract.installments || 1));
  const received = Math.max(0, Number(contract.received || 0));
  const type = contract.paymentType || "monthly";
  const today = new Date(`${localToday()}T00:00:00`);
  let cumulativeDue = 0;

  return Array.from({length: count}, (_, index) => {
    const amount = installmentAmount(contract, index);
    const previousDue = cumulativeDue;
    cumulativeDue += amount;
    const dueDate = addPeriod(contract.dueDate || contract.startDate || localToday(), index, type);
    const due = new Date(`${dueDate}T00:00:00`);
    const daysUntilDue = Math.round((due - today) / 86400000);

    let status = "pending";
    let paidAmount = 0;
    if (received >= cumulativeDue - 0.005) {
      status = "paid";
      paidAmount = amount;
    } else if (received > previousDue + 0.005) {
      status = daysUntilDue < 0 ? "overdue-partial" : "partial";
      paidAmount = Math.min(amount, received - previousDue);
    } else if (daysUntilDue < 0) {
      status = "overdue";
    } else if (daysUntilDue <= 3) {
      status = "due-soon";
    }

    return {
      number: index + 1,
      amount,
      paidAmount: Math.round(paidAmount * 100) / 100,
      remainingAmount: Math.max(0, Math.round((amount - paidAmount) * 100) / 100),
      dueDate,
      status,
      daysUntilDue
    };
  });
}

function getNextInstallment(contract) {
  return getInstallmentSchedule(contract).find(item => item.status !== "paid") || null;
}

function installmentStatusLabel(item) {
  return ({
    paid: "ชำระแล้ว",
    partial: "ชำระบางส่วน",
    "overdue-partial": "ค้างชำระบางส่วน",
    overdue: "ค้างชำระ",
    "due-soon": "ใกล้ถึงกำหนด",
    pending: "รอชำระ"
  }[item.status] || "รอชำระ");
}

function paymentStatus(contract) {
  if (getStatus(contract) === "paid") return "paid";
  const received = Number(contract.received || 0);
  const dueDate = contract.dueDate ? new Date(`${contract.dueDate}T23:59:59`) : null;
  const today = new Date(`${localToday()}T00:00:00`);
  if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < today) {
    return received > 0 ? "overdue-partial" : "overdue";
  }
  return received > 0 ? "partial" : "due";
}

function statusLabel(contract) {
  return ({
    paid: "ชำระครบ",
    overdue: "ค้างชำระ",
    "overdue-partial": "ค้างชำระบางส่วน",
    partial: "ชำระบางส่วน",
    due: "ถึงกำหนด"
  }[paymentStatus(contract)] || "กำลังผ่อน");
}

function statusClass(contract) {
  return paymentStatus(contract);
}

function stats() {
  const active = data.contracts.filter(c => getStatus(c) === "active");
  return {
    portfolio: data.contracts.reduce((sum, c) => sum + Number(c.total || 0), 0),
    received: data.contracts.reduce((sum, c) => sum + Number(c.received || 0), 0),
    due: active.reduce((sum, c) => sum + remaining(c), 0),
    active: active.length,
    overdue: active.filter(c => ["overdue", "overdue-partial"].includes(paymentStatus(c))).length,
    dueToday: active.filter(c => c.dueDate === localToday()).length,
    customers: data.customers.length
  };
}

function render() {
  const titles = {
    dashboard: "ภาพรวม",
    contracts: "สัญญา",
    customers: "ลูกค้า",
    settings: "ตั้งค่า"
  };

  $("#pageTitle").textContent = titles[page];
  document.querySelectorAll(".nav-item").forEach(button =>
    button.classList.toggle("active", button.dataset.page === page)
  );

  const showFab = page !== "settings";
  $("#fab").style.display = showFab ? "flex" : "none";
  $("#fabLabel").textContent = page === "customers" ? "ลูกค้า" : "สัญญา";

  $("#view").innerHTML =
    page === "dashboard" ? dashboard() :
    page === "contracts" ? contracts() :
    page === "customers" ? customers() :
    settings();
}

function dashboard() {
  const s = stats();
  const recent = [...data.contracts]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 4);

  return `<section class="page">
    <div class="welcome-row">
      <div>
        <div class="eyebrow">OVERVIEW</div>
        <p class="subtle">ภาพรวมการรับชำระของคุณ</p>
      </div>
      <div class="today-chip">${fmtDate(localToday())}</div>
    </div>

    <div class="hero card">
      <div class="eyebrow">ยอดสัญญาทั้งหมด</div>
      <div class="hero-number">${money(s.portfolio)}</div>
      <div class="hero-meta">
        <span>${s.active} สัญญาที่ยังมียอดค้าง</span>
        <span>รับแล้ว ${money(s.received)}</span>
      </div>
    </div>

    <div class="stat-grid">
      <div class="card stat">
        <span>ยอดค้างรับ</span>
        <strong>${money(s.due)}</strong>
        <small>${s.active ? "มีรายการที่ยังไม่ครบ" : "ไม่มีรายการค้าง"}</small>
      </div>
      <div class="card stat">
        <span>ลูกค้า</span>
        <strong>${s.customers}</strong>
        <small>${data.contracts.length} สัญญา</small>
      </div>
    </div> 
    <div class="status-summary card">
      <div><b>สถานะการชำระ</b><span>ค้างกำหนด ${s.overdue} · ครบกำหนดวันนี้ ${s.dueToday}</span></div>
      <span class="summary-dot ${s.overdue ? "has-overdue" : ""}">${s.overdue ? "ต้องติดตาม" : "ปกติ"}</span>
    </div>

    <section class="section">
      <div class="section-head">
        <div><div class="eyebrow">ACTION</div><h2>รายการที่ต้องจัดการ</h2></div>
        <button class="text-btn" data-page="contracts">ดูทั้งหมด</button>
      </div>
      ${actionList()}
    </section>

    <section class="section">
      <div class="section-head">
        <div><div class="eyebrow">RECENT</div><h2>สัญญาล่าสุด</h2></div>
        <button class="text-btn" data-page="contracts">ทั้งหมด</button>
      </div>
      ${recent.length
        ? recent.map(contractCard).join("")
        : emptyState("＋", "ยังไม่มีสัญญา", "กดปุ่ม + เพื่อเริ่มสร้างสัญญา")}
    </section>
  </section>`;
}

function actionList() {
  const active = data.contracts
    .filter(c => getStatus(c) === "active")
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  if (!active.length) {
    return emptyState("✓", "วันนี้ไม่มีรายการค้างรับ", "ทุกสัญญาที่มีอยู่ยังไม่มียอดที่ต้องรับ");
  }

  return active.slice(0, 4).map(c => `
    <div class="task card">
      <div class="task-main">
        <b>${esc(c.product)}</b>
        <span>${esc(c.customerName || "ไม่ระบุลูกค้า")}</span>
        <small>${getNextInstallment(c) ? `งวดถัดไป ${fmtDate(getNextInstallment(c).dueDate)}` : "ชำระครบแล้ว"}</small>
      </div>
      <div class="task-right">
        <strong>${money(remaining(c))}</strong>
        <span class="status-text ${statusClass(c)}">${statusLabel(c)}</span>
        <button class="mini-btn primary-mini" data-pay="${c.id}">รับชำระ</button>
      </div>
    </div>
  `).join("");
}

function contractCard(c) {
  const pct = c.total > 0 ? Math.min(100, (c.received / c.total) * 100) : 0;
  const paid = getStatus(c) === "paid";
  const installmentAmount = c.installments > 0 ? c.total / c.installments : c.total;

  return `<article class="contract-card card" data-contract-card="${c.id}">
    <div class="contract-top">
      <div class="contract-title-wrap">
        ${productThumb(c.product, c.imageData, "small")}
        <div class="contract-title-copy">
          <h3>${esc(c.product)}</h3>
          <span>${esc(c.customerName || "ไม่ระบุลูกค้า")}</span>
        </div>
      </div>
      <span class="pill ${statusClass(c)}">${statusLabel(c)}</span>
    </div>

    <div class="progress"><i style="width:${pct}%"></i></div>

    <div class="progress-meta">
      <span>${Math.round(pct)}% · รับแล้ว ${money(c.received)}</span>
      <span>เหลือ ${money(remaining(c))}</span>
    </div>

    <div class="contract-info">
      <span>${c.installments} งวด · ${paymentTypeLabel(c.paymentType)}</span>
      <span>งวดละประมาณ ${money(installmentAmount)}</span>
    </div>

    <div class="contract-bottom">
      <span>${paid ? "✓ ชำระครบแล้ว" :
        (["overdue","overdue-partial"].includes(paymentStatus(c))
          ? "⚠ เกินกำหนด " + fmtDate(getNextInstallment(c)?.dueDate || c.dueDate)
          : "งวดถัดไป " + fmtDate(getNextInstallment(c)?.dueDate || c.dueDate))}</span>
      <div class="button-row">
        <button class="mini-btn ghost-mini" data-detail="${c.id}">รายละเอียด</button>
        ${paid
          ? `<span class="mini-btn paid-label">ชำระครบ</span>`
          : `<button class="mini-btn primary-mini" data-pay="${c.id}">รับชำระ</button>`}
      </div>
    </div>
  </article>`;
}

function paymentTypeLabel(type) {
  return ({daily:"รายวัน", weekly:"รายสัปดาห์", monthly:"รายเดือน"}[type] || "รายเดือน");
}

function contracts() {
  const all = [...data.contracts]
    .filter(c => {
      if (contractFilter === "active") return getStatus(c) === "active";
      if (contractFilter === "overdue") return ["overdue", "overdue-partial"].includes(paymentStatus(c));
      if (contractFilter === "partial") return paymentStatus(c) === "partial";
      if (contractFilter === "paid") return getStatus(c) === "paid";
      return true;
    })
    .filter(c => {
      const q = contractQuery.trim().toLowerCase();
      if (!q) return true;
      return [c.product, c.customerName, c.phone]
        .some(value => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const activeCount = data.contracts.filter(c => getStatus(c) === "active").length;
  const paidCount = data.contracts.filter(c => getStatus(c) === "paid").length;

  return `<section class="page">
    <div class="section-head page-heading">
      <div><div class="eyebrow">CONTRACTS</div><h2>สัญญาทั้งหมด</h2></div>
      <span class="count">${data.contracts.length}</span>
    </div>

    <div class="search-wrap">
      <span>⌕</span>
      <input id="contractSearch" value="${esc(contractQuery)}" placeholder="ค้นหาสินค้า หรือลูกค้า" autocomplete="off">
      ${contractQuery ? `<button class="clear-search" data-clear-contract-search>×</button>` : ""}
    </div>

    <div class="tabs">
      <button class="tab ${contractFilter === "active" ? "active" : ""}" data-contract-filter="active">กำลังผ่อน <b>${activeCount}</b></button>
      <button class="tab ${contractFilter === "overdue" ? "active" : ""}" data-contract-filter="overdue">ค้างชำระ <b>${data.contracts.filter(c => ["overdue","overdue-partial"].includes(paymentStatus(c))).length}</b></button>
      <button class="tab ${contractFilter === "partial" ? "active" : ""}" data-contract-filter="partial">บางส่วน <b>${data.contracts.filter(c => paymentStatus(c) === "partial").length}</b></button>
      <button class="tab ${contractFilter === "all" ? "active" : ""}" data-contract-filter="all">ทั้งหมด <b>${data.contracts.length}</b></button>
      <button class="tab ${contractFilter === "paid" ? "active" : ""}" data-contract-filter="paid">ชำระครบ <b>${paidCount}</b></button>
    </div>

    ${all.length
      ? all.map(contractCard).join("")
      : emptyState("⌕", "ไม่พบสัญญา", contractQuery ? "ลองเปลี่ยนคำค้นหา" : "กดปุ่ม + เพื่อสร้างสัญญา")}
  </section>`;
}

function customers() {
  const list = [...data.customers]
    .filter(c => {
      const q = customerQuery.trim().toLowerCase();
      return !q || [c.name, c.phone, c.note]
        .some(value => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));

  return `<section class="page">
    <div class="section-head page-heading">
      <div><div class="eyebrow">CUSTOMERS</div><h2>ลูกค้า</h2></div>
      <span class="count">${data.customers.length}</span>
    </div>

    <div class="search-wrap">
      <span>⌕</span>
      <input id="customerSearch" value="${esc(customerQuery)}" placeholder="ค้นหาชื่อลูกค้า หรือเบอร์โทร" autocomplete="off">
      ${customerQuery ? `<button class="clear-search" data-clear-customer-search>×</button>` : ""}
    </div>

    ${list.length
      ? list.map(customerCard).join("")
      : emptyState("＋", data.customers.length ? "ไม่พบลูกค้า" : "ยังไม่มีลูกค้า",
          data.customers.length ? "ลองเปลี่ยนคำค้นหา" : "กดปุ่ม + เพื่อเพิ่มลูกค้า")}
  </section>`;
}

function customerCard(c) {
  const contracts = data.contracts.filter(x => x.customerId === c.id);
  const outstanding = contracts
    .filter(x => getStatus(x) === "active")
    .reduce((sum, x) => sum + remaining(x), 0);

  const photo = c.photo
    ? `<img src="${esc(c.photo)}" alt="${esc(c.name || "ลูกค้า")}">`
    : `<span>${esc((c.name || "?").charAt(0))}</span>`;

  return `<article class="customer card">
    <div class="avatar customer-avatar">${photo}</div>
    <div class="customer-main">
      <b>${esc(c.name)}</b>
      <span>${esc(c.phone || "ไม่มีเบอร์โทร")}</span>
      <small>${contracts.length} สัญญา · ค้างรับ ${money(outstanding)}</small>
    </div>
    <button class="mini-btn ghost-mini" data-customer="${c.id}">ดู</button>
  </article>`;
}

function settings() {
  return `<section class="page">
    <div class="card settings-card">
      <div class="eyebrow">DATA</div>
      <h2>ข้อมูลของคุณ</h2>
      <p>PAYPREMINIQ เก็บข้อมูลไว้ในเครื่องนี้ด้วย LocalStorage และใช้ฐานข้อมูลชุดเดียวกันทุกหน้า</p>
      <div class="data-summary">
        <div><b>${data.contracts.length}</b><span>สัญญา</span></div>
        <div><b>${data.customers.length}</b><span>ลูกค้า</span></div>
      </div>
      <div class="backup-note">
        <b>สำรองข้อมูลก่อนแก้ไขหรือเปลี่ยนเครื่อง</b>
        <span>ไฟล์ JSON นี้เก็บสัญญา ลูกค้า และประวัติการรับชำระของ PAYPREMINIQ</span>
      </div>
      <button class="wide-btn action-backup" id="export">⬇ สำรองข้อมูลลงเครื่อง</button>
      <button class="wide-btn action-restore" id="import">↥ กู้คืนข้อมูลจากไฟล์</button>
      <button class="wide-btn action-clear danger" id="reset">ล้างข้อมูลทั้งหมด</button>
    </div>

    <div class="card settings-card">
      <div class="eyebrow">APP</div>
      <h2>PAYPREMINIQ v1</h2>
      <p>สร้างสัญญาได้ทันที · ลูกค้าเป็นข้อมูลเสริม · รับชำระหลายครั้ง · ค้นหา/กรองรายการ · สำรองและกู้คืน JSON</p>
      <div class="version-line"><span>เวอร์ชัน</span><b>v1 Final</b></div>
    </div>
  </section>`;
}

function emptyState(icon, title, text) {
  return `<div class="empty card">
    <div class="empty-icon">${icon}</div>
    <b>${esc(title)}</b>
    <span>${esc(text)}</span>
  </div>`;
}

function openContractModal(prefill = {}, editId = null) {
  const editing = Boolean(editId);
  const contract = editing ? data.contracts.find(c => c.id === editId) : null;
  if (editing && !contract) return;

  const source = contract || prefill;
  const selectedId = source.customerId || "";
  const receivedValue = Number(source.received || 0);
  const totalValue = Number(source.total || 0);
  const installmentsValue = Math.max(1, Number(source.installments || 1));

  $("#modalRoot").innerHTML = `<div class="overlay">
    <form class="modal" id="contractForm">
      <div class="modal-head">
        <div><div class="eyebrow">${editing ? "EDIT CONTRACT" : "NEW CONTRACT"}</div><h2>${editing ? "แก้ไขสัญญา" : "สร้างสัญญา"}</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="form-note">
        <b>${editing ? "แก้ไขข้อมูลสัญญา" : "เริ่มจากสัญญาได้เลย"}</b>
        <span>${editing
          ? "ยอดรับแล้วจะไม่ถูกแก้ไขจากหน้านี้ เพื่อรักษาประวัติการรับชำระเดิม"
          : "ไม่จำเป็นต้องสร้างลูกค้าก่อน ระบบจะผูกลูกค้าให้อัตโนมัติเมื่อกรอกชื่อ"}</span>
      </div>

      <label>สินค้า / รายการ
        <input name="product" required placeholder="เช่น Vivo V70" value="${esc(source.product || "")}">
      </label>

      <div class="product-image-field">
        <div class="product-image-preview" id="productImagePreview">
          ${productThumb(source.product || "สินค้า", source.imageData, "small")}
        </div>
        <div class="product-image-copy">
          <b>รูปสินค้า</b>
          <span>ระบบใส่รูปสินค้าให้ตามรุ่นอัตโนมัติ · เปลี่ยนรูปเองได้</span>
        </div>
        <label class="file-btn" for="productImageInput">เปลี่ยนรูป</label>
        <input id="productImageInput" name="productImage" type="file" accept="image/*" hidden>
        <button type="button" class="mini-btn ghost-mini" id="removeProductImage" aria-label="ใช้รูปอัตโนมัติ">รีเซ็ต</button>
      </div>

      ${data.customers.length ? `
      <label>เลือกลูกค้าที่มีอยู่
        <select name="customerId">
          <option value="">+ ลูกค้าใหม่ / ไม่เลือก</option>
          ${data.customers.map(c => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${esc(c.name)}${c.phone ? " · " + esc(c.phone) : ""}</option>`).join("")}
        </select>
      </label>` : ""}

      <div class="customer-row">
        <label>ชื่อลูกค้า
          <input name="customerName" placeholder="ชื่อ-นามสกุล" value="${esc(source.customerName || "")}">
        </label>
        <label>เบอร์โทร
          <input name="phone" inputmode="tel" placeholder="08xxxxxxxx" value="${esc(source.phone || "")}">
        </label>
      </div>

      <div class="customer-row">
        <label>ยอดรวม
          <input name="total" type="number" min="${editing ? Math.max(0.01, receivedValue) : "0.01"}" step="0.01" required placeholder="20000" value="${totalValue || ""}">
        </label>
        <label>รับแล้ว
          <input name="received" type="number" min="0" step="0.01" value="${receivedValue}">
        </label>
      </div>

      <div class="customer-row">
        <label>จำนวนงวด
          <input name="installments" type="number" min="1" step="1" value="${installmentsValue}">
        </label>
        <label>รูปแบบ
          <select name="paymentType">
            <option value="monthly" ${source.paymentType === "monthly" ? "selected" : ""}>รายเดือน</option>
            <option value="weekly" ${source.paymentType === "weekly" ? "selected" : ""}>รายสัปดาห์</option>
            <option value="daily" ${source.paymentType === "daily" ? "selected" : ""}>รายวัน</option>
          </select>
        </label>
      </div>

      <label>วันครบกำหนดงวดแรก
        <input name="dueDate" type="date" value="${esc(source.dueDate || localToday())}">
      </label>

      <div class="form-total" id="installmentPreview">ประมาณงวดละ ฿0</div>
      <button class="primary-btn" type="submit">${editing ? "บันทึกการแก้ไข" : "สร้างสัญญา"}</button>
    </form>
  </div>`;

  const form = $("#contractForm");
  const customerSelect = form.querySelector('[name="customerId"]');
  const totalInput = form.querySelector('[name="total"]');
  const installmentInput = form.querySelector('[name="installments"]');
  const preview = $("#installmentPreview");
  const productImageInput = $("#productImageInput");
  const productImagePreview = $("#productImagePreview");
  let productImageData = String(source.imageData || "");

  function updateProductImagePreview() {
    productImagePreview.innerHTML = productThumb(form.product?.value || "สินค้า", productImageData, "small");
  }

  productImageInput?.addEventListener("change", async () => {
    const file = productImageInput.files?.[0];
    if (!file) return;
    try {
      productImageData = await compressProductImage(file);
      updateProductImagePreview();
    } catch (error) {
      alert(error.message || "เพิ่มรูปสินค้าไม่สำเร็จ");
      productImageInput.value = "";
    }
  });

  $("#removeProductImage")?.addEventListener("click", () => {
    productImageData = "";
    if (productImageInput) productImageInput.value = "";
    updateProductImagePreview();
  });

  form.product?.addEventListener("input", updateProductImagePreview);

  function updatePreview() {
    const total = Number(totalInput?.value || 0);
    const installments = Math.max(1, Number(installmentInput?.value || 1));
    preview.textContent = `ประมาณงวดละ ${money(total / installments)}`;
  }

  customerSelect?.addEventListener("change", () => {
    const customer = customerById(customerSelect.value);
    if (customer) {
      form.customerName.value = customer.name;
      form.phone.value = customer.phone || "";
    }
  });

  totalInput?.addEventListener("input", updatePreview);
  installmentInput?.addEventListener("input", updatePreview);
  updatePreview();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const f = new FormData(form);

    let customerId = String(f.get("customerId") || "");
    let name = String(f.get("customerName") || "").trim();
    let phone = String(f.get("phone") || "").trim();

    if (customerId) {
      const customer = customerById(customerId);
      if (customer) {
        name = customer.name;
        phone = customer.phone || phone;
      }
    }

    const total = Number(f.get("total") || 0);
    if (total <= 0 || (editing && total < receivedValue)) {
      alert(editing
        ? `ยอดรวมต้องไม่น้อยกว่ายอดที่รับแล้ว ${money(receivedValue)}`
        : "กรุณาระบุยอดรวมให้ถูกต้อง");
      return;
    }

    if (name && !customerId) {
      let customer = data.customers.find(c =>
        c.name.toLowerCase() === name.toLowerCase() &&
        (!phone || c.phone === phone)
      );

      if (!customer) {
        customer = {
          id: uid(),
          name,
          phone,
          note: "",
          createdAt: new Date().toISOString()
        };
        data.customers.push(customer);
      }
      customerId = customer.id;
    }

    const updated = {
      product: String(f.get("product") || "ไม่ระบุ").trim(),
      imageData: productImageData,
      customerId,
      customerName: name,
      phone,
      total,
      paymentType: String(f.get("paymentType") || "monthly"),
      installments: Math.max(1, Number(f.get("installments") || 1)),
      dueDate: String(f.get("dueDate") || localToday())
    };

    if (editing) {
      Object.assign(contract, updated);
      contract.status = getStatus(contract);
    } else {
      const received = Math.min(total, Math.max(0, Number(f.get("received") || 0)));
      data.contracts.unshift({
        id: uid(),
        ...updated,
        received,
        startDate: localToday(),
        status: received >= total ? "paid" : "active",
        payments: received
          ? [{id: uid(), amount: received, date: localToday()}]
          : [],
        createdAt: new Date().toISOString()
      });
    }

    // Keep the linked customer record aligned with edits.
    if (customerId) {
      const customer = customerById(customerId);
      if (customer) {
        if (name) customer.name = name;
        customer.phone = phone;
      }
    }

    $("#modalRoot").innerHTML = "";
    persist();
  });
}


function readImageAsDataURL(file, maxSize = 160) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type.startsWith("image/")) return reject(new Error("กรุณาเลือกไฟล์รูปภาพ"));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("อ่านรูปภาพไม่สำเร็จ"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function customerContactValues(customer = {}) {
  const contacts = customer.contacts && typeof customer.contacts === "object" ? customer.contacts : {};
  return {
    line: String(contacts.line || ""),
    facebook: String(contacts.facebook || ""),
    tiktok: String(contacts.tiktok || ""),
    instagram: String(contacts.instagram || "")
  };
}

// Builds a tappable URL for a stored contact value.
// If the person already saved a full link, use it as-is.
// LINE is usually just an ID, so build the standard line.me add-friend link.
// Facebook/TikTok/Instagram without "http" are just usernames we can't safely
// turn into a working link, so those stay as plain text.
function contactHref(key, value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (key === "line") return `https://line.me/ti/p/~${encodeURIComponent(v)}`;
  return null;
}

function customerContactFields(customer = {}) {
  const c = customerContactValues(customer);
  const rows = [
    ["line", "LINE", "ID / ชื่อบัญชี", "💚"],
    ["facebook", "Facebook", "ชื่อโปรไฟล์ / ลิงก์", "🔵"],
    ["tiktok", "TikTok", "ชื่อบัญชี / ลิงก์", "⚫"],
    ["instagram", "Instagram", "ชื่อบัญชี / ลิงก์", "🟣"]
  ];
  return `<div class="contact-options">
    ${rows.map(([key,label,placeholder,icon]) => `
      <label class="contact-option">
        <span class="contact-option-head"><input type="checkbox" name="contact_${key}" value="1" ${c[key] ? "checked" : ""}> ${icon} ${label}</span>
        <input name="contact_${key}_value" placeholder="${placeholder}" value="${esc(c[key])}">
      </label>`).join("")}
  </div>`;
}

function collectCustomerContacts(form) {
  const out = {};
  ["line","facebook","tiktok","instagram"].forEach(key => {
    const enabled = form.querySelector(`[name="contact_${key}"]`)?.checked;
    const value = String(form.querySelector(`[name="contact_${key}_value"]`)?.value || "").trim();
    if (enabled && value) out[key] = value;
  });
  return out;
}

function openCustomerForm(prefill = {}) {
  $("#modalRoot").innerHTML = `<div class="overlay">
    <form class="modal small" id="customerForm">
      <div class="modal-head">
        <div><div class="eyebrow">NEW CUSTOMER</div><h2>เพิ่มลูกค้า</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="customer-photo-editor">
        <div class="customer-photo-preview" id="newCustomerPhotoPreview">
          ${prefill.photo ? `<img src="${esc(prefill.photo)}" alt="">` : `<span>${esc((prefill.name || "?").charAt(0))}</span>`}
        </div>
        <label class="mini-upload">เพิ่มรูปลูกค้า
          <input id="newCustomerPhoto" name="photoFile" type="file" accept="image/*">
        </label>
      </div>

      <label>ชื่อลูกค้า
        <input name="name" required placeholder="ชื่อ-นามสกุล" value="${esc(prefill.name || "")}">
      </label>

      <label>เบอร์โทร
        <input name="phone" inputmode="tel" placeholder="08xxxxxxxx" value="${esc(prefill.phone || "")}">
      </label>

      <div class="form-group-label">ช่องทางติดต่อ <small>เลือกได้มากกว่า 1 ช่องทาง</small></div>
      ${customerContactFields(prefill)}

      <label>ที่อยู่
        <textarea name="address" rows="3" placeholder="ที่อยู่สำหรับติดต่อ">${esc(prefill.address || "")}</textarea>
      </label>

      <label>หมายเหตุ
        <textarea name="note" rows="3" placeholder="ข้อมูลเพิ่มเติม">${esc(prefill.note || "")}</textarea>
      </label>

      <button class="primary-btn" type="submit">บันทึกลูกค้า</button>
    </form>
  </div>`;

  const form = $("#customerForm");
  let photo = String(prefill.photo || "");
  form.querySelector("#newCustomerPhoto")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      photo = await readImageAsDataURL(file);
      $("#newCustomerPhotoPreview").innerHTML = `<img src="${esc(photo)}" alt="รูปลูกค้า">`;
    } catch (error) {
      alert(error.message || "ไม่สามารถใช้รูปนี้ได้");
      event.target.value = "";
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return;

    data.customers.push({
      id: uid(),
      name,
      phone: String(f.get("phone") || "").trim(),
      contacts: collectCustomerContacts(form),
      address: String(f.get("address") || "").trim(),
      note: String(f.get("note") || "").trim(),
      photo,
      createdAt: new Date().toISOString()
    });

    $("#modalRoot").innerHTML = "";
    persist();
  });
}

function recalculateContractPayments(contract) {
  const payments = Array.isArray(contract.payments) ? contract.payments : [];
  const principal = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
  contract.received = Math.min(
    Math.max(0, Number(contract.total || 0)),
    Math.round(principal * 100) / 100
  );
  contract.penaltyTotal = Math.round(
    payments.reduce((sum, p) => sum + Math.max(0, Number(p.penalty || 0)), 0) * 100
  ) / 100;
  contract.status = getStatus(contract);
  return contract;
}

function openPaymentEdit(contractId, paymentId) {
  const contract = data.contracts.find(c => c.id === contractId);
  if (!contract) return;
  const payment = (contract.payments || []).find(p => p.id === paymentId);
  if (!payment) return;
  const paymentIndex = (contract.payments || []).findIndex(p => p.id === paymentId);
  const paymentInstallmentNo = Number(payment.installmentNo || payment.installment || payment.no || 0) || (paymentIndex + 1);

  $("#modalRoot").innerHTML = `<div class="overlay">
    <form class="modal small" id="paymentEditForm">
      <div class="modal-head">
        <div><div class="eyebrow">EDIT PAYMENT</div><h2>แก้ไขประวัติการรับเงิน</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="payment-summary">
        <b>${esc(contract.product)}</b>
        <span>${esc(contract.customerName || "ไม่ระบุลูกค้า")}</span>
        <strong>ยอดสัญญา ${money(contract.total)}</strong>
      </div>

      <div class="payment-installment-badge">งวดที่ ${paymentInstallmentNo}</div>

      <label>เงินต้นที่รับ
        <input name="amount" type="number" min="0" step="0.01" value="${Number(payment.amount || 0)}" required>
      </label>

      <label>ค่าปรับ
        <input name="penalty" type="number" min="0" step="0.01" value="${Number(payment.penalty || 0)}">
      </label>

      <label>วันที่รับเงิน
        <input name="date" type="date" value="${esc(payment.date || localToday())}" required>
      </label>

      <label>หมายเหตุ
        <input name="note" type="text" maxlength="200" value="${esc(payment.note || "")}">
      </label>

      <button class="primary-btn" type="submit">บันทึกการแก้ไข</button>
    </form>
  </div>`;

  $("#paymentEditForm").addEventListener("submit", event => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const otherPrincipal = (contract.payments || [])
      .filter(p => p.id !== payment.id)
      .reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
    const amount = Math.max(0, Number(f.get("amount") || 0));
    if (otherPrincipal + amount > Number(contract.total || 0) + 0.005) {
      alert(`เงินต้นรวมจะเกินยอดสัญญา ${money(contract.total)}`);
      return;
    }

    payment.amount = Math.round(amount * 100) / 100;
    payment.penalty = Math.round(Math.max(0, Number(f.get("penalty") || 0)) * 100) / 100;
    payment.date = String(f.get("date") || localToday());
    payment.note = String(f.get("note") || "").trim();

    recalculateContractPayments(contract);
    $("#modalRoot").innerHTML = "";
    persist();
    openContractDetail(contract.id);
  });
}

function openPayment(id) {
  const contract = data.contracts.find(c => c.id === id);
  if (!contract || getStatus(contract) === "paid") return;

  $("#modalRoot").innerHTML = `<div class="overlay">
    <form class="modal small" id="payForm">
      <div class="modal-head">
        <div><div class="eyebrow">PAYMENT</div><h2>รับชำระเงิน</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="payment-summary">
        <b>${esc(contract.product)}</b>
        <span>${esc(contract.customerName || "ไม่ระบุลูกค้า")}</span>
        <strong>คงเหลือ ${money(remaining(contract))}</strong>
      </div>

      <label>จำนวนเงิน
        <input name="amount" type="number" min="0.01" max="${remaining(contract)}" step="0.01" value="${remaining(contract)}" required>
      </label>

      <label>วันที่รับเงิน
        <input name="date" type="date" value="${localToday()}">
      </label>

      <button class="primary-btn">บันทึกรับชำระ</button>
    </form>
  </div>`;

  $("#payForm").addEventListener("submit", event => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const amount = Math.min(remaining(contract), Number(f.get("amount") || 0));
    if (amount <= 0) return;

    contract.received += amount;
    contract.payments = Array.isArray(contract.payments) ? contract.payments : [];
    const nextInstallment = getInstallmentSchedule(contract).find(item => item.status !== "paid");
    contract.payments.push({
      id: uid(),
      amount,
      date: String(f.get("date") || localToday()),
      installmentNo: nextInstallment?.number || null
    });
    contract.status = getStatus(contract);

    $("#modalRoot").innerHTML = "";
    persist();
  });
}

function openCustomer(id) {
  const customer = customerById(id);
  if (!customer) return;

  const contracts = data.contracts.filter(c => c.customerId === id);
  const outstanding = contracts
    .filter(c => getStatus(c) === "active")
    .reduce((sum, c) => sum + remaining(c), 0);
  const contacts = customerContactValues(customer);
  const contactEntries = [
    ["LINE", contacts.line, "line"], ["Facebook", contacts.facebook, "facebook"],
    ["TikTok", contacts.tiktok, "tiktok"], ["Instagram", contacts.instagram, "instagram"]
  ].filter(([,value]) => value);

  $("#modalRoot").innerHTML = `<div class="overlay">
    <div class="modal small">
      <div class="modal-head">
        <div class="customer-detail-heading">
          <div class="avatar customer-avatar large">${customer.photo ? `<img src="${esc(customer.photo)}" alt="">` : `<span>${esc((customer.name || "?").charAt(0))}</span>`}</div>
          <div><div class="eyebrow">CUSTOMER</div><h2>${esc(customer.name)}</h2></div>
        </div>
        <div class="modal-head-actions">
          <button type="button" class="mini-btn ghost-mini" data-edit-customer="${customer.id}">แก้ไข</button>
          <button class="icon-btn" data-close>×</button>
        </div>
      </div>

      <div class="customer-detail">
        <div><span>โทร</span>${customer.phone ? `<a href="tel:${esc(customer.phone)}">${esc(customer.phone)}</a>` : `<b>-</b>`}</div>
        <div><span>สัญญา</span><b>${contracts.length}</b></div>
        <div><span>ค้างรับ</span><b>${money(outstanding)}</b></div>
      </div>

      ${contactEntries.length ? `<div class="customer-contacts"><b>ช่องทางติดต่อ</b>${contactEntries.map(([label,value,key]) => {
        const href = contactHref(key, value);
        return `<div><span>${label}</span>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>` : `<b>${esc(value)}</b>`}</div>`;
      }).join("")}</div>` : ""}
      ${customer.address ? `<div class="note-box"><b>ที่อยู่</b><br>${esc(customer.address)}</div>` : ""}
      ${customer.note ? `<div class="note-box"><b>หมายเหตุ</b><br>${esc(customer.note)}</div>` : ""}

      <div class="modal-actions">
        <button type="button" class="wide-btn action-delete danger" data-delete-customer="${customer.id}">ลบลูกค้านี้</button>
      </div>

      <div class="modal-section-title">สัญญาของลูกค้า</div>
      ${contracts.length ? contracts.map(contractCard).join("") : emptyState("＋", "ยังไม่มีสัญญา", "สร้างสัญญาใหม่ได้จากปุ่ม +")}
    </div>
  </div>`;
}

function deleteCustomer(id) {
  const customer = customerById(id);
  if (!customer) return;

  const linkedContracts = data.contracts.filter(c => c.customerId === id);

  const confirmed = confirm(
    `ลบลูกค้า "${customer.name}" ใช่หรือไม่?\\n\\n` +
    `สัญญาที่ผูกอยู่ ${linkedContracts.length} รายการจะไม่ถูกลบ ` +
    `และจะยังคงเก็บประวัติสัญญาไว้`
  );

  if (!confirmed) return;

  // Keep contracts/history safe; only remove the customer record.
  data.customers = data.customers.filter(c => c.id !== id);

  $("#modalRoot").innerHTML = "";
  persist();
}

function openCustomerEdit(id) {
  const customer = customerById(id);
  if (!customer) return;

  $("#modalRoot").innerHTML = `<div class="overlay">
    <form class="modal small" id="customerEditForm">
      <div class="modal-head">
        <div><div class="eyebrow">EDIT CUSTOMER</div><h2>แก้ไขลูกค้า</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="form-note">
        <b>ข้อมูลลูกค้า</b>
        <span>การแก้ไขชื่อหรือเบอร์โทรจะอัปเดตไปยังสัญญาที่ผูกกับลูกค้าคนนี้ด้วย</span>
      </div>

      <div class="customer-photo-editor">
        <div class="customer-photo-preview" id="editCustomerPhotoPreview">
          ${customer.photo ? `<img src="${esc(customer.photo)}" alt="">` : `<span>${esc((customer.name || "?").charAt(0))}</span>`}
        </div>
        <label class="mini-upload">เปลี่ยนรูปลูกค้า
          <input id="editCustomerPhoto" type="file" accept="image/*">
        </label>
        ${customer.photo ? `<button type="button" class="mini-btn ghost-mini" id="removeCustomerPhoto">ลบรูป</button>` : ""}
      </div>

      <label>ชื่อลูกค้า
        <input name="name" required placeholder="ชื่อ-นามสกุล" value="${esc(customer.name || "")}">
      </label>

      <label>เบอร์โทร
        <input name="phone" inputmode="tel" placeholder="08xxxxxxxx" value="${esc(customer.phone || "")}">
      </label>

      <div class="form-group-label">ช่องทางติดต่อ <small>เลือกได้มากกว่า 1 ช่องทาง</small></div>
      ${customerContactFields(customer)}

      <label>ที่อยู่
        <textarea name="address" rows="3" placeholder="ที่อยู่สำหรับติดต่อ">${esc(customer.address || "")}</textarea>
      </label>

      <label>หมายเหตุ
        <textarea name="note" rows="3" placeholder="ข้อมูลเพิ่มเติม">${esc(customer.note || "")}</textarea>
      </label>

      <button class="primary-btn" type="submit">บันทึกการแก้ไข</button>
    </form>
  </div>`;

  const form = $("#customerEditForm");
  let photo = String(customer.photo || "");
  form.querySelector("#editCustomerPhoto")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      photo = await readImageAsDataURL(file);
      $("#editCustomerPhotoPreview").innerHTML = `<img src="${esc(photo)}" alt="รูปลูกค้า">`;
    } catch (error) {
      alert(error.message || "ไม่สามารถใช้รูปนี้ได้");
      event.target.value = "";
    }
  });

  form.querySelector("#removeCustomerPhoto")?.addEventListener("click", () => {
    photo = "";
    $("#editCustomerPhotoPreview").innerHTML = `<span>${esc((customer.name || "?").charAt(0))}</span>`;
    form.querySelector("#removeCustomerPhoto")?.remove();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") || "").trim();
    const phone = String(f.get("phone") || "").trim();
    const address = String(f.get("address") || "").trim();
    const note = String(f.get("note") || "").trim();
    if (!name) return;

    customer.name = name;
    customer.phone = phone;
    customer.contacts = collectCustomerContacts(form);
    customer.address = address;
    customer.note = note;
    customer.photo = photo;

    data.contracts
      .filter(contract => contract.customerId === customer.id)
      .forEach(contract => {
        contract.customerName = name;
        contract.phone = phone;
      });

    $("#modalRoot").innerHTML = "";
    persist();
  });
}

function openContractDetail(id) {
  const contract = data.contracts.find(c => c.id === id);
  if (!contract) return;

  const customer = customerById(contract.customerId);
  const payments = [...(contract.payments || [])].sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const schedule = getInstallmentSchedule(contract);
  const nextInstallment = schedule.find(item => item.status !== "paid");
  const paidCount = schedule.filter(item => item.status === "paid").length;
  const partialItem = schedule.find(item => item.status === "partial");

  const scheduleRows = schedule.map(item => {
    const statusText = installmentStatusLabel(item);
    const dateText = fmtDate(item.dueDate);
    const amountText = money(item.amount);
    const statusClassName = `installment-${item.status}`;

    return `<div class="installment-row ${statusClassName}">
      <div class="installment-main">
        <b>งวด ${item.number}/${schedule.length}</b>
        <span>${dateText}</span>
        ${item.status === "partial" ? `<small>รับแล้ว ${money(item.paidAmount)} · เหลือ ${money(item.remainingAmount)}</small>` : ""}
      </div>
      <div class="installment-side">
        <strong>${amountText}</strong>
        <span>${statusText}</span>
      </div>
    </div>`;
  }).join("");

  const nextLabel = getStatus(contract) === "paid"
    ? "ชำระครบ"
    : `งวด ${nextInstallment?.number || "-"} · ${fmtDate(nextInstallment?.dueDate || contract.dueDate)}`;

  const progressPercent = contract.total > 0
    ? Math.min(100, (Number(contract.received || 0) / Number(contract.total || 0)) * 100)
    : 0;

  const scheduleSummary = getStatus(contract) === "paid"
    ? `ชำระครบ ${schedule.length}/${schedule.length} งวด`
    : `${paidCount}/${schedule.length} งวด · ${partialItem ? `งวด ${partialItem.number} ชำระบางส่วน` : `งวดถัดไป ${nextInstallment?.number || "-"}`}`;

  const scheduleBlock = `<section class="installment-section">
    <div class="modal-section-title">งวดที่ต้องชำระ</div>
    <div class="installment-summary">
      <div>
        <span>ความคืบหน้า</span>
        <b>${scheduleSummary}</b>
      </div>
      <strong>${Math.round(progressPercent)}%</strong>
    </div>
    <div class="installment-progress"><i style="width:${progressPercent}%"></i></div>
    <div class="installment-list">${scheduleRows}</div>
  </section>`;

  const historyBlock = `<section class="payment-history-section">
    <div class="modal-section-title">ประวัติการรับชำระ</div>
    ${Number(contract.penaltyTotal || 0) > 0 ? `<div class="subtle-box">ค่าปรับสะสม ${money(contract.penaltyTotal)}</div>` : ""}
    ${payments.length
      ? `<div class="payment-list">${payments.map((p, index) => {
          const installmentNo = Number(p.installmentNo || p.installment || p.no || 0) || (payments.length - index);
          return `<div class="payment-row">
            <div>
              <span>งวด ${installmentNo} · ${fmtDate(p.date)}</span>
              <b>+ ${money(p.amount)}</b>
              ${Number(p.penalty || 0) > 0 ? `<small class="payment-penalty">ค่าปรับ +${money(p.penalty)}</small>` : ""}
              ${p.note ? `<small>${esc(p.note)}</small>` : ""}
            </div>
            <div class="payment-row-actions">
              <button type="button" class="mini-btn ghost-mini" data-edit-payment="${contract.id}" data-payment="${p.id}">แก้ไข</button>
              <button type="button" class="mini-btn ghost-mini" data-receipt="${contract.id}" data-payment="${p.id}">ใบเสร็จ</button>
            </div>
          </div>`;
        }).join("")}</div>`
      : `<div class="subtle-box">ยังไม่มีประวัติการรับชำระ</div>`}`;

  $("#modalRoot").innerHTML = `<div class="overlay">
    <div class="modal small contract-detail-modal">
      <div class="modal-head contract-detail-head">
        <div class="contract-detail-title">
          ${productThumb(contract.product, contract.imageData, "large")}
          <div><div class="eyebrow">CONTRACT</div><h2>${esc(contract.product)}</h2></div>
        </div>
        <div class="modal-head-actions">
          <button type="button" class="mini-btn ghost-mini" data-edit="${contract.id}">แก้ไข</button>
          <button class="icon-btn" data-close>×</button>
        </div>
      </div>

      <div class="detail-status">
        <span class="pill ${getStatus(contract) === "paid" ? "paid" : "active"}">${statusLabel(contract)}</span>
        <strong>${money(contract.total)}</strong>
      </div>

      <div class="detail-grid">
        <div><span>ลูกค้า</span><b>${esc(contract.customerName || customer?.name || "-")}</b></div>
        <div><span>เบอร์โทร</span>${(contract.phone || customer?.phone) ? `<a href="tel:${esc(contract.phone || customer?.phone)}">${esc(contract.phone || customer?.phone)}</a>` : `<b>-</b>`}</div>
        <div><span>รับแล้ว</span><b>${money(contract.received)}</b></div>
        <div><span>คงเหลือ</span><b>${money(remaining(contract))}</b></div>
        <div><span>จำนวนงวด</span><b>${contract.installments} งวด</b></div>
        <div><span>รูปแบบ</span><b>${paymentTypeLabel(contract.paymentType)}</b></div>
        <div><span>งวดถัดไป</span><b>${nextLabel}</b></div>
      </div>

      ${scheduleBlock}
      ${historyBlock}

      ${getStatus(contract) === "active"
        ? `<button class="primary-btn" data-pay="${contract.id}">รับชำระเงิน</button>`
        : ""}
      <button type="button" class="wide-btn action-delete danger" data-delete-contract="${contract.id}">ลบสัญญานี้</button>
    </div>
  </div>`;
}

function deleteContract(id) {
  const contract = data.contracts.find(c => c.id === id);
  if (!contract) return;

  const confirmed = confirm(
    `ลบสัญญา "${contract.product}" ใช่หรือไม่?\n\n` +
    `ยอดรวม ${money(contract.total)}\n` +
    `รับแล้ว ${money(contract.received)}\n\n` +
    `การลบจะลบสัญญาและประวัติการรับชำระของสัญญานี้ออกจากเครื่องถาวร`
  );

  if (!confirmed) return;

  data.contracts = data.contracts.filter(c => c.id !== id);

  $("#modalRoot").innerHTML = "";
  persist();
}

function openReceipt(contractId, paymentId) {
  const contract = data.contracts.find(c => c.id === contractId);
  if (!contract) return;

  const payment = (contract.payments || []).find(p => p.id === paymentId);
  if (!payment) return;

  const customer = customerById(contract.customerId);
  const payments = Array.isArray(contract.payments) ? contract.payments : [];
  const paymentIndex = payments.findIndex(p => p.id === payment.id);
  const paidBefore = payments
    .slice(0, paymentIndex)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const receivedAfter = Math.min(Number(contract.total || 0), paidBefore + Number(payment.amount || 0));
  const balanceAfter = Math.max(0, Number(contract.total || 0) - receivedAfter);

  const receiptNo = `RC-${String(payment.id).slice(-8).toUpperCase()}`;

  $("#modalRoot").innerHTML = `<div class="overlay receipt-overlay">
    <div class="modal small receipt-modal">
      <div class="modal-head">
        <div><div class="eyebrow">PAYPREMINIQ RECEIPT</div><h2>ใบเสร็จรับเงิน</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="receipt-paper" id="receiptPaper">
        <div class="receipt-brand">PAYPREMINIQ</div>
        <div class="receipt-title">ใบเสร็จรับเงิน</div>
        <div class="receipt-meta"><span>เลขที่</span><b>${esc(receiptNo)}</b></div>
        <div class="receipt-meta"><span>วันที่รับเงิน</span><b>${esc(fmtDate(payment.date))}</b></div>

        <div class="receipt-divider"></div>
        <div class="receipt-row"><span>ลูกค้า</span><b>${esc(contract.customerName || customer?.name || "ไม่ระบุลูกค้า")}</b></div>
        <div class="receipt-row"><span>เบอร์โทร</span><b>${esc(contract.phone || customer?.phone || "-")}</b></div>
        <div class="receipt-row"><span>สินค้า / รายการ</span><b>${esc(contract.product)}</b></div>
        <div class="receipt-row"><span>จำนวนงวด</span><b>${esc(contract.installments)} งวด</b></div>

        <div class="receipt-divider"></div>
        <div class="receipt-total"><span>รับชำระครั้งนี้</span><strong>${money(payment.amount)}</strong></div>
        <div class="receipt-row"><span>รับแล้วสะสม</span><b>${money(receivedAfter)}</b></div>
        <div class="receipt-row"><span>คงเหลือหลังรับเงิน</span><b>${money(balanceAfter)}</b></div>

        <div class="receipt-thanks">ขอบคุณที่ใช้บริการ PAYPREMINIQ</div>
      </div>

      <button type="button" class="primary-btn" id="printReceipt">พิมพ์ / บันทึกเป็น PDF</button>
    </div>
  </div>`;

  $("#printReceipt").addEventListener("click", () => {
    const paper = $("#receiptPaper");
    if (!paper) return;
    const printWindow = window.open("", "_blank", "width=480,height=720");
    if (!printWindow) {
      alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up แล้วลองใหม่");
      return;
    }
    printWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(receiptNo)}</title><style>
      *{box-sizing:border-box} body{margin:0;background:#fff;color:#111;font-family:Arial,'Noto Sans Thai',sans-serif;padding:24px}.receipt-paper{max-width:420px;margin:auto;border:1px solid #ddd;border-radius:18px;padding:24px}.receipt-brand{text-align:center;font-weight:900;letter-spacing:2px;font-size:20px}.receipt-title{text-align:center;font-size:22px;font-weight:900;margin:8px 0 20px}.receipt-meta,.receipt-row,.receipt-total{display:flex;justify-content:space-between;gap:18px;margin:9px 0;font-size:13px}.receipt-meta span,.receipt-row span{color:#666}.receipt-divider{border-top:1px dashed #bbb;margin:18px 0}.receipt-total{align-items:center;font-size:15px}.receipt-total strong{font-size:22px}.receipt-thanks{text-align:center;color:#777;font-size:12px;margin-top:24px}@media print{body{padding:0}.receipt-paper{border:0}}
    </style></head><body>${paper.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 150);
  });
}

function exportJson(reason = "manual") {
  const payload = {
    app: "PAYPREMINIQ",
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    reason,
    data: JSON.parse(exportData(data))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `paypreminiq-backup-${localToday()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

document.addEventListener("click", event => {
  const pageBtn = event.target.closest("[data-page]");
  if (pageBtn) {
    page = pageBtn.dataset.page;
    render();
    scrollTo({top: 0, behavior: "smooth"});
    return;
  }

  const filter = event.target.closest("[data-contract-filter]");
  if (filter) {
    contractFilter = filter.dataset.contractFilter;
    render();
    return;
  }

  const editPayment = event.target.closest("[data-edit-payment]");
  if (editPayment) {
    openPaymentEdit(editPayment.dataset.editPayment, editPayment.dataset.payment);
    return;
  }

  const receipt = event.target.closest("[data-receipt]");
  if (receipt) {
    openReceipt(receipt.dataset.receipt, receipt.dataset.payment);
    return;
  }

  const pay = event.target.closest("[data-pay]");
  if (pay) {
    openPayment(pay.dataset.pay);
    return;
  }

  const edit = event.target.closest("[data-edit]");
  if (edit) {
    const contract = data.contracts.find(c => c.id === edit.dataset.edit);
    $("#modalRoot").innerHTML = "";
    if (contract) openContractModal(contract, contract.id);
    return;
  }

  const detail = event.target.closest("[data-detail]");
  if (detail) {
    openContractDetail(detail.dataset.detail);
    return;
  }

  const deleteContractButton = event.target.closest("[data-delete-contract]");
  if (deleteContractButton) {
    deleteContract(deleteContractButton.dataset.deleteContract);
    return;
  }

  const deleteCustomerButton = event.target.closest("[data-delete-customer]");
  if (deleteCustomerButton) {
    deleteCustomer(deleteCustomerButton.dataset.deleteCustomer);
    return;
  }

  const editCustomer = event.target.closest("[data-edit-customer]");
  if (editCustomer) {
    openCustomerEdit(editCustomer.dataset.editCustomer);
    return;
  }

  const cust = event.target.closest("[data-customer]");
  if (cust) {
    openCustomer(cust.dataset.customer);
    return;
  }

  if (event.target.closest("[data-clear-contract-search]")) {
    contractQuery = "";
    render();
    return;
  }

  if (event.target.closest("[data-clear-customer-search]")) {
    customerQuery = "";
    render();
    return;
  }

  if (event.target.closest("#fab")) {
    if (page === "customers") openCustomerForm();
    else openContractModal();
    return;
  }

  if (event.target.closest("[data-close]")) {
    $("#modalRoot").innerHTML = "";
    return;
  }

  if (event.target.id === "export") {
    exportJson();
    return;
  }

  if (event.target.id === "import") {
    $("#importFile").click();
    return;
  }

  if (event.target.id === "reset") {
    if (confirm("ล้างข้อมูล PAYPREMINIQ ทั้งหมดใช่หรือไม่? ระบบจะดาวน์โหลดไฟล์สำรองก่อนล้างข้อมูล")) {
      exportJson("before-reset");
      data = resetData();
      // Keep Firestore consistent with the explicit local reset.
      if (currentUser()) {
        setCloudData(data).catch(error =>
          console.warn("PAYPREMINIQ cloud reset sync skipped:", error)
        );
      }
      contractFilter = "active";
      contractQuery = "";
      customerQuery = "";
      render();
      alert("สำรองข้อมูลเดิมแล้ว และล้างข้อมูลเรียบร้อย");
    }
  }
});


document.addEventListener("input", event => {
  if (event.target.id === "contractSearch") {
    contractQuery = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const input = $("#contractSearch");
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  }

  if (event.target.id === "customerSearch") {
    customerQuery = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const input = $("#customerSearch");
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  }
});

$("#importFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // New backup envelope stores the actual PAYPREMINIQ data under .data.
    // Older PAYPREMINIQ backups stored the data directly, so keep both formats compatible.
    const payload = (parsed?.app === "PAYPREMINIQ" || parsed?.app === "PayNest") && parsed?.data ? parsed.data : parsed;

    // Safety: save the current data before replacing it.
    exportJson("before-restore");

    data = importData(JSON.stringify(payload));
    contractFilter = "active";
    contractQuery = "";
    customerQuery = "";
    alert("กู้คืนข้อมูลสำเร็จ\nระบบสร้างไฟล์สำรองของข้อมูลเดิมไว้ให้แล้ว");
    render();
  } catch (error) {
    console.error(error);
    alert("ไฟล์ JSON ไม่ถูกต้อง หรือโครงสร้างข้อมูลไม่รองรับ");
  } finally {
    event.target.value = "";
  }
});

$("#topAction").addEventListener("click", () =>
  scrollTo({top: 0, behavior: "smooth"})
);


$("#cloudAccount")?.addEventListener("click", async () => {
  if (auth.currentUser) {
    if (confirm(`ออกจากระบบ ${auth.currentUser.email} ใช่หรือไม่?`)) {
      await signOut(auth);
      renderAuthButton();
    }
  } else {
    openAuthModal();
  }
});

render();

// Firebase must never block the initial UI. Load it only after the local app
// has rendered, then hydrate/sync cloud data in the background.
firebaseAuthPromise = initializeFirebaseInBackground().catch(() => false);



/* ===================================
   PAYPREMINIQ Core Revision
   Single source of truth for:
   Customer / Contract / Installment / Payment
=================================== */

const PayNestCore = (() => {
    const DAY = 24 * 60 * 60 * 1000;

    const num = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    };

    const dateOnly = (value) => {
        const d = value instanceof Date ? new Date(value) : new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const isoDate = (value) => {
        const d = dateOnly(value);
        if (!d) return "";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const addDays = (value, days) => {
        const d = dateOnly(value);
        if (!d) return null;
        d.setDate(d.getDate() + num(days));
        return d;
    };

    const addMonths = (value, months) => {
        const d = dateOnly(value);
        if (!d) return null;
        const originalDay = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + num(months));
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(originalDay, last));
        return d;
    };

    const frequencyDays = (frequency) => {
        const f = String(frequency || "").toLowerCase();
        if (f.includes("day") || f.includes("วัน")) return 1;
        if (f.includes("week") || f.includes("สัปดาห์")) return 7;
        if (f.includes("2") && (f.includes("week") || f.includes("สัปดาห์"))) return 14;
        return null;
    };

    const installmentDate = (start, index, frequency) => {
        const i = Math.max(0, num(index));
        const days = frequencyDays(frequency);
        if (days) return addDays(start, i * days);
        return addMonths(start, i);
    };

    const buildInstallments = (contract) => {
        const total = Math.max(0, Math.round(num(contract.months)));
        const monthly = num(contract.monthly);
        const start = contract.startDate || contract.start || contract.due;
        const frequency = contract.frequency || contract.type || "monthly";
        const items = [];

        for (let i = 0; i < total; i++) {
            const due = installmentDate(start, i, frequency);
            items.push({
                no: i + 1,
                dueDate: isoDate(due),
                amount: monthly,
                paid: 0,
                penalty: 0,
                remaining: monthly,
                status: "pending"
            });
        }
        return items;
    };

    const classify = (installment, today = new Date()) => {
        const due = dateOnly(installment.dueDate);
        const now = dateOnly(today);
        const paid = num(installment.paid);
        const amount = num(installment.amount);
        const remaining = Math.max(0, amount - paid);

        if (remaining <= 0) return "paid";
        if (!due) return paid > 0 ? "partial" : "pending";

        const diff = Math.round((due - now) / DAY);
        if (diff < 0) return paid > 0 ? "overdue_partial" : "overdue";
        if (paid > 0) return "partial";
        if (diff <= 3) return "due_soon";
        return "pending";
    };

    const summarizePayments = (payments = []) => {
        const map = new Map();
        for (const payment of payments) {
            const no = num(payment.installmentNo || payment.installment || payment.no);
            if (!no) continue;
            const current = map.get(no) || { paid: 0, penalty: 0 };
            current.paid += num(payment.amount || payment.paid);
            current.penalty += num(payment.penalty);
            map.set(no, current);
        }
        return map;
    };

    const calculate = (contract, payments = [], today = new Date()) => {
        const installments = buildInstallments(contract);
        const paymentMap = summarizePayments(payments);

        // Apply payment history to its exact installment.
        for (const item of installments) {
            const p = paymentMap.get(item.no) || { paid: 0, penalty: 0 };
            item.paid = Math.min(item.amount, p.paid);
            item.penalty = p.penalty;
            item.remaining = Math.max(0, item.amount - item.paid);
            item.status = classify(item, today);
        }

        const paidPrincipal = installments.reduce((s, x) => s + x.paid, 0);
        const penalties = installments.reduce((s, x) => s + x.penalty, 0);
        const total = installments.reduce((s, x) => s + x.amount, 0);
        const outstanding = Math.max(0, total - paidPrincipal);

        const next = installments.find(x => x.remaining > 0) || null;
        const overdue = installments.filter(x => x.status === "overdue" || x.status === "overdue_partial");
        const dueSoon = installments.filter(x => x.status === "due_soon");

        const todayKey = isoDate(today);
        const dueToday = installments.filter(x => x.dueDate === todayKey && x.remaining > 0);

        return {
            installments,
            total,
            paidPrincipal,
            penalties,
            outstanding,
            nextInstallment: next,
            overdue,
            dueSoon,
            dueToday,
            isComplete: outstanding <= 0
        };
    };

    const validatePayment = (installment, amount) => {
        const value = num(amount);
        const remaining = Math.max(0, num(installment.amount) - num(installment.paid));
        return {
            valid: value > 0 && remaining > 0,
            amount: value,
            remaining,
            exceeds: value > remaining
        };
    };

    return Object.freeze({
        buildInstallments,
        calculate,
        classify,
        validatePayment,
        isoDate
    });
})();

/* Backward-compatible global access for existing UI code. */
window.PayNestCore = PayNestCore;

})();

/* =========================================================
   PAYPREMINIQ — iOS CHROME SCROLL BEHAVIOR
   UI interaction only: topbar + FAB + bottom navigation
========================================================= */
(() => {
  let lastScrollY = Math.max(0, window.scrollY || 0);
  let ticking = false;
  let hidden = false;

  const chrome = () => ({
    topbar: document.querySelector('.topbar'),
    fab: document.querySelector('.fab'),
    bottom: document.querySelector('.bottom-nav')
  });

  const setChrome = nextHidden => {
    const {topbar, fab, bottom} = chrome();
    [topbar, fab, bottom].forEach(el => el?.classList.toggle('chrome-hidden', nextHidden));
    hidden = nextHidden;
  };

  const updateChrome = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY || 0);
    const delta = y - lastScrollY;

    if (y <= 8) {
      setChrome(false);
    } else if (delta > 8 && y > 70) {
      setChrome(true);
    } else if (delta < -8) {
      setChrome(false);
    }

    lastScrollY = y;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateChrome);
    }
  }, {passive:true});

  window.addEventListener('resize', () => setChrome(hidden), {passive:true});
  window.addEventListener('pageshow', () => {
    lastScrollY = Math.max(0, window.scrollY || 0);
    setChrome(false);
  });
})();
