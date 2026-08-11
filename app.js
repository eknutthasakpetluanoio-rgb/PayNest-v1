import {loadData, saveData, resetData, exportData, importData} from "./storage.js";

let data = loadData();
let page = "dashboard";

const $ = s => document.querySelector(s);
const money = n => `${data.settings.currency}${Number(n||0).toLocaleString("th-TH",{maximumFractionDigits:2})}`;
const uid = () => crypto.randomUUID();
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"}) : "-";

function persist(){ data=saveData(data); render(); }
function customerById(id){ return data.customers.find(c=>c.id===id); }
function remaining(c){ return Math.max(0, Number(c.total)-Number(c.received)); }
function status(c){ return remaining(c)<=0 ? "paid" : "active"; }

function stats(){
  const active=data.contracts.filter(c=>status(c)==="active");
  return {
    portfolio:data.contracts.reduce((s,c)=>s+c.total,0),
    received:data.contracts.reduce((s,c)=>s+c.received,0),
    due:active.reduce((s,c)=>s+remaining(c),0),
    active:active.length
  };
}

function render(){
  const titles={dashboard:"ภาพรวม",contracts:"สัญญา",customers:"ลูกค้า",settings:"ตั้งค่า"};
  $("#pageTitle").textContent=titles[page];
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#fab").style.display=page==="settings"?"none":"flex";
  $("#view").innerHTML = page==="dashboard"?dashboard():page==="contracts"?contracts():page==="customers"?customers():settings();
}

function dashboard(){
  const s=stats(), recent=[...data.contracts].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  return `<section class="page">
    <div class="hero card">
      <div class="eyebrow">ยอดสัญญาทั้งหมด</div><div class="hero-number">${money(s.portfolio)}</div>
      <div class="hero-meta"><span>${s.active} สัญญาที่กำลังผ่อน</span><span>รับแล้ว ${money(s.received)}</span></div>
    </div>
    <div class="stat-grid">
      <div class="card stat"><span>ต้องรับ</span><strong>${money(s.due)}</strong></div>
      <div class="card stat"><span>สัญญากำลังผ่อน</span><strong>${s.active}</strong></div>
    </div>
    <section class="section"><div class="section-head"><div><div class="eyebrow">ACTION</div><h2>รายการที่ต้องจัดการ</h2></div><button class="text-btn" data-page="contracts">ดูทั้งหมด</button></div>
      ${actionList()}
    </section>
    <section class="section"><div class="section-head"><div><div class="eyebrow">RECENT</div><h2>สัญญาล่าสุด</h2></div><button class="text-btn" data-page="contracts">ทั้งหมด</button></div>
      ${recent.length?recent.map(contractCard).join(""):`<div class="empty card"><div class="empty-icon">+</div><b>ยังไม่มีสัญญา</b><span>กด + เพื่อเริ่มใช้งาน</span></div>`}
    </section>
  </section>`;
}

function actionList(){
  const active=data.contracts.filter(c=>status(c)==="active");
  if(!active.length) return `<div class="empty card"><div class="check">✓</div><b>วันนี้ไม่มีรายการค้างรับ</b><span>ทุกสัญญาที่มีอยู่ยังไม่มีรายการที่ต้องรับเงิน</span></div>`;
  return active.slice(0,4).map(c=>`<div class="task card">
    <div><b>${esc(c.product)}</b><span>${esc(c.customerName||"ไม่ระบุลูกค้า")} · ครบกำหนด ${fmtDate(c.dueDate)}</span></div>
    <div class="task-right"><strong>${money(remaining(c))}</strong><button class="mini-btn" data-pay="${c.id}">รับชำระ</button></div>
  </div>`).join("");
}

function contractCard(c){
  const pct=c.total?Math.min(100,c.received/c.total*100):0;
  return `<article class="contract-card card">
    <div class="contract-top"><div><h3>${esc(c.product)}</h3><span>${esc(c.customerName||"ไม่ระบุลูกค้า")}</span></div><span class="pill ${status(c)}">${status(c)==="paid"?"ชำระครบ":"กำลังผ่อน"}</span></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="progress-meta"><span>${Math.round(pct)}% · รับแล้ว ${money(c.received)}</span><span>เหลือ ${money(remaining(c))}</span></div>
    <div class="contract-bottom"><span>${status(c)==="paid"?"✓ ชำระครบแล้ว":"งวดถัดไป "+fmtDate(c.dueDate)}</span><button class="mini-btn" data-pay="${c.id}" ${status(c)==="paid"?"disabled":""}>${status(c)==="paid"?"ชำระครบ":"รับชำระ"}</button></div>
  </article>`;
}

