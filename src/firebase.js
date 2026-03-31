import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxoMQYwhTtGS9mQxIlRSKdq6tS9abXhXo",
  authDomain: "agromonitor-d389e.firebaseapp.com",
  projectId: "agromonitor-d389e",
  storageBucket: "agromonitor-d389e.firebasestorage.app",
  messagingSenderId: "301802649161",
  appId: "1:301802649161:web:eb351e8e47d14b79b4f198"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
