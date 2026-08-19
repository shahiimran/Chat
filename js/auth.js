/* Path: js/auth.js */
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    onAuthStateChanged,
    signOut,
    reload,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { normalizeUsername, isUsernameTaken, attachLiveUsernameCheck } from './username-check.js';

/* ---------------- Helpers ---------------- */

function showNotice(el, message, type = "error") {
    if (!el) return;
    el.innerHTML = `<i class="fas fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i><span>${message}</span>`;
    el.className = `status-msg ${type === 'error' ? 'error-msg' : 'success-msg'}`;
    el.classList.remove('hidden');
}

function setLoading(btn, loading, loadingText = "Please wait...") {
    if (!btn) return;
    const label = btn.querySelector('.btn-label');
    if (loading) {
        btn.dataset.originalText = label ? label.innerHTML : btn.innerHTML;
        btn.disabled = true;
        if (label) {
            label.innerHTML = `<span class="spinner"></span> ${loadingText}`;
        } else {
            btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
        }
    } else {
        btn.disabled = false;
        if (label && btn.dataset.originalText) label.innerHTML = btn.dataset.originalText;
    }
}

// Friendlier messages for common Firebase Auth error codes
function friendlyAuthError(err) {
    const code = err && err.code ? err.code : "";
    const map = {
        "auth/invalid-email": "That email address doesn't look right.",
        "auth/user-disabled": "This account has been disabled.",
        "auth/user-not-found": "No account found with that email.",
        "auth/wrong-password": "Incorrect email or password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/email-already-in-use": "An account already exists with this email.",
        "auth/weak-password": "Password should be at least 6 characters.",
        "auth/too-many-requests": "Too many attempts. Please try again in a bit.",
        "auth/network-request-failed": "Network error. Check your connection and try again."
    };
    return map[code] || (err && err.message ? err.message.replace(/^Firebase:\s*/, "") : "Something went wrong. Please try again.");
}

function toggleVisibility(button) {
    const targetId = button.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;
    const icon = button.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => toggleVisibility(btn));
});

/* ---------------- LOGIN ---------------- */

const loginForm = document.getElementById('loginForm');
const loginNotice = document.getElementById('loginNotice');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginNotice.classList.add('hidden');

        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value;
        const btn = document.getElementById('loginSubmitBtn');

        if (!email || !pass) {
            showNotice(loginNotice, "Please fill in both fields.");
            return;
        }

        setLoading(btn, true, "Logging in...");
        try {
            const userCred = await signInWithEmailAndPassword(auth, email, pass);
            if (userCred.user.emailVerified) {
                window.location.href = "home.html";
            } else {
                window.location.href = "verify-email.html";
            }
        } catch (err) {
            showNotice(loginNotice, friendlyAuthError(err));
            setLoading(btn, false);
        }
    });
}

/* ---------------- REGISTER ---------------- */

const regForm = document.getElementById('regForm');
const regNotice = document.getElementById('notice');

