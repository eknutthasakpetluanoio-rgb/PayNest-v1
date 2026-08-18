import {loadData,saveLocalData,resetData,exportData,importData} from "./js/data/storage.js";
import {normalizeData} from "./js/data/normalize.js";
import {getCloudData,setCloudData,startRealtimeSync,stopRealtimeSync} from "./js/services/firestore-sync.js";
import {watchAuth} from "./js/services/auth.js";
import {registerPWA} from "./js/pwa/register.js";
import {recalculateContract,remaining,getStatus,getInstallmentSchedule} from "./js/core/calculations.js";
import {money,escapeHtml,uid,localToday} from "./js/core/utils.js";

export const state={data:loadData(),page:"home",currentContractId:null,currentCustomerId:null,user:null,cloudReady:false,syncWriting:false};

export function persistLocal(){state.data=saveLocalData(state.data);}
export async function persist(){persistLocal();if(!state.user||state.syncWriting)return;state.syncWriting=true;try{await setCloudData(state.data,state.user.uid);}finally{state.syncWriting=false;}}

async function bootstrapCloud(user){
 state.user=user; const cloud=await getCloudData(user.uid);
 if(cloud){state.data=normalizeData(cloud);persistLocal();state.cloudReady=true;startRealtimeSync({uid:user.uid,onData:data=>{if(state.syncWriting)return;state.data=normalizeData(data);persistLocal();render();},onError:console.error});render();return;}
 state.cloudReady=false;render();
}
export const customerById=id=>state.data.customers.find(c=>c.id===id)||null;
export const contractById=id=>state.data.contracts.find(c=>c.id===id)||null;

export function render(){
 const app=document.querySelector("#app"); if(!app)return;
 const cs=state.data.contracts.map(c=>recalculateContract(state.data,c));
 const total=cs.reduce((s,c)=>s+Number(c.total||0),0),received=cs.reduce((s,c)=>s+Number(c.received||0),0),due=Math.max(0,total-received);
 app.innerHTML=`<main class="pn-shell"><header class="pn-header"><div><div class="pn-eyebrow">PayNest v1</div><h1>ระบบจัดการผ่อนชำระ</h1></div><button id="addContract" class="pn-btn">+ สัญญาใหม่</button></header>
 <section class="pn-hero"><span>ยอดคงเหลือรวม</span><strong>${money(due)}</strong><small>${cs.length} สัญญา · ${state.data.customers.length} ลูกค้า</small></section>
 <section class="pn-stats"><div><span>พอร์ต</span><strong>${money(total)}</strong></div><div><span>รับแล้ว</span><strong>${money(received)}</strong></div><div><span>คงเหลือ</span><strong>${money(due)}</strong></div></section>
 <section><h2>สัญญาล่าสุด</h2><div class="pn-list">${cs.length?cs.map(c=>`<article class="pn-card" data-contract="${c.id}"><div><strong>${escapeHtml(c.product||"ไม่ระบุสินค้า")}</strong><p>${escapeHtml(c.customerName||customerById(c.customerId)?.name||"ไม่ระบุลูกค้า")}</p></div><div class="pn-card-right"><strong>${money(c.remaining)}</strong><small>${getStatus(state.data,c)==="paid"?"ชำระครบ":"กำลังผ่อน"}</small></div></article>`).join(""):`<div class="pn-empty">ยังไม่มีสัญญา</div>`}</div></section>
 ${!state.cloudReady&&state.user?`<section class="pn-notice"><strong>บัญชี Cloud ใหม่</strong><p>ข้อมูลในเครื่องยังไม่ถูกส่งขึ้นบัญชีนี้โดยอัตโนมัติ</p><button id="uploadLocal" class="pn-btn">ใช้ข้อมูลจากเครื่องนี้</button><button id="startFresh" class="pn-btn secondary">เริ่มข้อมูลใหม่</button></section>`:""}
 <nav class="pn-nav"><button data-page="home">หน้าหลัก</button><button data-page="contracts">สัญญา</button><button data-page="customers">ลูกค้า</button><button data-page="settings">ตั้งค่า</button></nav></main>`;
 document.querySelector("#addContract")?.addEventListener("click",()=>alert("ขั้นถัดไป: ย้าย Contract UI เดิมเข้ามาโดยไม่เปลี่ยน Data Model"));
 document.querySelector("#uploadLocal")?.addEventListener("click",async()=>{await persist();state.cloudReady=true;render();});
 document.querySelector("#startFresh")?.addEventListener("click",async()=>{state.data=normalizeData({});persistLocal();await persist();state.cloudReady=true;render();});
 document.querySelectorAll("[data-contract]").forEach(el=>el.addEventListener("click",()=>{state.currentContractId=el.dataset.contract;console.log(contractById(state.currentContractId),getInstallmentSchedule(state.data,contractById(state.currentContractId)));}));
}
watchAuth(user=>{stopRealtimeSync();state.user=user;if(user)bootstrapCloud(user).catch(console.error);else{state.cloudReady=false;render();}});
registerPWA();render();
export {resetData,exportData,importData,remaining,getStatus,uid,localToday};
