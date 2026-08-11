import {loadData, saveData, resetData, exportData, importData} from "./storage.js";

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

function customerById(id) {
  return data.customers.find(customer => customer.id === id);
}

function remaining(contract) {
  return Math.max(0, Number(contract.total) - Number(contract.received));
}

function getStatus(contract) {
  return remaining(contract) <= 0 && Number(contract.total) > 0 ? "paid" : "active";
}

function statusLabel(contract) {
  return getStatus(contract) === "paid" ? "ชำระครบ" : "กำลังผ่อน";
}

function stats() {
  const active = data.contracts.filter(c => getStatus(c) === "active");
  return {
    portfolio: data.contracts.reduce((sum, c) => sum + Number(c.total || 0), 0),
    received: data.contracts.reduce((sum, c) => sum + Number(c.received || 0), 0),
    due: active.reduce((sum, c) => sum + remaining(c), 0),
    active: active.length,
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
      <span class="pill ${paid ? "paid" : "active"}">${statusLabel(c)}</span>
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
      <span>${paid ? "✓ ชำระครบแล้ว" : "งวดถัดไป " + fmtDate(c.dueDate)}</span>
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
      <button class="wide-btn" id="export">ส่งออกข้อมูล JSON</button>
      <button class="wide-btn" id="import">นำเข้าข้อมูล JSON</button>
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
        <strong>คงเหลือ
