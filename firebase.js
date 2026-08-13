// PayNest — Firebase Initialization
// STEP 4.2
// Firebase Authentication
//
// IMPORTANT:
// - Firebase initialization remains unchanged.
// - Email/Password Authentication is connected.
// - Firestore Sync is NOT added in this step.
// - UI and existing PayNest logic are NOT changed.

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";


/* ===================================
   Firebase Configuration
=================================== */

const firebaseConfig = {
    apiKey: "AIzaSyCGc0iB3dZe_CZe8vLfEuPwgnn5XCgI5gs",
    authDomain: "paynest-cloud.firebaseapp.com",
    projectId: "paynest-cloud",
    storageBucket: "paynest-cloud.firebasestorage.app",
    messagingSenderId: "469151372030",
    appId: "1:469151372030:web:625320d22038fe42484baf"
};


/* ===================================
   Firebase App
=================================== */

export const firebaseApp =
    initializeApp(firebaseConfig);


/* ===================================
   Firebase Authentication
=================================== */

export const auth =
    getAuth(firebaseApp);


/* ===================================
   Authentication Helpers
=================================== */

export {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
};