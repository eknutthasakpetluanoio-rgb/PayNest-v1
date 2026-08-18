import { SCHEMA_VERSION } from "../core/constants.js";
import { createDefaultData } from "./default-data.js";
import { clone } from "../core/utils.js";
export function migrateData(input){
 const raw=input&&typeof input==="object"?clone(input):{}; const base=createDefaultData();
 return {...base,...raw,customers:Array.isArray(raw.customers)?raw.customers:[],contracts:Array.isArray(raw.contracts)?raw.contracts:[],payments:Array.isArray(raw.payments)?raw.payments:[],settings:raw.settings&&typeof raw.settings==="object"?raw.settings:{},schemaVersion:SCHEMA_VERSION};
}
