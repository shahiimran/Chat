/* Path: js/admin-messages.js */
import { db } from './firebase-config.js';
import { requireRole } from './access-guard.js';
import {
    collection, onSnapshot, doc, getDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const chatListPanel = document.getElementById('chatListPanel');
const threadPanel = document.getElementById('threadPanel');
const threadTitle = document.getElementById('threadTitle');

// Small cache so we don't re-fetch the same username repeatedly
const nameCache = new Map();
async function getUsername(uid) {
    if (nameCache.has(uid)) return nameCache.get(uid);
    const snap = await getDoc(doc(db, "users", uid));
    const name = snap.exists() ? snap.data().username : "Unknown";
    nameCache.set(uid, name);
    return name;
}

requireRole(["admin"]).then(() => {
    onSnapshot(collection(db, "chats"), async (snap) => {
        chatListPanel.innerHTML = "";
        if (snap.empty) {
            chatListPanel.innerHTML = `<p style="color: var(--text-gray); font-size: 0.85rem;">No conversations yet.</p>`;
            return;
        }

        for (const chatDoc of snap.docs) {
            const data = chatDoc.data();
            const participants = data.participants || [];
            const names = await Promise.all(participants.map(getUsername));

            const row = document.createElement('div');
            row.style.cssText = "padding: 10px; border-bottom: 1px solid #222; cursor: pointer; font-size: 0.88rem;";
            row.innerText = names.join(" ↔ ");
            row.onclick = () => openThread(chatDoc.id, names.join(" ↔ "));
            chatListPanel.appendChild(row);
        }
    });
});

function openThread(chatId, title) {
    threadTitle.innerText = title;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));

    onSnapshot(q, async (snap) => {
        if (snap.empty) {
            threadPanel.innerHTML = `<p style="color: var(--text-gray); font-size: 0.85rem;">No messages in this conversation.</p>`;
            return;
        }

        const rows = await Promise.all(snap.docs.map(async (m) => {
            const data = m.data();
            const senderName = await getUsername(data.senderId);
            const time = data.timestamp && data.timestamp.toDate
                ? data.timestamp.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                : "";
            return `
                <div style="padding: 8px 0; border-bottom: 1px solid #1c222d;">
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-gray);">
                        <span>${senderName}</span><span>${time}</span>
                    </div>
                    <p style="margin: 3px 0 0;">${data.text}</p>
                </div>
            `;
        }));

        threadPanel.innerHTML = rows.join("");
    });
}
