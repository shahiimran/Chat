/* Path: js/admin-broadcast.js */
import { db } from './firebase-config.js';
import { requireRole } from './access-guard.js';
import {
    collection, getDocs, addDoc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chosenUids = new Map(); // uid -> username, for the "choose specific users" picker
let adminUid = null;

requireRole(["admin"]).then(({ user }) => {
    adminUid = user.uid;
    setupRoomsBroadcast();
    setupNotificationBroadcast();
    setupUserPicker();
});

function showNotice(el, message, type = "error") {
    el.innerHTML = `<i class="fas fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i><span>${message}</span>`;
    el.className = `status-msg ${type === 'error' ? 'error-msg' : 'success-msg'}`;
    el.classList.remove('hidden');
}

// ---------- 1. Broadcast into every chat room ----------
function setupRoomsBroadcast() {
    const btn = document.getElementById('sendRoomsBc');
    const textEl = document.getElementById('roomsBcText');
    const notice = document.getElementById('roomsBcNotice');

    btn.addEventListener('click', async () => {
        const text = textEl.value.trim();
        if (!text) return;

        btn.disabled = true;
        const label = btn.querySelector('.btn-label');
        label.innerHTML = `<span class="spinner"></span> Sending...`;

        try {
            const payload = () => ({
                text: text,
                senderId: adminUid,
                senderName: "📢 Announcement",
                timestamp: serverTimestamp()
            });

            const writes = [addDoc(collection(db, "globalMessages"), payload())];

            const roomsSnap = await getDocs(collection(db, "rooms"));
            roomsSnap.forEach((roomDoc) => {
                writes.push(addDoc(collection(db, "rooms", roomDoc.id, "messages"), payload()));
            });

            await Promise.all(writes);

            showNotice(notice, `Sent to Global Chat + ${roomsSnap.size} room(s).`, "success");
            textEl.value = "";
        } catch (err) {
            showNotice(notice, err.message || "Couldn't send broadcast.");
        } finally {
            btn.disabled = false;
            label.innerHTML = "Send to All Rooms";
        }
    });
}

// ---------- 2. Broadcast as a notification (all users or chosen) ----------
function setupNotificationBroadcast() {
    const btn = document.getElementById('sendNotifBc');
    const textEl = document.getElementById('notifBcText');
    const notice = document.getElementById('notifBcNotice');

    btn.addEventListener('click', async () => {
        const text = textEl.value.trim();
        if (!text) return;

        const target = document.querySelector('input[name="notifTarget"]:checked').value;

        btn.disabled = true;
        const label = btn.querySelector('.btn-label');
        label.innerHTML = `<span class="spinner"></span> Sending...`;

        try {
            let recipientUids = [];

            if (target === 'all') {
                const usersSnap = await getDocs(collection(db, "users"));
                recipientUids = usersSnap.docs.map(d => d.id);
            } else {
                recipientUids = Array.from(chosenUids.keys());
                if (recipientUids.length === 0) {
                    showNotice(notice, "Pick at least one user first.");
                    btn.disabled = false;
                    label.innerHTML = "Send Notification";
                    return;
                }
            }

            const writes = recipientUids.map(uid => addDoc(collection(db, "notifications"), {
                to: uid,
                type: "system",
                text: text,
                link: "../home.html",
                read: false,
                createdAt: new Date()
            }));
            await Promise.all(writes);

            showNotice(notice, `Notification sent to ${recipientUids.length} user(s).`, "success");
            textEl.value = "";
        } catch (err) {
            showNotice(notice, err.message || "Couldn't send notification.");
        } finally {
            btn.disabled = false;
            label.innerHTML = "Send Notification";
        }
    });
}

// ---------- User picker for "Choose Specific Users" ----------
function setupUserPicker() {
    const searchInput = document.getElementById('userPickSearch');
    const listEl = document.getElementById('userPickList');
    const countEl = document.getElementById('chosenCount');

    async function render(filterTerm = "") {
        const usersSnap = await getDocs(collection(db, "users"));
        listEl.innerHTML = "";

        usersSnap.docs
            .filter(d => !filterTerm || (d.data().username || "").toLowerCase().includes(filterTerm.toLowerCase()))
            .forEach(d => {
                const u = d.data();
                const row = document.createElement('label');
                row.className = "user-pick-row";
                const checked = chosenUids.has(d.id) ? "checked" : "";
                row.innerHTML = `<input type="checkbox" data-uid="${d.id}" data-name="${u.username}" ${checked}> ${u.username}`;
                listEl.appendChild(row);
            });

        listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    chosenUids.set(cb.dataset.uid, cb.dataset.name);
                } else {
                    chosenUids.delete(cb.dataset.uid);
                }
                countEl.textContent = chosenUids.size;
            });
        });
    }

    render();
    let debounce;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => render(searchInput.value.trim()), 300);
    });
}
