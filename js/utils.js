export const uid=(prefix="id")=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
export function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
export function parseLocalDate(v){if(v instanceof Date)return new Date(v);const [y,m,d]=String(v||localToday()).slice(0,10).split("-").map(Number);return new Date(y||1970,(m||1)-1,d||1);}
export function toDateKey(v){const d=parseLocalDate(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
export const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
export const money=v=>new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
export const escapeHtml=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
