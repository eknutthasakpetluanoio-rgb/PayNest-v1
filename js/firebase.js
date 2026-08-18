import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const firebaseConfig={apiKey:"REPLACE_ME",authDomain:"REPLACE_ME",projectId:"REPLACE_ME",storageBucket:"REPLACE_ME",messagingSenderId:"REPLACE_ME",appId:"REPLACE_ME"};
export const firebaseApp=initializeApp(firebaseConfig); export const auth=getAuth(firebaseApp); export const db=getFirestore(firebaseApp);
