/* Path: js/chat.js */
import { auth, db } from './firebase-config.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, getDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let myUsername = "User";
const messagesDisplay = document.getElementById('messagesDisplay');
const chatForm = document.getElementById('chatForm');

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room'); // null = the default Global Chat

// Reference to the right message collection: a named room's subcollection,
// or the original global chat collection when no room is specified.
const messagesRef = roomId
    ? collection(db, "rooms", roomId, "messages")
    : collection(db, "globalMessages");

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Always show the user's chosen username in chat — never their email.
        const mySnap = await getDoc(doc(db, "users", user.uid));
        myUsername = mySnap.exists() ? mySnap.data().username : "User";
        setupHeader();
        loadMessages();
    } else {
        window.location.href = "login.html";
    }
});

// Show the right room name + back link in the header
async function setupHeader() {
    const titleEl = document.getElementById('roomTitle');
    const backLink = document.getElementById('backLink');
    if (backLink) backLink.href = roomId ? "rooms.html" : "home.html";

    if (roomId && titleEl) {
        const roomSnap = await getDoc(doc(db, "rooms", roomId));
        titleEl.innerText = roomSnap.exists() ? `# ${roomSnap.data().name}` : "# Room";
    }
}

// 1. Send Message
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('msgInput');
    const text = input.value;
    if (!text.trim()) return;

    await addDoc(messagesRef, {
        text: text,
        senderId: currentUser.uid,
        senderName: myUsername,
        timestamp: serverTimestamp()
    });

    // Track activity for the Discover ranking (best-effort, ignore failures)
    updateDoc(doc(db, "users", currentUser.uid), { messageCount: increment(1) }).catch(() => {});

    chatForm.reset();
});

// 2. Load Messages in Real-time
function loadMessages() {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        messagesDisplay.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const isMe = data.senderId === currentUser.uid;

            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${isMe ? 'sent' : 'received'}`;
            
            msgDiv.innerHTML = `
                <span class="user-name">${data.senderName}</span>
                <p>${data.text}</p>
                <span class="time">
                    ${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                    ${isMe ? `<button class="delete-btn" onclick="deleteMsg('${id}')"><i class="fas fa-trash"></i></button>` : ''}
                </span>
            `;
            messagesDisplay.appendChild(msgDiv);
        });
        messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
    });
}

// 3. Delete Message Logic
window.deleteMsg = async (id) => {
    if(confirm("Delete this message?")) {
        await deleteDoc(doc(messagesRef, id));
    }
};
