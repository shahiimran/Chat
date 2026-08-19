/* Path: js/admin-rooms.js */
import { db } from './firebase-config.js';
import { requireRole } from './access-guard.js';
import {
    collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const pendingList = document.getElementById('pendingRoomsList');
const approvedList = document.getElementById('approvedRoomsList');

requireRole(["admin"]).then(() => {
    // Pending requests
    const pendingQ = query(collection(db, "roomRequests"), where("status", "==", "pending"));
    onSnapshot(pendingQ, (snap) => {
        pendingList.innerHTML = "";
        if (snap.empty) {
            pendingList.innerHTML = `<p style="color: var(--text-gray);">No pending requests.</p>`;
            return;
        }
        snap.forEach((d) => {
            const req = d.data();
            const div = document.createElement('div');
            div.className = "user-row";
            div.innerHTML = `
                <div>
                    <strong>#${req.name}</strong> <span class="badge-blue">by ${req.requestedByName}</span><br>
                    <small>${req.description || "No description"}</small>
                </div>
                <div>
                    <button class="btn btn-primary" style="width:auto; padding:5px 10px;" onclick="approveRoom('${d.id}', '${req.name.replace(/'/g, "\\'")}', '${req.description ? req.description.replace(/'/g, "\\'") : ''}', '${req.requestedBy}')">Approve</button>
                    <button class="btn" style="width:auto; padding:5px 10px; background:#444; color:white;" onclick="rejectRoom('${d.id}', '${req.requestedBy}', '${req.name.replace(/'/g, "\\'")}')">Reject</button>
                </div>
            `;
            pendingList.appendChild(div);
        });
    });

    // Approved rooms
    onSnapshot(collection(db, "rooms"), (snap) => {
        approvedList.innerHTML = "";
        if (snap.empty) {
            approvedList.innerHTML = `<p style="color: var(--text-gray);">No rooms yet.</p>`;
            return;
        }
        snap.forEach((d) => {
            const room = d.data();
            const div = document.createElement('div');
            div.className = "user-row";
            div.innerHTML = `
                <div><strong># ${room.name}</strong><br><small>${room.description || ""}</small></div>
                <button class="btn" style="width:auto; padding:5px 10px; background:var(--error); color:white;" onclick="deleteRoom('${d.id}')">Delete</button>
            `;
            approvedList.appendChild(div);
        });
    });
});

window.approveRoom = async (reqId, name, description, requesterUid) => {
    await addDoc(collection(db, "rooms"), {
        name: name,
        description: description,
        createdBy: requesterUid,
        createdAt: new Date()
    });
    await deleteDoc(doc(db, "roomRequests", reqId));

    await addDoc(collection(db, "notifications"), {
        to: requesterUid,
        type: "system",
        text: `Your room request "${name}" was approved! 🎉`,
        link: "../rooms.html",
        read: false,
        createdAt: new Date()
    });
};

window.rejectRoom = async (reqId, requesterUid, name) => {
    await deleteDoc(doc(db, "roomRequests", reqId));

    await addDoc(collection(db, "notifications"), {
        to: requesterUid,
        type: "system",
        text: `Your room request "${name}" was not approved.`,
        link: "../rooms.html",
        read: false,
        createdAt: new Date()
    });
};

window.deleteRoom = async (roomId) => {
    if (confirm("Delete this room? This cannot be undone.")) {
        await deleteDoc(doc(db, "rooms", roomId));
    }
};
