/* Path: js/notifications.js */
import { auth, db } from './firebase-config.js';
import {
    collection, query, where, orderBy, limit, onSnapshot,
    doc, updateDoc, writeBatch, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Icon + color per notification type
const TYPE_META = {
    friend_request: { icon: "fa-user-plus", color: "var(--accent)" },
    friend_accept: { icon: "fa-user-check", color: "var(--success)" },
    message: { icon: "fa-envelope", color: "var(--accent)" },
    system: { icon: "fa-bell", color: "var(--text-gray)" },
    report: { icon: "fa-flag", color: "var(--error)" }
};

function timeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    const units = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
    for (const [label, secs] of units) {
        const val = Math.floor(seconds / secs);
        if (val >= 1) return `${val}${label} ago`;
    }
    return "just now";
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Badge / list simply stay empty when logged out; pages that require
        // auth already redirect via their own page script (user.js etc).
        return;
    }

    const badgeEls = document.querySelectorAll('.notif-badge');
    const listEl = document.getElementById('notificationList');
    const emptyEl = document.getElementById('notifEmpty');

    const q = query(
        collection(db, "notifications"),
        where("to", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(30)
    );

    onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        const docs = [];

        snapshot.forEach((d) => {
            const data = d.data();
            if (!data.read) unreadCount++;
            docs.push({ id: d.id, ...data });
        });

        // Update every badge on the page (sidebar bell, mobile nav, etc.)
        badgeEls.forEach(badge => {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
                badge.style.display = "inline-flex";
            } else {
                badge.style.display = "none";
            }
        });

        // Render full list only on pages that have it (notifications.html)
        if (listEl) {
            if (docs.length === 0) {
                listEl.innerHTML = "";
                if (emptyEl) emptyEl.classList.remove('hidden');
                return;
            }
            if (emptyEl) emptyEl.classList.add('hidden');

            listEl.innerHTML = docs.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.system;
                const when = n.createdAt && n.createdAt.toDate ? timeAgo(n.createdAt.toDate()) : "";
                return `
                    <a href="${n.link || '#'}" class="notif-row ${n.read ? '' : 'unread'}" data-id="${n.id}">
                        <div class="notif-icon" style="color:${meta.color};"><i class="fas ${meta.icon}"></i></div>
                        <div class="notif-body">
                            <p>${n.text}</p>
                            <span class="notif-time">${when}</span>
                        </div>
                        ${n.read ? '' : '<span class="notif-dot"></span>'}
                    </a>
                `;
            }).join("");

            listEl.querySelectorAll('.notif-row').forEach(row => {
                row.addEventListener('click', () => markAsRead(row.dataset.id));
            });
        }
    });

    // Mark-all-read button (optional on page)
    const markAllBtn = document.getElementById('markAllReadBtn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            const unreadQ = query(collection(db, "notifications"), where("to", "==", user.uid), where("read", "==", false));
            const snap = await getDocs(unreadQ);
            if (snap.empty) return;
            const batch = writeBatch(db);
            snap.forEach(d => batch.update(d.ref, { read: true }));
            await batch.commit();
        });
    }
});

async function markAsRead(id) {
    try {
        await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
        console.error("Couldn't mark notification as read:", err);
    }
}
