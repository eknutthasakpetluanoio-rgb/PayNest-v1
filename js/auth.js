import { createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { auth } from "./firebase.js";
export const register=(email,password)=>createUserWithEmailAndPassword(auth,email,password);
export const login=(email,password)=>signInWithEmailAndPassword(auth,email,password);
export const logout=()=>signOut(auth);
export const watchAuth=cb=>onAuthStateChanged(auth,cb);
