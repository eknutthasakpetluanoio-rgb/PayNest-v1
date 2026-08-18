import { PAYMENT_TYPES,CONTRACT_STATUS } from "./constants.js";
import { parseLocalDate,toDateKey } from "./utils.js";
export function addPeriod(v,type){const d=parseLocalDate(v);if(type===PAYMENT_TYPES.DAILY)d.setDate(d.getDate()+1);else if(type===PAYMENT_TYPES.WEEKLY)d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1);return toDateKey(d);}
export function getPaymentsForContract(data,id){return data.payments.filter(p=>p.contractId===id).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));}
export function totalReceived(data,id){return getPaymentsForContract(data,id).reduce((s,p)=>s+(Number(p.amount)||0),0);}
export function remaining(data,c){return Math.max(0,(Number(c.total)||0)-totalReceived(data,c.id));}
export function getStatus(data,c){return remaining(data,c)<=0?CONTRACT_STATUS.PAID:CONTRACT_STATUS.ACTIVE;}
export function getInstallmentSchedule(data,c){const n=Math.max(0,Number(c.installments)||0),a=Number(c.installmentAmount)||0;let due=c.startDate;return Array.from({length:n},(_,i)=>{if(i>0)due=addPeriod(due,c.paymentType);return{installmentNo:i+1,dueDate:due,amount:i===n-1?Math.max(0,Number(c.total)-a*(n-1)):a};});}
export function recalculateContract(data,c){const received=totalReceived(data,c.id),left=Math.max(0,Number(c.total)-received);return {...c,received,remaining:left,status:left<=0?CONTRACT_STATUS.PAID:CONTRACT_STATUS.ACTIVE};}
export function getNextInstallment(data,c){const s=getInstallmentSchedule(data,c),p=getPaymentsForContract(data,c.id),paid=p.filter(x=>x.installmentNo!=null).length;return s[paid]||null;}
