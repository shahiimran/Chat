/* Path: js/rooms.js */
import { auth, db } from './firebase-config.js';
import {
    collection, addDoc, query, orderBy, onSnapshot, getDocs, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;

    if (document.getElementById('roomsList')) loadRooms();
    if (document.getElementById('createRoomForm')) setupCreateRoom();
});

// ---------- rooms.html: browse approved rooms ----------
function loadRooms() {
    const roomsList = document.getElementById('roomsList');
    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        roomsList.innerHTML = "";
        if (snapshot.empty) {
            roomsList.innerHTML = `<p style="color: var(--text-gray); text-align:center; padding: 30px 0;">No rooms yet. Be the first to request one!</p>`;
            return;
        }
        snapshot.forEach((d) => {
            const room = d.data();
            const div = document.createElement('a');
            div.href = `chat.html?room=${d.id}`;
            div.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:15px; border-bottom:1px solid #222; text-decoration:none; color:inherit;";
            div.innerHTML = `
                <div style="min-width:0;">
                    <strong><i class="fas fa-hashtag" style="color:var(--accent); font-size:0.85rem;"></i> ${room.name}</strong>
                    <p style="margin:4px 0 0; color:var(--text-gray); font-size:0.82rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${room.description || ''}</p>
                </div>
                <i class="fas fa-chevron-right" style="color:var(--text-gray); flex-shrink:0;"></i>
            `;
            roomsList.appendChild(div);
        });
    });
}

// ---------- create-room.html: request a new room ----------
function setupCreateRoom() {
    const form = document.getElementById('createRoomForm');
    const notice = document.getElementById('createRoomNotice');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('roomName').value.trim();
        const description = document.getElementById('roomDescription').value.trim();
        const btn = document.getElementById('createRoomBtn');

        if (name.length < 3 || name.length > 30) {
            notice.innerHTML = `<i class="fas fa-circle-exclamation"></i><span>Room name must be 3-30 characters.</span>`;
            notice.className = "status-msg error-msg";
            notice.classList.remove('hidden');
            return;
        }

        btn.disabled = true;
        const label = btn.querySelector('.btn-label');
        if (label) label.innerHTML = `<span class="spinner"></span> Sending...`;

        try {
            const mySnap = await getDoc(doc(db, "users", currentUser.uid));
            const myName = mySnap.exists() ? mySnap.data().username : "Someone";

            await addDoc(collection(db, "roomRequests"), {
                name: name,
                description: description,
                requestedBy: currentUser.uid,
                requestedByName: myName,
                status: "pending",
                timestamp: new Date()
            });

            // Notify every admin so they see it in their notifications
            const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
            const notifyPromises = [];
            adminsSnap.forEach((adminDoc) => {
                notifyPromises.push(addDoc(collection(db, "notifications"), {
                    to: adminDoc.id,
                    type: "system",
                    text: `${myName} requested a new room: "${name}"`,
                    link: "../admin/dashboard.html",
                    read: false,
                    createdAt: new Date()
                }));
            });
            await Promise.all(notifyPromises);

            notice.innerHTML = `<i class="fas fa-circle-check"></i><span>Request sent! An admin will review it soon.</span>`;
            notice.className = "status-msg success-msg";
            notice.classList.remove('hidden');
            form.reset();
        } catch (err) {
            notice.innerHTML = `<i class="fas fa-circle-exclamation"></i><span>${err.message || "Couldn't send request."}</span>`;
            notice.className = "status-msg error-msg";
            notice.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            if (label) label.innerHTML = "Send Request";
        }
    });
}
