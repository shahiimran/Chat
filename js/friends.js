/* Path: js/friends.js */
import { auth, db } from './firebase-config.js';
import { 
    collection, addDoc, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { statusDotHtml } from './presence.js';

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (document.getElementById('friendsList')) loadFriends(user.uid);
        if (document.getElementById('requestList')) loadRequests(user.uid);
        updateRequestBadge(user.uid);
    } else {
        window.location.href = "login.html";
    }
});

// 1. Load Friends List (with live online/offline status per friend)
let friendRowListeners = [];

function loadFriends(myUid) {
    const friendsList = document.getElementById('friendsList');
    const q = query(collection(db, "friends"), where("users", "array-contains", myUid));

    onSnapshot(q, (snapshot) => {
        // Clean up previous per-friend listeners before re-rendering
        friendRowListeners.forEach(unsub => unsub());
        friendRowListeners = [];
        friendsList.innerHTML = "";

        if (snapshot.empty) {
            friendsList.innerHTML = "No friends yet. Go to Discover!";
            return;
        }

        snapshot.forEach((d) => {
            const data = d.data();
            const otherUid = data.users.find(id => id !== myUid);

            const row = document.createElement('div');
            row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #222; flex-wrap: wrap; gap: 10px;";
            row.innerHTML = `<span style="color: var(--text-gray); font-size: 0.85rem;">Loading...</span>`;
            friendsList.appendChild(row);

            // Live listener so the status dot updates in real time
            const unsub = onSnapshot(doc(db, "users", otherUid), (userSnap) => {
                if (!userSnap.exists()) return;
                const userData = userSnap.data();
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px; min-width: 0;">
                        <div style="position: relative; flex-shrink: 0; width: 40px; height: 40px;">
                            <img src="${userData.avatar || ''}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                            ${statusDotHtml(userData.lastActive, "position: absolute; right: -2px; bottom: -2px;")}
                        </div>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${userData.username}</span>
                    </div>
                    <a href="conversation.html?uid=${otherUid}" class="btn btn-primary" style="width: auto; padding: 5px 15px; flex-shrink: 0;">Chat</a>
                `;
            });
            friendRowListeners.push(unsub);
        });
    });
}

// 2. Load Pending Requests
function loadRequests(myUid) {
    const requestList = document.getElementById('requestList');
    const q = query(collection(db, "friendRequests"), where("to", "==", myUid), where("status", "==", "pending"));

    onSnapshot(q, (snapshot) => {
        requestList.innerHTML = "";
        if (snapshot.empty) requestList.innerHTML = "No pending requests.";

        snapshot.forEach((d) => {
            const req = d.data();
            requestList.innerHTML += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #333; flex-wrap: wrap; gap: 10px;">
                    <span style="min-width: 0; overflow-wrap: break-word;"><b>${req.fromName}</b> wants to be your friend.</span>
                    <div style="display: flex; gap: 10px; flex-shrink: 0;">
                        <button class="btn btn-primary" style="width: auto; padding: 5px 10px;" onclick="acceptReq('${d.id}', '${req.from}', '${myUid}')">Accept</button>
                        <button class="btn btn-outline" style="width: auto; border: 1px solid red; color: red; padding: 5px 10px;" onclick="deleteReq('${d.id}')">Decline</button>
                    </div>
                </div>
            `;
        });
    });
}

// 3. Accept Request Logic
window.acceptReq = async (reqId, fromUid, toUid) => {
    // Create friend link
    await addDoc(collection(db, "friends"), {
        users: [fromUid, toUid],
        timestamp: new Date()
    });
    // Delete the request
    await deleteDoc(doc(db, "friendRequests", reqId));

    // Notify the original requester that their request was accepted
    try {
        const myAcceptorSnap = await getDoc(doc(db, "users", toUid));
        const myName = myAcceptorSnap.exists() ? myAcceptorSnap.data().username : "Someone";
        await addDoc(collection(db, "notifications"), {
            to: fromUid,
            type: "friend_accept",
            text: `${myName} accepted your friend request.`,
            link: "friends.html",
            read: false,
            createdAt: new Date()
        });
    } catch (err) {
        console.error("Couldn't send accept notification:", err);
    }

    alert("Friend added!");
};

window.deleteReq = async (id) => {
    await deleteDoc(doc(db, "friendRequests", id));
};

function updateRequestBadge(myUid) {
    const q = query(collection(db, "friendRequests"), where("to", "==", myUid), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const badge = document.getElementById('reqBadge');
        if (badge) {
            if (snapshot.size > 0) {
                badge.innerText = snapshot.size;
                badge.style.display = "inline";
            } else {
                badge.style.display = "none";
            }
        }
    });
}