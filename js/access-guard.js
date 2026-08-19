/* Path: js/access-guard.js */
import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * Ensures the signed-in user's Firestore `role` is one of `allowedRoles`
 * before letting the calling page continue. Redirects to login if signed
 * out, or to `redirectTo` if the role doesn't match.
 *
 * IMPORTANT: this only hides/redirects the page in the browser. It is NOT
 * real security on its own — anyone can still call the Firestore SDK
 * directly from the browser console. Real enforcement must come from
 * Firestore Security Rules that check request.auth and the user's role
 * document server-side. Use this together with rules, not instead of them.
 */
export function requireRole(allowedRoles, redirectTo = "../home.html") {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = "../login.html";
                return;
            }
            const snap = await getDoc(doc(db, "users", user.uid));
            const role = snap.exists() ? (snap.data().role || "user") : "user";

            if (!allowedRoles.includes(role)) {
                alert("You don't have access to this section.");
                window.location.href = redirectTo;
                return;
            }
            resolve({ user, role });
        });
    });
}
