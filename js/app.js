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
  filter: "all"
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

function render() {
  const app = $("#app");

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">PAYNEST</div>
          <h1>${state.page === "home" ? "ภาพรวม" : state.page === "contracts" ? "สัญญา" : state.page === "customers" ? "ลูกค้า" : "ตั้งค่า"}</h1>
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

function nav(page, icon, label) {
  return `<button class="nav-item ${state.page === page ? "active" : ""}" data-page="${page}">
    <span>${icon}</span><small>${label}</small>
  </button>`;
}

function homePage() {
  const contracts = state.data.contracts;
  const total = contracts.reduce((s, c) => s + calc(c).total, 0);
  const paid = contracts.reduce((s, c) => s + calc(c).paid, 0);
  const remain = Math.max(total - paid, 0);
  const active = contracts.filter(c => calc(c).remain > 0).length;

  return `
    <section class="hero-card">
      <div class="hero-glow"></div>
      <div class="eyebrow">PORTFOLIO VALUE</div>
      <div class="hero-value">฿${money(total)}</div>
      <div class="hero-meta">
        <span>รับแล้ว ฿${money(paid)}</span>
        <span>คงเหลือ ฿${money(remain)}</span>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card"><span>สัญญาทั้งหมด</span><strong>${contracts.length}</strong></article>
      <article class="stat-card"><span>กำลังผ่อน</span><strong>${active}</strong></article>
      <article class="stat-card"><span>รับแล้ว</span><strong>฿${money(paid)}</strong></article>
      <article class="stat-card"><span>ค้างรับ</span><strong>฿${money(remain)}</strong></article>
    </section>

    <section class="section-head">
      <div><div class="eyebrow">RECENT</div><h2>สัญญาล่าสุด</h2></div>
      <button class="text-btn" data-page="contracts">ดูทั้งหมด</button>
    </section>

    <section class="stack">
      ${contracts.length ? contracts.slice().reverse().slice(0, 5).map(contractCard).join("") : emptyState()}
    </section>
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
        <span class="badge ${x.remain ? "pending" : "paid"}">${x.remain ? "กำลังผ่อน" : "ชำระครบ"}</span>
      </div>

      <div class="progress"><i style="width:${x.percent}%"></i></div>

      <div class="row-between muted">
        <span>${x.percent.toFixed(0)}% ชำระแล้ว</span>
        <strong>เหลือ ฿${money(x.remain)}</strong>
      </div>

      <div class="contract-footer">
        <span>งวดถัดไป: ${dateTH(c.nextDue)}</span>
        <button class="mini-btn" data-action="pay" data-id="${c.id}">รับชำระ</button>
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
      ${filterButton("all", "ทั้งหมด")}
      ${filterButton("active", "กำลังผ่อน")}
      ${filterButton("paid", "ชำระครบ")}
    </section>

    <section class="stack">
      ${list.length ? list.slice().reverse().map(contractCard).join("") : emptyState("ยังไม่มีสัญญา")}
    </section>
  `;
}

function filterButton(value, label) {
  return `<button class="filter ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`;
}

function customersPage() {
  return `
    <section class="section-head">
      <div>
        <div class="eyebrow">CUSTOMERS</div>
        <h2>ลูกค้า</h2>
      </div>
      <span class="count-pill">${state.data.customers.length}</span>
    </section>

    <section class="stack">
      ${state.data.customers.length
        ? state.data.customers.map(customerCard).join("")
        : emptyState("ยังไม่มีลูกค้า")}
    </section>
  `;
}

/*
 * แก้บั๊กหน้าลูกค้า:
 * เดิม customer-card ไม่มี data-action จึงกดแล้วไม่มีอะไรเกิดขึ้น
 * ตอนนี้การ์ดทั้งใบสามารถกดเพื่อเปิดรายละเอียดลูกค้าได้
 */
function customerCard(c) {
  const count = state.data.contracts.filter(
    x => x.customerId === c.id
  ).length;

  return `
    <article
      class="customer-card"
      data-action="customer-detail"
      data-id="${escapeHTML(c.id)}"
      role="button"
      tabindex="0"
      aria-label="ดูรายละเอียด ${escapeHTML(c.name || "ลูกค้า")}"
    >
      <div class="avatar">${escapeHTML((c.name || "?").charAt(0))}</div>

      <div class="grow">
        <h3>${escapeHTML(c.name || "ไม่ระบุชื่อ")}</h3>
        <p>${escapeHTML(c.phone || "-")}</p>
      </div>

      <span class="count-pill">${count} สัญญา</span>
    </article>
  `;
}

function settingsPage() {
  return `
    <section class="settings-card">
      <div class="eyebrow">DATA</div>
      <h2>จัดการข้อมูล</h2>
      <p class="muted">ข้อมูล PayNest v1 เก็บไว้ในเครื่องนี้ผ่าน LocalStorage</p>

      <div class="settings-actions">
        <button class="wide-btn" data-action="backup">ส่งออกข้อมูล JSON</button>

        <label class="wide-btn">
          นำเข้าข้อมูล JSON
          <input id="import-file" type="file" accept=".json,application/json" hidden>
        </label>

        <button class="wide-btn danger" data-action="reset">ล้างข้อมูลทั้งหมด</button>
      </div>
    </section>

    <section class="settings-card">
      <div class="eyebrow">APP</div>
      <h2>PayNest v1</h2>
      <p class="muted">Version 1.0 • Single-device storage • PWA ready</p>
    </section>
  `;
}

function emptyState(text = "ยังไม่มีข้อมูล") {
  return `
    <div class="empty">
      <div class="empty-icon">＋</div>
      <h3>${text}</h3>
      <p>กดปุ่ม + เพื่อเพิ่มรายการแรก</p>
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
          ชื่อลูกค้า
          <input name="customer" required placeholder="ชื่อลูกค้า">
        </label>

        <label>
          เบอร์โทร
          <input name="phone" placeholder="08xxxxxxxx">
        </label>

        <label>
          ยอดรวม
          <input name="total" required type="number" min="0" step="0.01" placeholder="0">
        </label>

        <label>
          ยอดที่รับแล้ว
          <input name="paid" type="number" min="0" step="0.01" value="0">
        </label>

        <label>
          วันครบกำหนดถัดไป
          <input name="nextDue" type="date" value="${today()}">
        </label>

        <button class="primary-btn" type="submit">บันทึกสัญญา</button>
      </form>
    </div>
  `;

  document.body.append(modal);

  modal.querySelector("[data-close]").onclick = () => modal.remove();

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const customerName = String(fd.get("customer") || "").trim();

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

    const total = Number(fd.get("total")) || 0;
    const paid = Math.min(
      Number(fd.get("paid")) || 0,
      total
    );

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

/*
 * เปิดรายละเอียดลูกค้า
 * แสดงข้อมูลลูกค้า + สัญญาทั้งหมดที่ผูกกับ customerId
 */
function openCustomerDetail(id) {
  const customer = state.data.customers.find(c => c.id === id);
  if (!customer) return;

  const contracts = state.data.contracts.filter(
    c => c.customerId === customer.id
  );

  const total = contracts.reduce(
    (sum, c) => sum + calc(c).total,
    0
  );

  const paid = contracts.reduce(
    (sum, c) => sum + calc(c).paid,
    0
  );

  const remain = contracts.reduce(
    (sum, c) => sum + calc(c).remain,
    0
  );

  const modal = document.createElement("div");
  modal.className = "modal-wrap";

  modal.innerHTML = `
    <div class="modal">
      <div class="row-between">
        <div>
          <div class="eyebrow">CUSTOMER</div>
          <h2>${escapeHTML(customer.name || "ไม่ระบุชื่อ")}</h2>
        </div>

        <button class="icon-btn" data-close>×</button>
      </div>

      <div class="settings-card">
        <p><strong>เบอร์โทร</strong></p>
        <p class="muted">${escapeHTML(customer.phone || "-")}</p>

        <p><strong>จำนวนสัญญา</strong></p>
        <p class="muted">${contracts.length} สัญญา</p>

        <p><strong>ยอดรวม</strong></p>
        <p class="muted">฿${money(total)}</p>

        <p><strong>รับแล้ว</strong></p>
        <p class="muted">฿${money(paid)}</p>

        <p><strong>คงเหลือ</strong></p>
        <p class="muted">฿${money(remain)}</p>
      </div>

      <div class="section-head">
        <div>
          <div class="eyebrow">CONTRACTS</div>
          <h2>สัญญาของลูกค้า</h2>
        </div>
      </div>

      <div class="stack">
        ${
          contracts.length
            ? contracts.map(c => {
                const x = calc(c);

                return `
                  <article class="contract-card">
                    <div class="row-between">
                      <div>
                        <h3>${escapeHTML(c.title || "สัญญาไม่มีชื่อ")}</h3>
                        <p>${x.percent.toFixed(0)}% ชำระแล้ว</p>
                      </div>

                      <span class="badge ${x.remain ? "pending" : "paid"}">
                        ${x.remain ? "กำลังผ่อน" : "ชำระครบ"}
                      </span>
                    </div>

                    <div class="row-between muted">
                      <span>ยอดรวม ฿${money(x.total)}</span>
                      <strong>เหลือ ฿${money(x.remain)}</strong>
                    </div>

                    ${
                      x.remain
                        ? `<button
                            class="primary-btn"
                            data-action="customer-pay"
                            data-id="${escapeHTML(c.id)}"
                          >รับชำระ</button>`
                        : ""
                    }
                  </article>
                `;
              }).join("")
            : `<div class="empty"><h3>ยังไม่มีสัญญา</h3></div>`
        }
      </div>
    </div>
  `;

  document.body.append(modal);

  modal.querySelector("[data-close]").onclick = () => modal.remove();

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelectorAll('[data-action="customer-pay"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const contractId = btn.dataset.id;
      modal.remove();
      receivePayment(contractId);
    });
  });
}

