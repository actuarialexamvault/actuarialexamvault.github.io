// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6Cpy6B93PJ0PCz2AFnXsamOZPbcjQ8es",
  authDomain: "actuarial-exam-vault.firebaseapp.com",
  projectId: "actuarial-exam-vault",
  storageBucket: "actuarial-exam-vault.firebasestorage.app",
  messagingSenderId: "379007344204",
  appId: "1:379007344204:web:43bdc1e7678aa7b55d1ee9",
  measurementId: "G-C1XBWZS57L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log('Firebase initialized successfully');
