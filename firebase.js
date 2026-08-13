// PayNest — Firebase Authentication + Firestore

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGc0iB3dZe_CZe8vLfEuPwgnn5XCgI5gs",
  authDomain: "paynest-cloud.firebaseapp.com",
  projectId: "paynest-cloud",
  storageBucket: "paynest-cloud.firebasestorage.app",
  messagingSenderId: "469151372030",
  appId: "1:469151372030:web:625320d22038fe42484baf"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
};
