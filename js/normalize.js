import { migrateData } from "./migrations.js";
import { uid } from "../core/utils.js";
export function normalizeData(input){
 const d=migrateData(input);
 d.customers=d.customers.map(c=>({id:c.id||uid("cus"),name:String(c.name||"").trim(),phone:String(c.phone||"").trim(),note:String(c.note||""),createdAt:c.createdAt||new Date().toISOString(),...c}));
 d.contracts=d.contracts.map(c=>({id:c.id||uid("con"),customerId:c.customerId||null,customerName:String(c.customerName||"").trim(),product:String(c.product||"").trim(),total:Number(c.total)||0,installmentAmount:Number(c.installmentAmount)||0,installments:Math.max(0,Number(c.installments)||0),paymentType:c.paymentType||"monthly",startDate:c.startDate||null,status:c.status||"active",note:String(c.note||""),createdAt:c.createdAt||new Date().toISOString(),...c}));
 d.payments=d.payments.map(p=>({id:p.id||uid("pay"),contractId:p.contractId||null,amount:Number(p.amount)||0,date:p.date||null,note:String(p.note||""),installmentNo:p.installmentNo??null,createdAt:p.createdAt||new Date().toISOString(),...p}));
 return d;
}
