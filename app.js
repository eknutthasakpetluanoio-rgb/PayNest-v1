const KEY="paynest_v1";
const EMPTY={version:1,customers:[],contracts:[],payments:[],settings:{currency:"฿"}};
const clone=x=>JSON.parse(JSON.stringify(x));
const uid=p=>p+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=n=>"฿"+Number(n||0).toLocaleString("th-TH",{maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);
const dateTH=s=>s?new Date(s+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"}):"-";

function normalize(x){
 if(!x||typeof x!=="object")return clone(EMPTY);
 return {version:1,customers:Array.isArray(x.customers)?x.customers:[],contracts:Array.isArray(x.contracts)?x.contracts:[],payments:Array.isArray(x.payments)?x.payments:[],settings:{currency:"฿",...(x.settings||{})}}
}
function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||"null"))}catch(e){return clone(EMPTY)}}
let db=load(),page="home",filter="active";
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function customer(id){return db.customers.find(x=>x.id===id)}
function paid(c){return db.payments.filter(p=>p.contractId===c.id).reduce((a,p)=>a+Number(p.amount||0),0)}
function remaining(c){return Math.max(0,Number(c.total||0)-paid(c))}
function pct(c){return Number(c.total)>0?Math.min(100,Math.round(paid(c)/Number(c.total)*100)):0}
function typeLabel(t){return({daily:"รายวัน",weekly:"รายสัปดาห์",monthly:"รายเดือน"}[t]||"รายเดือน")}
function addPeriod(date,type){
 const d=new Date(date+"T00:00:00");
 if(type==="daily")d.setDate(d.getDate()+1);
 else if(type==="weekly")d.setDate(d.getDate()+7);
 else d.setMonth(d.getMonth()+1);
 return d.toISOString().slice(0,10);
}
function overdue(c){return remaining(c)>0&&c.dueDate&&c.dueDate<today()}
function status(c){if(remaining(c)<=0)return"ชำระครบ";if(overdue(c))return"ค้างชำระ";if(c.dueDate===today())return"ครบกำหนดวันนี้";return"กำลังผ่อน"}

const view=document.getElementById("view"),modal=document.getElementById("modalRoot"),fab=document.getElementById("fab");
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>go(b.dataset.page));
document.getElementById("scrollTopBtn").onclick=()=>scrollTo({top:0,behavior:"smooth"});
fab.onclick=()=>page==="customers"?customerForm():contractForm();

function go(p){page=p;render();scrollTo(0,0)}
function render(){
 document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 document.getElementById("pageTitle").textContent={home:"ภาพรวม",contracts:"สัญญา",customers:"ลูกค้า",settings:"ตั้งค่า"}[page];
 fab.style.display=page==="settings"?"none":"block";
 ({home,contracts,customers,settings})[page]();
}

