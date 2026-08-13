// PayNest — Firebase Initialization
// STEP 4.1
// Firebase initialization only.
// Authentication and Firestore Sync will be added in later steps.

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGc0iB3dZe_CZe8vLfEuPwgnn5XCgI5gs",
    authDomain: "paynest-cloud.firebaseapp.com",
    projectId: "paynest-cloud",
    storageBucket: "paynest-cloud.firebasestorage.app",
    messagingSenderId: "469151372030",
    appId: "1:469151372030:web:625320d22038fe42484baf"
};

export const firebaseApp = initializeApp(firebaseConfig);
