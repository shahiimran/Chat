/* Path: js/moderator.js */
import { db } from './firebase-config.js';
import { requireRole } from './access-guard.js';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById('reportsContainer');

// Real access control: only "admin" or "moderator" roles get past this.
// Pair with matching Firestore Security Rules.
requireRole(["admin", "moderator"]).then(() => {
    onSnapshot(collection(db, "reports"), (snap) => {
        container.innerHTML = "";
        if (snap.empty) container.innerHTML = "No reports found.";

        snap.forEach((d) => {
            const report = d.data();
            const div = document.createElement('div');
            div.className = "user-row";
            div.innerHTML = `
                <div>
                    <span class="badge-red">REPORTED: ${report.reportedUser}</span><br>
                    <small>Reason: ${report.reason}</small>
                </div>
                <div>
                    <button class="btn btn-primary" style="width:auto; padding:5px 10px;" onclick="muteUser('${report.reportedUid}')">Mute</button>
                    <button class="btn" style="width:auto; padding:5px 10px; background:#444; color:white;" onclick="dismissReport('${d.id}')">Dismiss</button>
                </div>
            `;
            container.appendChild(div);
        });
    });
});

window.dismissReport = async (id) => {
    await deleteDoc(doc(db, "reports", id));
};

window.muteUser = async (uid) => {
    await updateDoc(doc(db, "users", uid), { isMuted: true });
    alert("User Muted");
};