function contracts(){
  const active=data.contracts.filter(c=>status(c)==="active"), paid=data.contracts.filter(c=>status(c)==="paid");
  return `<section class="page"><div class="tabs">
    <button class="tab active">กำลังผ่อน <b>${active.length}</b></button><button class="tab">ทั้งหมด <b>${data.contracts.length}</b></button><button class="tab">ชำระครบ <b>${paid.length}</b></button>
  </div>${data.contracts.length?data.contracts.map(contractCard).join(""):`<div class="empty card"><div class="empty-icon">＋</div><b>ยังไม่มีสัญญา</b><span>กด + เพื่อสร้างสัญญา</span></div>`}</section>`;
}

function customers(){
  return `<section class="page"><div class="section-head"><div><div class="eyebrow">CUSTOMERS</div><h2>ลูกค้า <small class="count">${data.customers.length}</small></h2></div></div>
  ${data.customers.length?data.customers.map(c=>`<article class="customer card"><div class="avatar">${esc(c.name.charAt(0)||"?")}</div><div class="customer-main"><b>${esc(c.name)}</b><span>${esc(c.phone||"ไม่มีเบอร์โทร")}</span><small>${data.contracts.filter(x=>x.customerId===c.id).length} สัญญา</small></div><button class="mini-btn" data-customer="${c.id}">ดู</button></article>`).join(""):`<div class="empty card"><div class="empty-icon">♙</div><b>ยังไม่มีลูกค้า</b><span>เพิ่มลูกค้าจากตอนสร้างสัญญาได้ทันที</span></div>`}</section>`;
}

function settings(){
  return `<section class="page"><div class="card settings-card"><div class="eyebrow">DATA</div><h2>ข้อมูล</h2><p>ข้อมูลทั้งหมดเก็บในเครื่องด้วย LocalStorage และใช้ฐานข้อมูลชุดเดียวกันทั้งระบบ</p>
  <button class="wide-btn" id="export">ส่งออกข้อมูล JSON</button><button class="wide-btn" id="import">นำเข้าข้อมูล JSON</button><button class="wide-btn danger" id="reset">ล้างข้อมูลทั้งหมด</button></div>
  <div class="card settings-card"><div class="eyebrow">APP</div><h2>PayNest v1</h2><p>สร้างสัญญาได้โดยไม่ต้องมีลูกค้าล่วงหน้า · Mobile first · PWA ready</p></div></section>`;
}

function openContractModal(prefill={}){
  $("#modalRoot").innerHTML=`<div class="overlay"><form class="modal" id="contractForm">
    <div class="modal-head"><div><div class="eyebrow">NEW CONTRACT</div><h2>สร้างสัญญา</h2></div><button type="button" class="icon-btn" data-close>×</button></div>
    <label>สินค้า / รายการ<input name="product" required placeholder="เช่น iPhone 16 Pro" value="${esc(prefill.product||"")}"></label>
    <div class="customer-row"><label>ลูกค้า<input name="customerName" placeholder="ชื่อลูกค้า" value="${esc(prefill.customerName||"")}"></label><label>เบอร์โทร<input name="phone" inputmode="tel" placeholder="08xxxxxxxx" value="${esc(prefill.phone||"")}"></label></div>
    <div class="hint">ไม่ต้องสร้างลูกค้าก่อน ระบบจะสร้าง/ผูกลูกค้าให้อัตโนมัติเมื่อกดสร้างสัญญา</div>
    <div class="customer-select">${data.customers.length?`<select name="customerId"><option value="">+ ลูกค้าใหม่ / ไม่เลือก</option>${data.customers.map(c=>`<option value="${c.id}">${esc(c.name)}${c.phone?" · "+esc(c.phone):""}</option>`).join("")}</select>`:""}</div>
    <div class="customer-row"><label>ยอดรวม<input name="total" type="number" min="0" step="0.01" required></label><label>รับแล้ว<input name="received" type="number" min="0" step="0.01" value="0"></label></div>
    <div class="customer-row"><label>จำนวนงวด<input name="installments" type="number" min="1" value="1"></label><label>รูปแบบ<select name="paymentType"><option value="monthly">รายเดือน</option><option value="weekly">รายสัปดาห์</option><option value="daily">รายวัน</option></select></label></div>
    <label>วันครบกำหนดงวดแรก<input name="dueDate" type="date" value="${today()}"></label>
    <button class="primary-btn" type="submit">สร้างสัญญา</button>
  </form></div>`;
  const form=$("#contractForm");
  const sel=form.querySelector('[name="customerId"]');
  sel?.addEventListener("change",()=>{const c=customerById(sel.value); if(c){form.customerName.value=c.name;form.phone.value=c.phone||"";}});
  form.addEventListener("submit",e=>{
    e.preventDefault(); const f=new FormData(form);
    let customerId=f.get("customerId")||"", name=String(f.get("customerName")||"").trim(), phone=String(f.get("phone")||"").trim();
    if(customerId){const c=customerById(customerId); name=c?.name||name; phone=c?.phone||phone;}
    // IMPORTANT: customer is optional. Create one automatically only when a name is supplied.
    if(name&&!customerId){let c=data.customers.find(x=>x.name.toLowerCase()===name.toLowerCase() && (!phone||x.phone===phone)); if(!c){c={id:uid(),name,phone,note:"",createdAt:new Date().toISOString()};data.customers.push(c);} customerId=c.id;}
    const total=Number(f.get("total")||0), received=Math.min(total,Math.max(0,Number(f.get("received")||0)));
    data.contracts.unshift({id:uid(),product:String(f.get("product")),customerId,customerName:name,phone,total,received,paymentType:String(f.get("paymentType")),installments:Number(f.get("installments")||1),startDate:today(),dueDate:String(f.get("dueDate")),status:received>=total?"paid":"active",payments:received?[{id:uid(),amount:received,date:today()}]:[],createdAt:new Date().toISOString()});
    $("#modalRoot").innerHTML=""; persist();
  });
}