function receivePayment(id) {
  const contract = state.data.contracts.find(c => c.id === id);
  if (!contract) return;

  const remain = calc(contract).remain;
  if (!remain) return;

  const amount = prompt(
    `รับชำระเท่าไร? (คงเหลือ ฿${money(remain)})`,
    String(remain)
  );

  if (amount === null) return;

  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return alert("จำนวนเงินไม่ถูกต้อง");
  }

  contract.paid = Math.min(
    Number(contract.total) || 0,
    (Number(contract.paid) || 0) + value
  );

  persist();
  render();
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
    alert("ไฟล์ JSON ไม่ถูกต้อง หรือไม่ใช่ข้อมูล PayNest");
  }
}

document.addEventListener("click", e => {
  const page = e.target.closest("[data-page]");

  if (page) {
    state.page = page.dataset.page;
    state.filter = "all";
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

  const actionName = action.dataset.action;

  if (actionName === "add-contract") {
    openContractForm();
    return;
  }

  if (actionName === "pay") {
    receivePayment(action.dataset.id);
    return;
  }

  if (actionName === "customer-detail") {
    openCustomerDetail(action.dataset.id);
    return;
  }

  if (actionName === "backup") {
    backup();
    return;
  }

  if (actionName === "reset") {
    if (confirm("ต้องการล้างข้อมูล PayNest ทั้งหมดจริงหรือไม่?")) {
      state.data = resetData();
      render();
    }
  }
});

document.addEventListener("keydown", e => {
  const customer = e.target.closest('[data-action="customer-detail"]');

  if (!customer) return;

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openCustomerDetail(customer.dataset.id);
  }
});

document.addEventListener("change", e => {
  if (
    e.target.id === "import-file" &&
    e.target.files[0]
  ) {
    importFile(e.target.files[0]);
  }
});

if (
  "serviceWorker" in navigator &&
  location.protocol !== "file:"
) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(console.warn);
}

render();

