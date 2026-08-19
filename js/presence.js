/* Path: js/presence.js */
import { auth, db } from './firebase-config.js';
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Lightweight "online status" without Firebase Realtime Database:
// every open tab pings its own lastActive timestamp on a timer. Anyone
// whose timestamp is recent enough (< ONLINE_THRESHOLD_MS) counts as
// online. This can lag by up to ~90s on a closed tab/lost connection
// (Firestore has no onDisconnect like Realtime DB does) but needs no
// extra Firebase product and is good enough for a "green dot" indicator.

const HEARTBEAT_MS = 45000;
export const ONLINE_THRESHOLD_MS = 90000;

let heartbeatTimer = null;

function beat(uid) {
    updateDoc(doc(db, "users", uid), { lastActive: serverTimestamp() }).catch(() => {});
}

onAuthStateChanged(auth, (user) => {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (!user) return;

    beat(user.uid);
    heartbeatTimer = setInterval(() => beat(user.uid), HEARTBEAT_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') beat(user.uid);
    });
});

/** True if a Firestore Timestamp/Date is recent enough to count as "online". */
export function isOnline(lastActive) {
    if (!lastActive) return false;
    const date = lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
    return (Date.now() - date.getTime()) < ONLINE_THRESHOLD_MS;
}

/** Small reusable status-dot HTML snippet for avatars/lists. */
export function statusDotHtml(lastActive, extraStyle = "") {
    const online = isOnline(lastActive);
    return `<span class="status-dot ${online ? 'online' : 'offline'}" style="${extraStyle}" title="${online ? 'Online' : 'Offline'}"></span>`;
}
