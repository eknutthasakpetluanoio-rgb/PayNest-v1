import {loadData, saveData, saveLocalData, resetData, exportData, importData} from "./storage.js";
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "./firebase.js";
import {syncInitialData, startRealtimeSync, stopRealtimeSync} from "./firestore-sync.js";

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

function persist() {
  data = saveData(data);
  render();
}

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
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
      <div class="modal small auth-modal" role="dialog" aria-modal="true" aria-label="บัญชี PayNest">
        <div class="modal-head">
          <div>
            <div class="eyebrow">PAYNEST CLOUD</div>
            <h2>บัญชีของคุณ</h2>
          </div>
          <button class="icon-btn" data-close type="button" aria-label="ปิด">×</button>
        </div>

        <div class="form-note">
          <b>ซิงก์ข้อมูลกับ Firebase Cloud</b>
          <span>เข้าสู่ระบบเพื่อเก็บข้อมูล PayNest ไว้บนบัญชีของคุณ และใช้งานข้อมูลเดิมจากเครื่องอื่นได้</span>
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

        <p id="authStatus" class="muted auth-status" role="status" aria-live="polite"></p>
      </div>
    </div>`;

  const status = $("#authStatus");
  const email = $("#authEmail");
  const password = $("#authPassword");

  async function runAuth(action) {
    const emailValue = email.value.trim();
    const passwordValue = password.value;
    if (!emailValue || !passwordValue) {
      status.textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
      return;
    }
    status.textContent = "กำลังเชื่อมต่อ...";
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
}

function renderAuthButton() {
  const button = $("#cloudAccount");
  if (!button) return;
  const user = auth.currentUser;
  button.textContent = user ? "☁" : "☁";
  button.title = user ? `Cloud: ${user.email} — กดเพื่อออกจากระบบ` : "เข้าสู่ระบบ PayNest Cloud";
  button.setAttribute("aria-label", button.title);
}

async function bootstrapCloud() {
  try {
    // Existing Cloud data is authoritative. Only a brand-new Cloud account
    // is bootstrapped from this device's LocalStorage.
    const cloudData = await syncInitialData(data);
    data = saveLocalData(cloudData);
    render();

    startRealtimeSync(cloudData => {
      // Never call saveData() here: that would write the incoming Cloud
      // snapshot back to Cloud and can create a sync loop.
      data = saveLocalData(cloudData);
      render();
    });
  } catch (error) {
    stopRealtimeSync();
    console.warn("PayNest initial cloud sync skipped:", error);
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
        <small>งวดถัดไป ${fmtDate(c.dueDate)}</small>
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
      <div>
        <h3>${esc(c.product)}</h3>
        <span>${esc(c.customerName || "ไม่ระบุลูกค้า")}</span>
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
          ? "⚠ เกินกำหนด " + fmtDate(c.dueDate)
          : "งวดถัดไป " + fmtDate(c.dueDate))}</span>
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

  return `<article class="customer card">
    <div class="avatar">${esc((c.name || "?").charAt(0))}</div>
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
      <p>PayNest เก็บข้อมูลไว้ในเครื่องนี้ด้วย LocalStorage และใช้ฐานข้อมูลชุดเดียวกันทุกหน้า</p>
      <div class="data-summary">
        <div><b>${data.contracts.length}</b><span>สัญญา</span></div>
        <div><b>${data.customers.length}</b><span>ลูกค้า</span></div>
      </div>
      <div class="backup-note">
        <b>สำรองข้อมูลก่อนแก้ไขหรือเปลี่ยนเครื่อง</b>
        <span>ไฟล์ JSON นี้เก็บสัญญา ลูกค้า และประวัติการรับชำระของ PayNest</span>
      </div>
      <button class="wide-btn" id="export">⬇ สำรองข้อมูลลงเครื่อง</button>
      <button class="wide-btn" id="import">↥ กู้คืนข้อมูลจากไฟล์</button>
      <button class="wide-btn danger" id="reset">ล้างข้อมูลทั้งหมด</button>
    </div>

    <div class="card settings-card">
      <div class="eyebrow">APP</div>
      <h2>PayNest v1</h2>
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
        <input name="product" required placeholder="เช่น iPhone 16 Pro" value="${esc(source.product || "")}">
      </label>

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

  form.addEventListener("submit", event => {
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

function openCustomerForm(prefill = {}) {
  $("#modalRoot").innerHTML = `<div class="overlay">
    <form class="modal small" id="customerForm">
      <div class="modal-head">
        <div><div class="eyebrow">NEW CUSTOMER</div><h2>เพิ่มลูกค้า</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <label>ชื่อลูกค้า
        <input name="name" required placeholder="ชื่อ-นามสกุล" value="${esc(prefill.name || "")}">
      </label>

      <label>เบอร์โทร
        <input name="phone" inputmode="tel" placeholder="08xxxxxxxx" value="${esc(prefill.phone || "")}">
      </label>

      <label>หมายเหตุ
        <textarea name="note" rows="3" placeholder="ข้อมูลเพิ่มเติม">${esc(prefill.note || "")}</textarea>
      </label>

      <button class="primary-btn" type="submit">บันทึกลูกค้า</button>
    </form>
  </div>`;

  $("#customerForm").addEventListener("submit", event => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return;

    data.customers.push({
      id: uid(),
      name,
      phone: String(f.get("phone") || "").trim(),
      note: String(f.get("note") || "").trim(),
      createdAt: new Date().toISOString()
    });

    $("#modalRoot").innerHTML = "";
    persist();
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
    contract.payments.push({
      id: uid(),
      amount,
      date: String(f.get("date") || localToday())
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

  $("#modalRoot").innerHTML = `<div class="overlay">
    <div class="modal small">
      <div class="modal-head">
        <div><div class="eyebrow">CUSTOMER</div><h2>${esc(customer.name)}</h2></div>
        <div class="modal-head-actions">
          <button type="button" class="mini-btn ghost-mini" data-edit-customer="${customer.id}">แก้ไข</button>
          <button class="icon-btn" data-close>×</button>
        </div>
      </div>

      <div class="customer-detail">
        <div><span>โทร</span><b>${esc(customer.phone || "-")}</b></div>
        <div><span>สัญญา</span><b>${contracts.length}</b></div>
        <div><span>ค้างรับ</span><b>${money(outstanding)}</b></div>
      </div>

      ${customer.note ? `<div class="note-box">${esc(customer.note)}</div>` : ""}

      <div class="modal-section-title">สัญญาของลูกค้า</div>
      ${contracts.length ? contracts.map(contractCard).join("") : emptyState("＋", "ยังไม่มีสัญญา", "สร้างสัญญาใหม่ได้จากปุ่ม +")}
    </div>
  </div>`;
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

      <label>ชื่อลูกค้า
        <input name="name" required placeholder="ชื่อ-นามสกุล" value="${esc(customer.name || "")}">
      </label>

      <label>เบอร์โทร
        <input name="phone" inputmode="tel" placeholder="08xxxxxxxx" value="${esc(customer.phone || "")}">
      </label>

      <label>หมายเหตุ
        <textarea name="note" rows="3" placeholder="ข้อมูลเพิ่มเติม">${esc(customer.note || "")}</textarea>
      </label>

      <button class="primary-btn" type="submit">บันทึกการแก้ไข</button>
    </form>
  </div>`;

  $("#customerEditForm").addEventListener("submit", event => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") || "").trim();
    const phone = String(f.get("phone") || "").trim();
    const note = String(f.get("note") || "").trim();
    if (!name) return;

    customer.name = name;
    customer.phone = phone;
    customer.note = note;

    // Keep linked contract snapshots aligned with the customer record.
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

  $("#modalRoot").innerHTML = `<div class="overlay">
    <div class="modal small">
      <div class="modal-head">
        <div><div class="eyebrow">CONTRACT</div><h2>${esc(contract.product)}</h2></div>
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
        <div><span>เบอร์โทร</span><b>${esc(contract.phone || customer?.phone || "-")}</b></div>
        <div><span>รับแล้ว</span><b>${money(contract.received)}</b></div>
        <div><span>คงเหลือ</span><b>${money(remaining(contract))}</b></div>
        <div><span>จำนวนงวด</span><b>${contract.installments} งวด</b></div>
        <div><span>รูปแบบ</span><b>${paymentTypeLabel(contract.paymentType)}</b></div>
        <div><span>งวดถัดไป</span><b>${getStatus(contract) === "paid" ? "ชำระครบ" : fmtDate(contract.dueDate)}</b></div>
      </div>

      <div class="modal-section-title">ประวัติการรับชำระ</div>
      ${payments.length
        ? `<div class="payment-list">${payments.map(p => `<div class="payment-row"><div><span>${fmtDate(p.date)}</span><b>+ ${money(p.amount)}</b></div><button type="button" class="mini-btn ghost-mini" data-receipt="${contract.id}" data-payment="${p.id}">ใบเสร็จ</button></div>`).join("")}</div>`
        : `<div class="subtle-box">ยังไม่มีประวัติการรับชำระ</div>`}

      ${getStatus(contract) === "active"
        ? `<button class="primary-btn" data-pay="${contract.id}">รับชำระเงิน</button>`
        : ""}
      <button type="button" class="wide-btn danger" data-delete-contract="${contract.id}">ลบสัญญานี้</button>
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
        <div><div class="eyebrow">PAYNEST RECEIPT</div><h2>ใบเสร็จรับเงิน</h2></div>
        <button type="button" class="icon-btn" data-close>×</button>
      </div>

      <div class="receipt-paper" id="receiptPaper">
        <div class="receipt-brand">PAYNEST</div>
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

        <div class="receipt-thanks">ขอบคุณที่ใช้บริการ PAYNEST</div>
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
    app: "PayNest",
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
  link.download = `paynest-backup-${localToday()}.json`;
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
    if (confirm("ล้างข้อมูล PayNest ทั้งหมดใช่หรือไม่? ระบบจะดาวน์โหลดไฟล์สำรองก่อนล้างข้อมูล")) {
      exportJson("before-reset");
      data = resetData();
      // Keep Firestore consistent with the explicit local reset.
      saveData(data);
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

    // New backup envelope stores the actual PayNest data under .data.
    // Older PayNest backups stored the data directly, so keep both formats compatible.
    const payload = parsed?.app === "PayNest" && parsed?.data ? parsed.data : parsed;

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

onAuthStateChanged(auth, async user => {
  renderAuthButton();

  if (!user) {
    stopRealtimeSync();
    return;
  }

  await bootstrapCloud();
});

render();
