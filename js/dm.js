/* Path: js/dm.js */
import { auth, db } from './firebase-config.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, doc, getDoc, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { statusDotHtml, isOnline } from './presence.js';

const urlParams = new URLSearchParams(window.location.search);
const otherUid = urlParams.get('uid');

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (document.getElementById('dmList')) loadInbox(user.uid);
        if (document.getElementById('privateMessages')) startConversation(user.uid, otherUid);
    } else {
        window.location.href = "login.html";
    }
});

// 1. Generate a Unique ID for the two users
function getChatId(id1, id2) {
    return id1 < id2 ? id1 + "_" + id2 : id2 + "_" + id1;
}

// 2. Load Inbox (dm.html) — with live online/offline status per friend
let inboxRowListeners = [];

function loadInbox(myUid) {
    const dmList = document.getElementById('dmList');
    const q = query(collection(db, "chats"), where("participants", "array-contains", myUid));

    onSnapshot(q, (snapshot) => {
        inboxRowListeners.forEach(unsub => unsub());
        inboxRowListeners = [];
        dmList.innerHTML = "";

        if (snapshot.empty) {
            dmList.innerHTML = "<p style='text-align:center;'>No messages yet.</p>";
            return;
        }

        snapshot.forEach((chatDoc) => {
            const data = chatDoc.data();
            const friendId = data.participants.find(id => id !== myUid);

            const row = document.createElement('div');
            row.style.cssText = "display: flex; align-items: center; gap: 15px; padding: 15px; border-bottom: 1px solid #222; cursor: pointer; min-width: 0;";
            row.onclick = () => window.location.href = `conversation.html?uid=${friendId}`;
            row.innerHTML = `<span style="color: var(--text-gray); font-size: 0.85rem;">Loading...</span>`;
            dmList.appendChild(row);

            const unsub = onSnapshot(doc(db, "users", friendId), (userSnap) => {
                if (!userSnap.exists()) return;
                const friendData = userSnap.data();
                row.innerHTML = `
                    <div style="position: relative; flex-shrink: 0; width: 50px; height: 50px;">
                        <img src="${friendData.avatar || ''}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
                        ${statusDotHtml(friendData.lastActive, "position: absolute; right: -2px; bottom: -2px;")}
                    </div>
                    <div style="min-width: 0; overflow: hidden;">
                        <strong style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${friendData.username}</strong>
                        <small style="color: var(--text-gray)">${isOnline(friendData.lastActive) ? 'Online' : 'Click to view messages'}</small>
                    </div>
                `;
            });
            inboxRowListeners.push(unsub);
        });
    });
}

// 3. Start Conversation (conversation.html) — with live header status
async function startConversation(myUid, targetUid) {
    const chatId = getChatId(myUid, targetUid);
    const messagesDisplay = document.getElementById('privateMessages');
    const privateForm = document.getElementById('privateForm');

    // Live header: name, avatar, and online/offline status update in real time
    onSnapshot(doc(db, "users", targetUid), (friendSnap) => {
        if (!friendSnap.exists()) return;
        const friendData = friendSnap.data();
        document.getElementById('chatName').innerText = friendData.username;
        document.getElementById('chatAvatar').src = friendData.avatar || '';
        const statusEl = document.getElementById('chatStatus');
        if (statusEl) {
            const online = isOnline(friendData.lastActive);
            statusEl.innerHTML = `${statusDotHtml(friendData.lastActive, "position: static; vertical-align: middle; margin-right: 5px;")} ${online ? 'Online' : 'Offline'}`;
        }
    });

    // Load Messages
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        messagesDisplay.innerHTML = "";
        snapshot.forEach((mDoc) => {
            const mData = mDoc.data();
            const isMe = mData.senderId === myUid;
            const div = document.createElement('div');
            div.className = `message ${isMe ? 'sent' : 'received'}`;
            div.innerHTML = `<p>${mData.text}</p>`;
            messagesDisplay.appendChild(div);
        });
        messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
    });

    // Send Message
    privateForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = document.getElementById('pMsgInput').value;
        
        // Ensure chat document exists in 'chats' collection
        await setDoc(doc(db, "chats", chatId), {
            participants: [myUid, targetUid],
            lastUpdate: serverTimestamp()
        }, { merge: true });

        // Add message to subcollection
        await addDoc(collection(db, "chats", chatId, "messages"), {
            text: text,
            senderId: myUid,
            timestamp: serverTimestamp()
        });

        // Track activity for the Discover ranking (best-effort, ignore failures)
        updateDoc(doc(db, "users", myUid), { messageCount: increment(1) }).catch(() => {});

        privateForm.reset();
    };
}