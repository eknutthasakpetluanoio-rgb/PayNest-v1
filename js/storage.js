import { STORAGE_KEY } from "../core/constants.js";
import { createDefaultData } from "./default-data.js";
import { normalizeData } from "./normalize.js";
export function loadData(){try{const r=localStorage.getItem(STORAGE_KEY);return r?normalizeData(JSON.parse(r)):createDefaultData();}catch{return createDefaultData();}}
export function saveLocalData(data){const n=normalizeData(data);localStorage.setItem(STORAGE_KEY,JSON.stringify(n));return n;}
export function resetData(){const d=createDefaultData();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));return d;}
export function exportData(data){const b=new Blob([JSON.stringify(normalizeData(data),null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`paynest-v1-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);}
export async function importData(file){return normalizeData(JSON.parse(await file.text()));}
