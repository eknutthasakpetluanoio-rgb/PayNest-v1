import {
  loadData,
  saveData,
  resetData,
  exportData,
  importData
} from "./storage.js";

const state = {
  data: loadData(),
  page: "home",
  filter: "active"
};

const $ = (selector) => document.querySelector(selector);

const money = (value) =>
  new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const uid = (prefix = "id") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const escapeHTML = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateTH(value) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(d);
}

function calc(contract) {
  const total = Number(contract.total) || 0;
  const paid = Number(contract.paid) || 0;
  const remain = Math.max(total - paid, 0);
  const percent = total ? Math.min((paid / total) * 100, 100) : 0;
  return { total, paid, remain, percent };
}

function persist() {
  state.data = saveData(state.data);
}

function getActiveContracts() {
  return state.data.contracts.filter(c => calc(c).remain > 0);
}

function render() {
  const app = $("#app");

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">PAYNEST</div>
          <h1>${pageTitle()}</h1>
        </div>
        <button class="icon-btn" data-action="backup" aria-label="สำรองข้อมูล">↥</button>
      </header>

      <main class="content">
        ${state.page === "home" ? homePage() : ""}
        ${state.page === "contracts" ? contractsPage() : ""}
        ${state.page === "customers" ? customersPage() : ""}
        ${state.page === "settings" ? settingsPage() : ""}
      </main>

      ${state.page !== "settings" ? `
        <button class="fab" data-action="add-contract" aria-label="เพิ่มสัญญา">+</button>
      ` : ""}

      <nav class="bottom-nav">
        ${nav("home", "⌂", "หน้าหลัก")}
        ${nav("contracts", "▣", "สัญญา")}
        ${nav("customers", "♙", "ลูกค้า")}
        ${nav("settings", "⚙", "ตั้งค่า")}
      </nav>
    </div>
  `;
}

function pageTitle() {
  if (state.page === "contracts") return "สัญญา";
  if (state.page === "customers") return "ลูกค้า";
  if (state.page === "settings") return "ตั้งค่า";
  return "วันนี้";
}

function nav(page, icon, label) {
  return `
    <button class="nav-item ${state.page === page ? "active" : ""}" data-page="${page}">
      <span>${icon}</span>
      <small>${label}</small>
    </button>
  `;
}

function homePage() {
  const contracts = state.data.contracts;
  const active = getActiveContracts();

  const total = contracts.reduce((s, c) => s + calc(c).total, 0);
  const paid = contracts.reduce((s, c) => s + calc(c).paid, 0);
  const remain = Math.max(total - paid, 0);

  return `
    <section class="hero-card">
      <div class="hero-glow"></div>
      <div class="eyebrow">คงค้างทั้งหมด</div>
      <div class="hero-value">฿${money(remain)}</div>
      <div class="hero-meta">
        <span>${active.length} สัญญาที่กำลังผ่อน</span>
        <span>รับแล้ว ฿${money(paid)}</span>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card">
        <span>ต้องรับ</span>
        <strong>฿${money(remain)}</strong>
      </article>
      <article class="stat-card">
        <span>สัญญากำลังผ่อน</span>
        <strong>${active.length}</strong>
      </article>
    </section>

    <section class="section-head">
      <div>
        <div class="eyebrow">ACTION</div>
        <h2>รายการที่ต้องจัดการ</h2>
      </div>
      <button class="text-btn" data-page="contracts">ดูทั้งหมด</button>
    </section>

    <section class="stack">
      ${
        active.length
          ? active.slice().reverse().map(actionCard).join("")
          : `
            <div class="empty">
              <div class="empty-icon">✓</div>
              <h3>ไม่มีรายการค้างรับ</h3>
              <p>ทุกสัญญาชำระครบแล้ว</p>
            </div>
          `
      }
    </section>
  `;
}

function actionCard(c) {
  const x = calc(c);

  return `
    <article class="contract-card">
      <div class="row-between">
        <div>
          <h3>${escapeHTML(c.title || "สัญญาไม่มีชื่อ")}</h3>
          <p>${escapeHTML(c.customerName || "ไม่ระบุลูกค้า")}</p>
        </div>
        <span class="badge pending">คงค้าง</span>
      </div>

      <div class="progress">
        <i style="width:${x.percent}%"></i>
      </div>

      <div class="row-between muted">
        <span>${x.percent.toFixed(0)}% ชำระแล้ว</span>
        <strong>เหลือ ฿${money(x.remain)}</strong>
      </div>

      <div class="contract-footer">
        <span>ครบกำหนด ${dateTH(c.nextDue)}</span>
        <button class="mini-btn" data-action="pay" data-id="${escapeHTML(c.id)}">
          รับเงิน
        </button>
      </div>
    </article>
  `;
}

function contractsPage() {
  let list = state.data.contracts;

  if (state.filter === "active") {
    list = list.filter(c => calc(c).remain > 0);
  }

  if (state.filter === "paid") {
    list = list.filter(c => calc(c).remain <= 0);
  }

  return `
    <section class="filters">
      ${filterButton("active", "กำลังผ่อน")}
      ${filterButton("all", "ทั้งหมด")}
      ${filterButton("paid", "ชำระครบ")}
    </section>

    <section class="stack">
      ${
        list.length
          ? list.slice().reverse().map(contractCard).join("")
          : emptyState("ไม่พบสัญญา")
      }
    </section>
  `;
}

function filterButton(value, label) {
  return `
    <button class="filter ${state.filter === value ? "active" : ""}" data-filter="${value}">
      ${label}
    </button>
  `;
}

function contractCard(c) {
  const x = calc(c);

  return `
    <article class="contract-card">
      <div class="row-between">
        <div>
          <h3>${escapeHTML(c.title || "สัญญาไม่มีชื่อ")}</h3>
          <p>${escapeHTML(c.customerName || "ไม่ระบุลูกค้า")}</p>
        </div>
        <span class="badge ${x.remain ? "pending" : "paid"}">
          ${x.remain ? "กำลังผ่อน" : "ชำระครบ"}
        </span>
      </div>

      <div class="progress">
        <i style="width:${x.percent}%"></i>
      </div>

      <div class="row-between muted">
        <span>${x.percent.toFixed(0)}% ชำระแล้ว</span>
        <strong>เหลือ ฿${money(x.remain)}</strong>
      </div>

      <div class="contract-footer">
        <span>${x.remain ? `ครบกำหนด ${dateTH(c.nextDue)}` : "ชำระครบแล้ว"}</span>
        <button
          class="mini-btn"
          data-action="${x.remain ? "pay" : "contract-detail"}"
          data-id="${escapeHTML(c.id)}"
        >
          ${x.remain ? "รับเงิน" : "ดูรายละเอียด"}
        </button>
      </div>
    </article>
  `;
}


function customersPage() {
  const customers = Array.isArray(state.data.customers) ? state.data.customers : [];

  return `
    <section class="section-head">
      <div>
        <div class="eyebrow">CUSTOMERS</div>
        <h2>ลูกค้า</h2>
      </div>
      <span class="count-pill">${customers.length}</span>
    </section>

    <section class="stack">
      ${customers.length
        ? customers.map(customerCard).join("")
        : emptyState("ยังไม่มีลูกค้า")}
    </section>
  `;
}

function customerCard(customer) {
  const contracts = state.data.contracts.filter(
    c => String(c.customerId || "") === String(customer.id || "") ||
         (c.customerName || "") === (customer.name || "")
  );

  const total = contracts.reduce((s, c) => s + calc(c).total, 0);
  const remain = contracts.reduce((s, c) => s + calc(c).remain, 0);

  return `
    <article class="customer-card" data-action="customer-detail" data-id="${escapeHTML(customer.id)}">
      <div class="avatar">${escapeHTML((customer.name || "?").charAt(0))}</div>
      <div class="grow">
        <h3>${escapeHTML(customer.name || "ไม่ระบุชื่อ")}</h3>
        <p>${escapeHTML(customer.phone || "-")}</p>
      </div>
      <div class="customer-summary">
        <span>${contracts.length} สัญญา</span>
        <strong>เหลือ ฿${money(remain)}</strong>
      </div>
    </article>
  `;
}

function settingsPage() {
  return `
    <section class="settings-card">
      <div class="eyebrow">DATA</div>
      <h2>ข้อมูล</h2>
      <p class="muted">ข้อมูลเก็บไว้ในเครื่องนี้ด้วย LocalStorage</p>

      <div class="settings-actions">
        <button class="wide-btn" data-action="backup">ส่งออกข้อมูล JSON</button>

        <label class="wide-btn">
          นำเข้าข้อมูล JSON
          <input id="import-file" type="file" accept=".json,application/json" hidden>
        </label>

        <button class="wide-btn danger" data-action="reset">
          ล้างข้อมูลทั้งหมด
        </button>
      </div>
    </section>

    <section class="settings-card">
      <div class="eyebrow">APP</div>
      <h2>PayNest v1</h2>
      <p class="muted">ใช้งานง่าย • ข้อมูลในเครื่อง • PWA ready</p>
    </section>
  `;
}

function emptyState(text) {
  return `
    <div class="empty">
      <div class="empty-icon">＋</div>
      <h3>${escapeHTML(text)}</h3>
    </div>
  `;
}

function openContractForm() {
  const modal = document.createElement("div");
  modal.className = "modal-wrap";

  modal.innerHTML = `
    <div class="modal">
      <div class="row-between">
        <h2>เพิ่มสัญญา</h2>
        <button class="icon-btn" data-close>×</button>
      </div>

      <form id="contract-form">
        <label>
          ชื่อสัญญา
          <input name="title" required placeholder="เช่น iPhone 16 Pro">
        </label>

        <label>
          ลูกค้า
          <input name="customer" required placeholder="ชื่อลูกค้า">
        </label>

        <label>
          เบอร์โทร
          <input name="phone" placeholder="08xxxxxxxx">
        </label>

        <label>
          ยอดรวม
          <input name="total" required type="number" min="0" step="0.01">
        </label>

        <label>
          รับแล้ว
          <input name="paid" type="number" min="0" step="0.01" value="0">
        </label>

        <label>
          วันครบกำหนด
          <input name="nextDue" type="date" value="${today()}">
        </label>

        <button class="primary-btn" type="submit">สร้างสัญญา</button>
      </form>
    </div>
  `;

  document.body.append(modal);

  modal.querySelector("[data-close]").onclick = () => modal.remove();

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("#contract-form").addEventListener("submit", e => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const customerName = String(fd.get("customer") || "").trim();
    const total = Number(fd.get("total")) || 0;
    const paid = Math.min(Number(fd.get("paid")) || 0, total);

    let customer = state.data.customers.find(
      c => c.name === customerName
    );

    if (!customer) {
      customer = {
        id: uid("cus"),
        name: customerName,
        phone: String(fd.get("phone") || "").trim()
      };
      state.data.customers.push(customer);
    } else if (!customer.phone && fd.get("phone")) {
      customer.phone = String(fd.get("phone")).trim();
    }

    state.data.contracts.push({
      id: uid("con"),
      customerId: customer.id,
      customerName,
      title: String(fd.get("title") || "").trim(),
      total,
      paid,
      nextDue: String(fd.get("nextDue") || today()),
      createdAt: new Date().toISOString()
    });

    persist();
    modal.remove();
    render();
  });
}

function openPaymentModal(id) {
  const contract = state.data.contracts.find(
    c => String(c.id) === String(id)
  );

  if (!contract) {
    alert("ไม่พบสัญญานี้");
    return;
  }

  const x = calc(contract);

  if (x.remain <= 0) {
    openContractDetail(id);
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-wrap";

  modal.innerHTML = `
    <div class="modal payment-modal">
      <div class="row-between">
        <div>
          <div class="eyebrow">RECEIVE PAYMENT</div>
          <h2>รับชำระเงิน</h2>
        </div>
        <button class="icon-btn" data-close>×</button>
      </div>

      <div class="settings-card">
        <h3>${escapeHTML(contract.title || "สัญญาไม่มีชื่อ")}</h3>
        <p>${escapeHTML(contract.customerName || "ไม่ระบุลูกค้า")}</p>
        <div class="row-between">
          <span>คงเหลือ</span>
          <strong>฿${money(x.remain)}</strong>
        </div>
      </div>

      <form id="payment-form">
        <label>
          จำนวนเงิน
          <input
            id="payment-amount"
            name="amount"
            type="number"
            inputmode="decimal"
            min="0.01"
            max="${x.remain}"
            step="0.01"
            value="${x.remain}"
            required
            autofocus
          >
        </label>

        <button class="primary-btn" type="submit">
          ยืนยันรับเงิน
        </button>
      </form>
    </div>
  `;

  document.body.append(modal);

  modal.querySelector("[data-close]").onclick = () => modal.remove();

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("#payment-form").addEventListener("submit", e => {
    e.preventDefault();

    const amount = Number(
      e.currentTarget.elements.amount.value
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("กรุณาระบุจำนวนเงิน");
      return;
    }

    if (amount > x.remain) {
      alert(`รับได้ไม่เกิน ฿${money(x.remain)}`);
      return;
    }

    contract.paid = x.paid + amount;

    persist();
    modal.remove();
    render();
  });
}

function openContractDetail(id) {
  const contract = state.data.contracts.find(
    c => String(c.id) === String(id)
  );

  if (!contract) return;

  const x = calc(contract);

  const modal = document.createElement("div");
  modal.className = "modal-wrap";

  modal.innerHTML = `
    <div class="modal">
      <div class="row-between">
        <div>
          <div class="eyebrow">CONTRACT</div>
          <h2>${escapeHTML(contract.title || "สัญญา")}</h2>
        </div>
        <button class="icon-btn" data-close>×</button>
      </div>

      <div class="settings-card">
        <div class="row-between"><span>ลูกค้า</span><strong>${escapeHTML(contract.customerName || "-")}</strong></div>
        <div class="row-between"><span>ยอดรวม</span><strong>฿${money(x.total)}</strong></div>
        <div class="row-between"><span>รับแล้ว</span><strong>฿${money(x.paid)}</strong></div>
        <div class="row-between"><span>คงเหลือ</span><strong>฿${money(x.remain)}</strong></div>
        <div class="row-between"><span>ชำระแล้ว</span><strong>${x.percent.toFixed(0)}%</strong></div>
        <div class="row-between"><span>งวดถัดไป</span><strong>${dateTH(contract.nextDue)}</strong></div>
      </div>

      ${
        x.remain
          ? `<button class="primary-btn" data-action="detail-pay" data-id="${escapeHTML(contract.id)}">รับเงิน</button>`
          : `<div class="empty"><div class="empty-icon">✓</div><h3>ชำระครบแล้ว</h3><p>ไม่มียอดค้างรับ</p></div>`
      }
    </div>
  `;

  document.body.append(modal);

  modal.querySelector("[data-close]").onclick = () => modal.remove();

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  const payButton = modal.querySelector('[data-action="detail-pay"]');

  if (payButton) {
    payButton.onclick = () => {
      modal.remove();
      openPaymentModal(id);
    };
  }
}


function openCustomerDetail(id) {
  const customer = state.data.customers.find(c => String(c.id) === String(id));
  if (!customer) return;

  const contracts = state.data.contracts.filter(
    c => String(c.customerId || "") === String(customer.id || "") ||
         (c.customerName || "") === (customer.name || "")
  );

  const modal = document.createElement("div");
  modal.className = "modal-wrap";
  modal.innerHTML = `
    <div class="modal">
      <div class="row-between">
        <div><div class="eyebrow">CUSTOMER</div><h2>${escapeHTML(customer.name || "ลูกค้า")}</h2></div>
        <button class="icon-btn" data-close>×</button>
      </div>
      <div class="settings-card">
        <div class="row-between"><span>เบอร์โทร</span><strong>${escapeHTML(customer.phone || "-")}</strong></div>
        <div class="row-between"><span>จำนวนสัญญา</span><strong>${contracts.length}</strong></div>
      </div>
      <div class="eyebrow">CONTRACTS</div>
      <h2>สัญญาของลูกค้า</h2>
      <section class="stack">
        ${contracts.length ? contracts.map(c => { const x=calc(c); return `<article class="contract-card"><div class="row-between"><div><h3>${escapeHTML(c.title || "สัญญา")}</h3><p>${x.percent.toFixed(0)}% ชำระแล้ว</p></div><strong>เหลือ ฿${money(x.remain)}</strong></div></article>`; }).join("") : emptyState("ยังไม่มีสัญญา")}
      </section>
    </div>
  `;
  document.body.append(modal);
  modal.querySelector("[data-close]").onclick = () => modal.remove();
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
}

function backup() {
  const blob = new Blob(
    [exportData(state.data)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `paynest-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importFile(file) {
  try {
    const text = await file.text();
    state.data = importData(text);
    persist();
    render();
    alert("นำเข้าข้อมูลสำเร็จ");
  } catch {
    alert("ไฟล์ JSON ไม่ถูกต้อง");
  }
}

document.addEventListener("click", e => {
  const page = e.target.closest("[data-page]");
  if (page) {
    state.page = page.dataset.page;
    if (state.page === "contracts") state.filter = "active";
    render();
    return;
  }

  const filter = e.target.closest("[data-filter]");
  if (filter) {
    state.filter = filter.dataset.filter;
    render();
    return;
  }

  const action = e.target.closest("[data-action]");
  if (!action) return;

  switch (action.dataset.action) {
    case "add-contract":
      openContractForm();
      break;

    case "pay":
      openPaymentModal(action.dataset.id);
      break;

    case "contract-detail":
      openContractDetail(action.dataset.id);
      break;

    case "customer-detail":
      openCustomerDetail(action.dataset.id);
      break;

    case "backup":
      backup();
      break;

    case "reset":
      if (confirm("ต้องการล้างข้อมูล PayNest ทั้งหมดจริงหรือไม่?")) {
        state.data = resetData();
        render();
      }
      break;
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "import-file" && e.target.files[0]) {
    importFile(e.target.files[0]);
  }
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(console.warn);
}

render();