function home(){
 const total=db.contracts.reduce((a,c)=>a+Number(c.total||0),0),got=db.contracts.reduce((a,c)=>a+paid(c),0),left=Math.max(0,total-got);
 const active=db.contracts.filter(c=>remaining(c)>0).length;
 const due=db.contracts.filter(c=>remaining(c)>0&&(c.dueDate===today()||overdue(c)));
 view.innerHTML=`<div class="hero"><div class="kicker">ยอดค้างทั้งหมด</div><div class="big">${money(left)}</div><div class="hero-meta"><span>${active} สัญญาที่กำลังผ่อน</span><span>รับแล้ว ${money(got)}</span></div></div>
 <div class="stats"><div class="stat"><label>ต้องรับ</label><strong>${money(left)}</strong></div><div class="stat"><label>ต้องจัดการวันนี้</label><strong>${due.length}</strong></div></div>
 <section class="section"><div class="section-head"><div><div class="kicker">ACTION</div><div class="section-title">รายการที่ต้องจัดการ</div></div><button class="section-link" onclick="go('contracts')">ดูทั้งหมด</button></div>
 ${due.length?due.map(contractCard).join(""):`<div class="empty"><div class="empty-icon">✓</div><strong>ไม่มีรายการที่ต้องจัดการ</strong><div class="sub">วันนี้ยังไม่มีสัญญาที่ถึงกำหนดหรือค้างชำระ</div></div>`}</section>
 <section class="section"><div class="section-head"><div><div class="kicker">RECENT</div><div class="section-title">สัญญาล่าสุด</div></div><button class="section-link" onclick="go('contracts')">ทั้งหมด</button></div>
 ${db.contracts.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,3).map(contractCard).join("")||`<div class="empty"><div class="empty-icon">+</div><strong>เริ่มสร้างสัญญาแรก</strong><div class="sub">กด + ได้ทันที ไม่ต้องสร้างลูกค้าก่อน</div></div>`}</section>`;
}
function contractCard(c){
 const r=remaining(c),pc=pct(c),cu=customer(c.customerId),s=status(c);
 return `<div class="card"><div class="card-head"><div><div class="card-title">${esc(c.name)}</div><div class="muted tiny">${esc(cu?.name||"ไม่ระบุลูกค้า")}</div></div><span class="pill ${overdue(c)?"overdue":""}">${s}</span></div>
 <div class="progress"><i style="width:${pc}%"></i></div><div class="progress-row"><span>${pc}% ชำระแล้ว</span><strong>${money(r)}</strong></div>
 <div class="card-footer"><span class="muted tiny">${r>0?"งวดถัดไป "+dateTH(c.dueDate):"ปิดสัญญาแล้ว"}</span><div class="actions" style="margin:0"><button class="btn primary" onclick="payment('${c.id}')">${r>0?"รับชำระ":"รายการ"}</button><button class="btn" onclick="detail('${c.id}')">รายละเอียด</button></div></div></div>`;
}
function contracts(){
 const arr=db.contracts.filter(c=>filter==="active"?remaining(c)>0:filter==="paid"?remaining(c)<=0:true);
 view.innerHTML=`<div class="tabs"><button class="tab ${filter==="active"?"active":""}" onclick="filter='active';render()">กำลังผ่อน</button><button class="tab ${filter==="all"?"active":""}" onclick="filter='all';render()">ทั้งหมด</button><button class="tab ${filter==="paid"?"active":""}" onclick="filter='paid';render()">ชำระครบ</button></div>
 ${arr.map(contractCard).join("")||`<div class="empty"><div class="empty-icon">+</div><strong>ไม่พบสัญญา</strong><div class="sub">กด + เพื่อสร้างสัญญา</div></div>`}`;
}
function customers(){
 view.innerHTML=`<div class="section-head"><div><div class="kicker">CUSTOMERS</div><div class="section-title">ลูกค้า <span class="sub">${db.customers.length}</span></div></div></div>
 ${db.customers.map(c=>`<div class="card"><div class="card-head"><div><div class="card-title">${esc(c.name)}</div><div class="muted">${esc(c.phone||"ไม่มีเบอร์โทร")}</div></div><button class="btn" onclick="customerForm('${c.id}')">ข้อมูล</button></div>
 <div class="list-row"><span class="muted">สัญญา</span><strong>${db.contracts.filter(x=>x.customerId===c.id).length} รายการ</strong></div></div>`).join("")||`<div class="empty"><div class="empty-icon">+</div><strong>ยังไม่มีลูกค้า</strong><div class="sub">ไม่จำเป็นต้องสร้างก่อนสร้างสัญญา</div></div>`}`;
}
function settings(){
 view.innerHTML=`<div class="card"><div class="kicker">DATA</div><div class="section-title" style="margin-top:7px">ข้อมูลของคุณ</div><p class="muted">เก็บไว้ในเครื่องนี้ ไม่ต้องสมัครสมาชิก</p><div class="actions"><button class="btn primary" onclick="exportJSON()">ส่งออกข้อมูล</button><button class="btn" onclick="document.getElementById('importFile').click()">นำเข้าข้อมูล</button></div></div>
 <div class="card"><div class="kicker">SAFETY</div><div class="section-title" style="margin-top:7px">สำรองข้อมูล</div><p class="muted">แนะนำให้ส่งออก JSON ก่อนเปลี่ยนเครื่องหรือเคลียร์ข้อมูล</p><button class="btn danger" onclick="resetAll()">ล้างข้อมูลทั้งหมด</button></div>
 <div class="card"><div class="kicker">APP</div><div class="section-title" style="margin-top:7px">PayNest v1</div><p class="muted">โครงสร้างเดียว • ใช้งานบนมือถือ • พร้อมใช้บน GitHub Pages</p></div>`;
}
function openModal(title,body){modal.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="close" onclick="closeModal()">×</button></div>${body}</div></div>`}
function closeModal(){modal.innerHTML=""}

function customerForm(id){
 const c=id?customer(id):null;
 openModal(id?"ข้อมูลลูกค้า":"เพิ่มลูกค้า",`<form id="customerForm" class="form">
 <div class="field"><label>ชื่อลูกค้า</label><input id="cn" required value="${esc(c?.name||"")}" placeholder="เช่น คุณสมชาย"></div>
 <div class="field"><label>เบอร์โทร</label><input id="cp" inputmode="tel" value="${esc(c?.phone||"")}" placeholder="08xxxxxxxx"></div>
 <div class="field"><label>หมายเหตุ</label><input id="ct" value="${esc(c?.note||"")}" placeholder="หมายเหตุ"></div>
 <button class="btn primary" type="submit">${id?"บันทึกข้อมูล":"เพิ่มลูกค้า"}</button>${id?`<button type="button" class="btn danger" onclick="deleteCustomer('${id}')">ลบลูกค้า</button>`:""}</form>`);
 document.getElementById("customerForm").onsubmit=e=>{e.preventDefault();const data={name:document.getElementById("cn").value.trim(),phone:document.getElementById("cp").value.trim(),note:document.getElementById("ct").value.trim()};if(!data.name)return;if(c)Object.assign(c,data);else db.customers.push({id:uid("cus"),...data,createdAt:Date.now()});save();closeModal();render()}
}
function deleteCustomer(id){if(db.contracts.some(c=>c.customerId===id)){alert("ลูกค้านี้มีสัญญาอยู่ จึงยังลบไม่ได้");return}if(confirm("ลบลูกค้านี้หรือไม่?")){db.customers=db.customers.filter(c=>c.id!==id);save();closeModal();render()}}

function inlineNewCustomer(){
 const name=prompt("ชื่อลูกค้าใหม่");
 if(!name||!name.trim())return;
 const phone=prompt("เบอร์โทร (ถ้ามี)")||"";
 const c={id:uid("cus"),name:name.trim(),phone:phone.trim(),note:"",createdAt:Date.now()};
 db.customers.push(c);save();
 const select=document.getElementById("contractCustomer");
 if(select){select.innerHTML=db.customers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");select.value=c.id}
}

function contractForm(id){
 const c=id?db.contracts.find(x=>x.id===id):null;
 const customerOptions=db.customers.map(x=>`<option value="${x.id}" ${x.id===c?.customerId?"selected":""}>${esc(x.name)}</option>`).join("");
 const paymentType=c?.paymentType||"monthly";
 openModal(id?"แก้ไขสัญญา":"สร้างสัญญา",`<form id="contractForm" class="form">
 <div class="notice">สร้างสัญญาได้ทันที <strong>ไม่ต้องสร้างลูกค้าก่อน</strong> — ถ้ายังไม่มีลูกค้า กด “+ ลูกค้าใหม่” ได้จากหน้านี้</div>
 <div class="field"><label>สินค้า / ชื่อสัญญา</label><input id="contractName" required value="${esc(c?.name||"")}" placeholder="เช่น iPhone 16 Pro"></div>
 <div class="field"><label>ลูกค้า</label><div class="inline-add"><select id="contractCustomer" ${db.customers.length?"":"disabled"}>${customerOptions}</select><button type="button" class="btn" onclick="inlineNewCustomer()">+ ลูกค้าใหม่</button></div></div>
 <div class="field"><label>ยอดรวม</label><input id="contractTotal" required type="number" min="0.01" step=".01" inputmode="decimal" value="${c?.total??""}" placeholder="0"></div>
 <div class="field"><label>รับแล้วตอนเริ่ม</label><input id="contractInitial" type="number" min="0" step=".01" inputmode="decimal" value="${c?.initialPaid??0}" placeholder="0"></div>
 <div class="field"><label>รูปแบบการผ่อน</label><select id="paymentType"><option value="daily" ${paymentType==="daily"?"selected":""}>รายวัน</option><option value="weekly" ${paymentType==="weekly"?"selected":""}>รายสัปดาห์</option><option value="monthly" ${paymentType==="monthly"?"selected":""}>รายเดือน</option></select></div>
 <div class="field"><label>จำนวนงวด</label><input id="installmentCount" type="number" min="1" step="1" value="${c?.installmentCount??1}"></div>
 <div class="field"><label>จำนวนเงินต่องวด</label><input id="installmentAmount" type="number" min="0" step=".01" value="${c?.installmentAmount??""}" placeholder="คำนวณอัตโนมัติ"></div>
 <div class="field"><label>วันเริ่มสัญญา</label><input id="startDate" type="date" value="${c?.startDate||today()}"></div>
 <div class="field"><label>งวดถัดไป</label><input id="dueDate" type="date" value="${c?.dueDate||today()}"></div>
 <button class="btn primary" type="submit">${id?"บันทึกสัญญา":"สร้างสัญญา"}</button>
 ${id?`<button type="button" class="btn danger" onclick="deleteContract('${id}')">ลบสัญญา</button>`:""}</form>`);
 const totalEl=document.getElementById("contractTotal"), initialEl=document.getElementById("contractInitial"), countEl=document.getElementById("installmentCount"), amountEl=document.getElementById("installmentAmount");
 function calcInstallment(){const total=Number(totalEl.value||0),initial=Number(initialEl.value||0),count=Math.max(1,Number(countEl.value||1));if(!amountEl.value||amountEl.dataset.auto==="1"){amountEl.value=Math.max(0,(total-initial)/count||0).toFixed(2);amountEl.dataset.auto="1"}}
 [totalEl,initialEl,countEl].forEach(x=>x.addEventListener("input",calcInstallment));amountEl.addEventListener("input",()=>amountEl.dataset.auto="0");calcInstallment();
 document.getElementById("contractForm").onsubmit=e=>{
  e.preventDefault();
  const name=document.getElementById("contractName").value.trim(),customerId=document.getElementById("contractCustomer").value,total=Number(totalEl.value||0),initial=Math.min(Math.max(0,Number(initialEl.value||0)),total),count=Math.max(1,Number(countEl.value||1)),type=document.getElementById("paymentType").value,installment=Number(amountEl.value||0),start=document.getElementById("startDate").value||today(),due=document.getElementById("dueDate").value||start;
  if(!name||!total){alert("กรอกชื่อสัญญาและยอดรวมก่อน");return}
  if(!customerId){alert("เลือกหรือเพิ่มลูกค้าก่อนบันทึกสัญญา");return}
  const data={name,customerId,total,initialPaid:initial,paymentType:type,installmentCount:count,installmentAmount:installment,startDate:start,dueDate:due};
  if(id)Object.assign(c,data);else{const con={id:uid("con"),...data,createdAt:Date.now()};db.contracts.push(con);if(initial>0)db.payments.push({id:uid("pay"),contractId:con.id,amount:initial,date:start,kind:"initial",createdAt:Date.now()})}
  save();closeModal();render();
 }
}
function deleteContract(id){if(!confirm("ลบสัญญานี้พร้อมประวัติการรับชำระหรือไม่?"))return;db.contracts=db.contracts.filter(c=>c.id!==id);db.payments=db.payments.filter(p=>p.contractId!==id);save();closeModal();render()}

function payment(id){
 const c=db.contracts.find(x=>x.id===id),r=remaining(c);
 if(r<=0){detail(id);return}
 openModal("รับชำระ",`<div class="notice"><strong>${esc(c.name)}</strong><br>คงเหลือ <strong>${money(r)}</strong><br><span class="sub">${typeLabel(c.paymentType)} • งวดละ ${money(c.installmentAmount||0)}</span></div>
 <div class="quick-grid"><button class="quick" onclick="setPay(${Math.min(r,c.installmentAmount||r)})">เต็มงวด</button><button class="quick" onclick="setPay(${r})">ปิดยอด</button><button class="quick" onclick="setPay(0)">กำหนดเอง</button></div>
 <form id="paymentForm" class="form" style="margin-top:15px"><div class="field"><label>จำนวนเงิน</label><input id="payAmount" required type="number" min=".01" max="${r}" step=".01" value="${Math.min(r,c.installmentAmount||r)}"></div><div class="field"><label>วันที่รับ</label><input id="payDate" required type="date" value="${today()}"></div><button class="btn primary">ยืนยันรับชำระ</button></form>`);
 window.setPay=n=>{document.getElementById("payAmount").value=n||"";document.getElementById("payAmount").focus()};
 document.getElementById("paymentForm").onsubmit=e=>{
  e.preventDefault();const amount=Number(document.getElementById("payAmount").value);if(amount<=0||amount>remaining(c)+.001){alert("จำนวนเงินไม่ถูกต้อง");return}
  db.payments.push({id:uid("pay"),contractId:id,amount,date:document.getElementById("payDate").value,kind:"payment",createdAt:Date.now()});
  if(remaining(c)-amount<.01)c.dueDate="";
  else c.dueDate=addPeriod(c.dueDate||today(),c.paymentType||"monthly");
  save();closeModal();render();
 }
}
function detail(id){
 const c=db.contracts.find(x=>x.id===id),p=paid(c),r=remaining(c),cu=customer(c.customerId),history=db.payments.filter(x=>x.contractId===id).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 openModal("รายละเอียดสัญญา",`<div class="card" style="margin:0"><div class="card-head"><div><div class="card-title">${esc(c.name)}</div><div class="muted">${esc(cu?.name||"-")}</div></div><span class="pill">${status(c)}</span></div>
 <div class="detail-grid" style="margin-top:16px"><div class="detail-box"><small>ยอดรวม</small><strong>${money(c.total)}</strong></div><div class="detail-box"><small>รับแล้ว</small><strong>${money(p)}</strong></div><div class="detail-box"><small>คงเหลือ</small><strong>${money(r)}</strong></div><div class="detail-box"><small>รูปแบบ</small><strong>${typeLabel(c.paymentType)} • ${c.installmentCount||1} งวด</strong></div><div class="detail-box"><small>ต่องวด</small><strong>${money(c.installmentAmount||0)}</strong></div><div class="detail-box"><small>งวดถัดไป</small><strong>${r?dateTH(c.dueDate):"-"}</strong></div></div>
 <div class="actions"><button class="btn primary" onclick="closeModal();payment('${id}')">${r?"รับชำระ":"ดูรายการ"}</button><button class="btn" onclick="closeModal();contractForm('${id}')">แก้ไข</button></div></div>
 <div class="section"><div class="kicker">PAYMENTS</div>${history.map(x=>`<div class="list-row"><span>${dateTH(x.date)}${x.kind==="initial"?" • เงินเริ่มต้น":""}</span><strong>${money(x.amount)}</strong></div>`).join("")||`<div class="empty">ยังไม่มีประวัติการรับชำระ</div>`}</div>`)
}
function exportJSON(){const b=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`PayNest-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
document.getElementById("importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=normalize(JSON.parse(r.result));save();render();alert("นำเข้าข้อมูลสำเร็จ")}catch(err){alert("ไฟล์ข้อมูลไม่ถูกต้อง")}e.target.value=""};r.readAsText(f)}
function resetAll(){if(confirm("ล้างข้อมูลทั้งหมดจริงหรือไม่?")){db=clone(EMPTY);save();render()}}
Object.assign(window,{go,render,customerForm,contractForm,payment,detail,deleteCustomer,deleteContract,closeModal,exportJSON,resetAll});
render();
