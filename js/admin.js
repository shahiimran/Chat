/* Path: js/admin.js */
import { db } from './firebase-config.js';
import { requireRole } from './access-guard.js';
import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userList = document.getElementById('allUsersList');

// Real access control: only users with role "admin" in their Firestore
// doc get past this point. Pair this with matching Firestore Security
// Rules — see the rules suggested alongside this file.
requireRole(["admin"]).then(({ user }) => {
    onSnapshot(collection(db, "users"), (snap) => {
        userList.innerHTML = "";
        snap.forEach((d) => {
            const target = d.data();
            const isSelf = d.id === user.uid;
            const div = document.createElement('div');
            div.className = "user-row";
            div.innerHTML = `
                <div>
                    <strong>${target.username}</strong> ${target.role === 'admin' ? '<span class="badge-blue">ADMIN</span>' : ''} ${target.featured ? '<span style="background:linear-gradient(135deg,#ffd700,#ffb020); color:#000; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:10px;"><i class="fas fa-star"></i> FEATURED</span>' : ''}<br>
                    <small>${target.email}</small>
                    ${target.isBanned ? '<span class="badge-red">BANNED</span>' : '<span class="badge-blue">ACTIVE</span>'}
                </div>
                <div>
                    <button class="btn" style="width:auto; padding:5px 10px; background:${target.featured ? '#555' : '#ffb020'}; color:${target.featured ? 'white' : '#000'};"
                        onclick="toggleFeatured('${d.id}', ${!!target.featured})">
                        ${target.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button class="btn" style="width:auto; padding:5px 10px; background:${target.isBanned ? '#00e676' : '#ff4b2b'}; color:white;"
                        ${isSelf ? 'disabled title="You can\'t ban yourself"' : ''}
                        onclick="toggleBan('${d.id}', ${target.isBanned})">
                        ${target.isBanned ? 'Unban' : 'Ban'}
                    </button>
                </div>
            `;
            userList.appendChild(div);
        });
    });
});

window.toggleBan = async (uid, currentStatus) => {
    await updateDoc(doc(db, "users", uid), {
        isBanned: !currentStatus
    });
};

window.toggleFeatured = async (uid, currentStatus) => {
    await updateDoc(doc(db, "users", uid), {
        featured: !currentStatus
    });
};
