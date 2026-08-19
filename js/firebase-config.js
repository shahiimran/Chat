/* Path: js/firebase-config.js */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCyqldkcpWoJCK6uPhffDn0M9LdBXWujwU",
  authDomain: "room-chat-6b630.firebaseapp.com",
  projectId: "room-chat-6b630",
  storageBucket: "room-chat-6b630.firebasestorage.app",
  messagingSenderId: "974436712918",
  appId: "1:974436712918:web:1f591671d688e2c2c0e477",
  measurementId: "G-LJBDGPP5K2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);