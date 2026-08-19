/* Path: js/user.js */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Check if user is logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!user.emailVerified) {
            // Send back to verify page if they aren't verified
            window.location.href = "verify-email.html";
            return;
        }

        // Fetch User Data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('userNameDisplay').innerText = userData.username;
            document.getElementById('userAvatar').innerText = userData.username[0].toUpperCase();
        }
    } else {
        // Not logged in? Send to login
        window.location.href = "login.html";
    }
});

// Logout Logic
const logoutBtn = document.getElementById('logoutBtn');
if(logoutBtn) {
    logoutBtn.onclick = async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = "login.html";
    };
}