function openPayment(id){
  const c=data.contracts.find(x=>x.id===id); if(!c)return;
  $("#modalRoot").innerHTML=`<div class="overlay"><form class="modal small" id="payForm"><div class="modal-head"><div><div class="eyebrow">PAYMENT</div><h2>รับชำระเงิน</h2></div><button type="button" class="icon-btn" data-close>×</button></div>
  <p><b>${esc(c.product)}</b><br>${esc(c.customerName||"ไม่ระบุลูกค้า")}<br>คงเหลือ ${money(remaining(c))}</p>
  <label>จำนวนเงิน<input name="amount" type="number" min="0.01" max="${remaining(c)}" step="0.01" value="${remaining(c)}" required></label>
  <label>วันที่รับเงิน<input name="date" type="date" value="${today()}"></label>
  <button class="primary-btn">บันทึกรับชำระ</button></form></div>`;
  $("#payForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);const amount=Math.min(remaining(c),Number(f.get("amount")||0));if(amount<=0)return; c.received+=amount;c.status=status(c);c.payments.push({id:uid(),amount,date:String(f.get("date"))});$("#modalRoot").innerHTML="";persist();});
}

function openCustomer(id){
  const c=customerById(id); if(!c)return;
  const cs=data.contracts.filter(x=>x.customerId===id);
  $("#modalRoot").innerHTML=`<div class="overlay"><div class="modal small"><div class="modal-head"><div><div class="eyebrow">CUSTOMER</div><h2>${esc(c.name)}</h2></div><button class="icon-btn" data-close>×</button></div><p>โทร ${esc(c.phone||"-")}</p><div class="customer-contracts">${cs.length?cs.map(contractCard).join(""):"ยังไม่มีสัญญา"}</div></div></div>`;
}

document.addEventListener("click",e=>{
  const pageBtn=e.target.closest("[data-page]"); if(pageBtn){page=pageBtn.dataset.page;render();return;}
  const pay=e.target.closest("[data-pay]"); if(pay){openPayment(pay.dataset.pay);return;}
  const cust=e.target.closest("[data-customer]"); if(cust){openCustomer(cust.dataset.customer);return;}
  if(e.target.closest("#fab")){openContractModal();return;}
  if(e.target.closest("[data-close]")){$("#modalRoot").innerHTML="";return;}
  if(e.target.id==="export"){const blob=new Blob([exportData()],[{type:"application/json"}]);const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`paynest-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);}
  if(e.target.id==="import")$("#importFile").click();
  if(e.target.id==="reset"&&confirm("ล้างข้อมูล PayNest ทั้งหมดใช่หรือไม่?")){data=resetData();render();}
});
$("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{data=importData(await file.text());render();alert("นำเข้าข้อมูลสำเร็จ");}catch(err){alert("ไฟล์ JSON ไม่ถูกต้อง");}});
$("#topAction").addEventListener("click",()=>scrollTo({top:0,behavior:"smooth"}));
render();
