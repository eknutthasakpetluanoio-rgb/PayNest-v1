import { doc,getDoc,setDoc,onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { auth,db } from "./firebase.js"; import { normalizeData } from "../data/normalize.js";
let unsubscribe=null; const ref=uid=>doc(db,"users",uid||auth.currentUser?.uid);
export async function getCloudData(uid){const s=await getDoc(ref(uid));return s.exists()?normalizeData(s.data()):null;}
export async function setCloudData(data,uid){const n=normalizeData(data);await setDoc(ref(uid),n,{merge:false});return n;}
export function startRealtimeSync({uid,onData,onError}){stopRealtimeSync();unsubscribe=onSnapshot(ref(uid),s=>{if(s.exists())onData?.(normalizeData(s.data()));},onError);return unsubscribe;}
export function stopRealtimeSync(){if(unsubscribe)unsubscribe();unsubscribe=null;}
