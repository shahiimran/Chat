/* Path: js/settings.js */
import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut, sendPasswordResetEmail, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { normalizeUsername } from './username-check.js';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (document.getElementById('showEmailToggle')) {
            loadPrivacySettings(user.uid);
        }
    } else {
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = "login.html";
        }
    }
});

// 1. Logout for Settings Page
const logoutBtn = document.getElementById('settingsLogout');
if(logoutBtn) {
    logoutBtn.onclick = () => signOut(auth).then(() => window.location.href = "login.html");
}

// 2. Privacy Settings Logic
async function loadPrivacySettings(uid) {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
        const data = userSnap.data();
        document.getElementById('showEmailToggle').checked = data.showEmail || false;
        document.getElementById('privateProfileToggle').checked = data.privateProfile || false;
    }
}

const savePrivacyBtn = document.getElementById('savePrivacy');
if(savePrivacyBtn) {
    savePrivacyBtn.onclick = async () => {
        const user = auth.currentUser;
        await updateDoc(doc(db, "users", user.uid), {
            showEmail: document.getElementById('showEmailToggle').checked,
            privateProfile: document.getElementById('privateProfileToggle').checked
        });
        alert("Privacy settings updated!");
    };
}

// 3. Security Logic (Password Reset)
const resetBtn = document.getElementById('securityResetPass');
if(resetBtn) {
    resetBtn.onclick = async () => {
        const user = auth.currentUser;
        await sendPasswordResetEmail(auth, user.email);
        alert("A password reset link has been sent to " + user.email);
    };
}

// 4. Delete Account (Danger!)
const deleteBtn = document.getElementById('deleteAccountBtn');
if(deleteBtn) {
    deleteBtn.onclick = async () => {
        if(confirm("Are you absolutely sure? This cannot be undone.")) {
            const user = auth.currentUser;
            // 1. Release their username reservation, if any
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists() && userSnap.data().username) {
                await deleteDoc(doc(db, "usernames", normalizeUsername(userSnap.data().username))).catch(() => {});
            }
            // 2. Delete from Firestore
            await deleteDoc(doc(db, "users", user.uid));
            // 3. Delete from Auth
            deleteUser(user).then(() => {
                alert("Account deleted.");
                window.location.href = "index.html";
            }).catch(() => {
                alert("Please log out and log back in to perform this sensitive action.");
            });
        }
    };
}