if (regForm) {
    const passwordInput = document.getElementById('password');
    const strengthBars = document.querySelectorAll('#strengthMeter div');
    const passwordHint = document.getElementById('passwordHint');
    const confirmInput = document.getElementById('confirmPassword');
    const confirmHint = document.getElementById('confirmHint');
    const usernameInput = document.getElementById('username');
    const usernameHint = document.getElementById('usernameHint');

    if (usernameInput && usernameHint) {
        attachLiveUsernameCheck(usernameInput, usernameHint);
    }

    function scorePassword(pw) {
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10 && /[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
        if (pw.length >= 10 && /[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const score = scorePassword(passwordInput.value);
            const colors = ["#2a3140", "#ff4b2b", "#ffb020", "#00e676"];
            strengthBars.forEach((bar, i) => {
                bar.style.background = i < score ? colors[score] : "#2a3140";
            });
            if (passwordInput.value.length === 0) {
                passwordHint.textContent = "";
            } else if (passwordInput.value.length < 6) {
                passwordHint.textContent = "Too short (min 6 characters)";
                passwordHint.className = "field-hint error-text";
            } else {
                passwordHint.textContent = score >= 2 ? "Strong password" : "Consider adding numbers or symbols";
                passwordHint.className = `field-hint ${score >= 2 ? 'success-text' : ''}`;
            }
        });
    }

    if (confirmInput) {
        confirmInput.addEventListener('input', () => {
            if (!confirmInput.value) { confirmHint.textContent = ""; return; }
            if (confirmInput.value === passwordInput.value) {
                confirmHint.textContent = "Passwords match";
                confirmHint.className = "field-hint success-text";
            } else {
                confirmHint.textContent = "Passwords don't match";
                confirmHint.className = "field-hint error-text";
            }
        });
    }

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        regNotice.classList.add('hidden');

        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const btn = document.getElementById('regSubmitBtn');

        // Client-side validation
        if (username.length < 3 || username.length > 20) {
            showNotice(regNotice, "Username must be between 3 and 20 characters.");
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            showNotice(regNotice, "Username can only contain letters, numbers, and underscores.");
            return;
        }
        if (password.length < 6) {
            showNotice(regNotice, "Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            showNotice(regNotice, "Passwords don't match.");
            return;
        }

        setLoading(btn, true, "Creating account...");
        try {
            const usernameLower = normalizeUsername(username);

            // Quick pre-check before we even touch Firebase Auth (saves creating
            // an orphaned account in the common case; the transaction below is
            // still the real guard against a same-instant race).
            if (await isUsernameTaken(usernameLower)) {
                showNotice(regNotice, "That username is already taken. Please choose another.");
                setLoading(btn, false);
                return;
            }

            const userCred = await createUserWithEmailAndPassword(auth, email, password);

            try {
                // Atomically reserve the username AND create the profile doc.
                // If someone else grabbed the name in the same instant, this
                // transaction fails and we roll back the auth account below.
                await runTransaction(db, async (transaction) => {
                    const usernameRef = doc(db, "usernames", usernameLower);
                    const usernameSnap = await transaction.get(usernameRef);
                    if (usernameSnap.exists()) {
                        throw new Error("USERNAME_TAKEN");
                    }
                    transaction.set(usernameRef, { uid: userCred.user.uid });
                    transaction.set(doc(db, "users", userCred.user.uid), {
                        username: username,
                        email: email,
                        isBanned: false,
                        role: "user",
                        status: "Sky Traveler",
                        featured: false,
                        messageCount: 0,
                        createdAt: serverTimestamp()
                    });
                });
            } catch (txErr) {
                // Roll back the orphaned auth account so the email is free to retry.
                await deleteUser(userCred.user).catch(() => {});
                if (txErr.message === "USERNAME_TAKEN") {
                    showNotice(regNotice, "That username was just taken. Please choose another.");
                } else {
                    showNotice(regNotice, "Couldn't finish creating your account. Please try again.");
                }
                setLoading(btn, false);
                return;
            }

            // Send verification email
            await sendEmailVerification(userCred.user);

            window.location.href = "verify-email.html";
        } catch (err) {
            showNotice(regNotice, friendlyAuthError(err));
            setLoading(btn, false);
        }
    });
}

/* ---------------- RESET PASSWORD ---------------- */

const resetForm = document.getElementById('resetForm');
const resetNotice = document.getElementById('resetNotice');

if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        resetNotice.classList.add('hidden');

        const email = document.getElementById('resetEmail').value.trim();
        const btn = document.getElementById('resetSubmitBtn');
        if (!email) {
            showNotice(resetNotice, "Please enter your email address.");
            return;
        }

        setLoading(btn, true, "Sending...");
        try {
            await sendPasswordResetEmail(auth, email);
            showNotice(resetNotice, "Reset link sent! Check your inbox and spam folder.", "success");
            resetForm.reset();
        } catch (err) {
            showNotice(resetNotice, friendlyAuthError(err));
        } finally {
            setLoading(btn, false);
        }
    });
}

/* ---------------- VERIFY EMAIL PAGE ---------------- */

const checkVerifiedBtn = document.getElementById('checkVerifiedBtn');
const resendBtn = document.getElementById('resendBtn');
const verifyEmailAddr = document.getElementById('verifyEmailAddr');
const verifyNotice = document.getElementById('verifyNotice');
const logoutLink = document.getElementById('logoutLink');

if (checkVerifiedBtn) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        if (user.emailVerified) {
            window.location.href = "home.html";
            return;
        }
        if (verifyEmailAddr) verifyEmailAddr.textContent = user.email;
    });

    checkVerifiedBtn.addEventListener('click', async () => {
        setLoading(checkVerifiedBtn, true, "Checking...");
        try {
            await reload(auth.currentUser);
            if (auth.currentUser.emailVerified) {
                window.location.href = "home.html";
            } else {
                showNotice(verifyNotice, "Still not verified. Please click the link in your email first.");
            }
        } catch (err) {
            showNotice(verifyNotice, friendlyAuthError(err));
        } finally {
            setLoading(checkVerifiedBtn, false);
        }
    });

    resendBtn.addEventListener('click', async () => {
        setLoading(resendBtn, true, "Sending...");
        try {
            await sendEmailVerification(auth.currentUser);
            showNotice(verifyNotice, "Verification email resent! Check your inbox.", "success");
        } catch (err) {
            showNotice(verifyNotice, friendlyAuthError(err));
        } finally {
            setLoading(resendBtn, false);
        }
    });

    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = "login.html";
    });
}
