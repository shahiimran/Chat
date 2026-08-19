/* Path: js/profile.js */
import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { normalizeUsername, attachLiveUsernameCheck } from './username-check.js';

// List of preset avatars for the user to choose from
const avatars = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Casper",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Nova",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Orion",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Pixel"
];

let selectedAvatar = "";
let originalUsername = "";

function showNotice(el, message, type = "error") {
    if (!el) return;
    el.innerHTML = `<i class="fas fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i><span>${message}</span>`;
    el.className = `status-msg ${type === 'error' ? 'error-msg' : 'success-msg'}`;
    el.classList.remove('hidden');
}

function setLoading(btn, loading, loadingText = "Saving...") {
    if (!btn) return;
    const label = btn.querySelector('.btn-label');
    if (loading) {
        btn.dataset.originalText = label ? label.innerHTML : btn.innerHTML;
        btn.disabled = true;
        if (label) label.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
        btn.disabled = false;
        if (label && btn.dataset.originalText) label.innerHTML = btn.dataset.originalText;
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data();

        // IF ON VIEW PROFILE PAGE
        if (document.getElementById('displayUsername')) {
            document.getElementById('displayUsername').innerText = data.username;
            document.getElementById('displayStatus').innerText = data.status || "Sky Traveler";
            document.getElementById('displayBio').innerText = data.bio || "This user hasn't written a bio yet.";
            document.getElementById('displayAvatar').src = data.avatar || avatars[0];
        }

        // IF ON EDIT PROFILE PAGE
        if (document.getElementById('editForm')) {
            document.getElementById('editUsername').value = data.username || "";
            originalUsername = data.username || "";
            document.getElementById('editStatus').value = data.status || "";
            document.getElementById('editBio').value = data.bio || "";
            selectedAvatar = data.avatar || avatars[0];
            renderAvatarPicker(selectedAvatar);

            const usernameInput = document.getElementById('editUsername');
            const usernameHint = document.getElementById('usernameHint');
            if (usernameInput && usernameHint) {
                attachLiveUsernameCheck(usernameInput, usernameHint, { getMyUid: () => user.uid });
            }

            const bioField = document.getElementById('editBio');
            const bioCount = document.getElementById('bioCount');
            if (bioField && bioCount) {
                const updateCount = () => bioCount.textContent = `${bioField.value.length} / 160`;
                updateCount();
                bioField.addEventListener('input', updateCount);
            }
        }
    }
});

// Setup Avatar Picker
function renderAvatarPicker(currentAvatar) {
    const picker = document.getElementById('avatarPicker');
    if (!picker) return;
    picker.innerHTML = "";

    avatars.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = `avatar-option ${url === currentAvatar ? 'selected' : ''}`;
        img.onclick = () => {
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected');
            selectedAvatar = url;
        };
        picker.appendChild(img);
    });
}

// Save Profile Updates
const editForm = document.getElementById('editForm');
const editNotice = document.getElementById('editNotice');

if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const username = document.getElementById('editUsername').value.trim();
        const status = document.getElementById('editStatus').value.trim();
        const bio = document.getElementById('editBio').value.trim();
        const btn = document.getElementById('editSubmitBtn');

        if (username.length < 3 || username.length > 20) {
            showNotice(editNotice, "Username must be between 3 and 20 characters.");
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            showNotice(editNotice, "Username can only contain letters, numbers, and underscores.");
            return;
        }

        setLoading(btn, true);
        try {
            const usernameChanged = normalizeUsername(username) !== normalizeUsername(originalUsername);

            if (usernameChanged) {
                // Move the username reservation atomically: claim the new one,
                // release the old one, and update the profile — all or nothing.
                await runTransaction(db, async (transaction) => {
                    const newRef = doc(db, "usernames", normalizeUsername(username));
                    const newSnap = await transaction.get(newRef);
                    if (newSnap.exists() && newSnap.data().uid !== user.uid) {
                        throw new Error("USERNAME_TAKEN");
                    }
                    transaction.set(newRef, { uid: user.uid });
                    if (originalUsername) {
                        transaction.delete(doc(db, "usernames", normalizeUsername(originalUsername)));
                    }
                    transaction.update(doc(db, "users", user.uid), {
                        username: username,
                        status: status,
                        bio: bio,
                        avatar: selectedAvatar || avatars[0]
                    });
                });
            } else {
                // Username unchanged — still make sure the reservation exists
                // (covers accounts created before this feature existed).
                await runTransaction(db, async (transaction) => {
                    const ref = doc(db, "usernames", normalizeUsername(username));
                    const snap = await transaction.get(ref);
                    if (!snap.exists()) {
                        transaction.set(ref, { uid: user.uid });
                    }
                    transaction.update(doc(db, "users", user.uid), {
                        username: username,
                        status: status,
                        bio: bio,
                        avatar: selectedAvatar || avatars[0]
                    });
                });
            }
            window.location.href = "profile.html";
        } catch (err) {
            if (err.message === "USERNAME_TAKEN") {
                showNotice(editNotice, "That username is already taken. Please choose another.");
            } else {
                showNotice(editNotice, err.message || "Couldn't save changes. Try again.");
            }
            setLoading(btn, false);
        }
    });
}
