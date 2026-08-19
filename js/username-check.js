/* Path: js/username-check.js */
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Usernames are reserved in a separate `usernames/{usernameLower}` collection
// (doc id = lowercase username) so two accounts can never collide, even if
// they typed different capitalization.
export function normalizeUsername(username) {
    return username.trim().toLowerCase();
}

/** True if `usernameLower` is already taken by someone other than `myUid`. */
export async function isUsernameTaken(usernameLower, myUid = null) {
    const snap = await getDoc(doc(db, "usernames", usernameLower));
    if (!snap.exists()) return false;
    if (myUid && snap.data().uid === myUid) return false; // it's my own reservation
    return true;
}

/**
 * Wires up a debounced "is this username available?" indicator on an input.
 * `getMyUid` lets the edit-profile page exclude the user's own current name.
 */
export function attachLiveUsernameCheck(inputEl, hintEl, { getMyUid = () => null, minLen = 3 } = {}) {
    let debounceTimer;
    let latestRequestId = 0;

    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const val = inputEl.value.trim();
        inputEl.classList.remove('input-error', 'input-success');

        if (val.length < minLen) {
            hintEl.textContent = val.length === 0 ? "" : `At least ${minLen} characters`;
            hintEl.className = "field-hint";
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(val)) {
            hintEl.textContent = "Only letters, numbers, and underscores";
            hintEl.className = "field-hint error-text";
            inputEl.classList.add('input-error');
            return;
        }

        hintEl.textContent = "Checking availability...";
        hintEl.className = "field-hint";
        const requestId = ++latestRequestId;

        debounceTimer = setTimeout(async () => {
            try {
                const taken = await isUsernameTaken(normalizeUsername(val), getMyUid());
                if (requestId !== latestRequestId) return; // a newer keystroke superseded this check

                if (taken) {
                    hintEl.textContent = "✗ Username is taken";
                    hintEl.className = "field-hint error-text";
                    inputEl.classList.add('input-error');
                } else {
                    hintEl.textContent = "✓ Username available";
                    hintEl.className = "field-hint success-text";
                    inputEl.classList.add('input-success');
                }
            } catch (err) {
                if (requestId === latestRequestId) hintEl.textContent = "";
            }
        }, 450);
    });
}
