/* Path: js/search.js */
import { auth, db } from './firebase-config.js';
import { collection, query, orderBy, startAt, endAt, limit, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { statusDotHtml } from './presence.js';

let currentUid = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUid = user.uid;
    loadRanked();
});

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const results = document.getElementById('results');
const rankedTitle = document.getElementById('rankedTitle');
const rankedCard = document.getElementById('rankedCard');
const rankedList = document.getElementById('rankedList');

function userRowHtml(d, extraBadge = "") {
    const u = d.data();
    const avatar = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=00d2ff&color=000`;
    return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #222; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 15px; min-width: 0;">
                <div style="position: relative; flex-shrink: 0; width: 40px; height: 40px;">
                    <img src="${avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    ${statusDotHtml(u.lastActive, "position: absolute; right: -2px; bottom: -2px;")}
                </div>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.username}</span>
                ${extraBadge}
            </div>
            <a href="user-profile.html?uid=${d.id}" class="btn btn-outline" style="width: auto; padding: 6px 16px; border: 1px solid var(--accent); color: var(--accent); text-decoration: none; flex-shrink: 0;">View</a>
        </div>
    `;
}

// ---------- Default view: Featured + Top Active members ----------
async function loadRanked() {
    rankedList.innerHTML = `<p style="color: var(--text-gray); text-align:center; padding: 20px 0;"><span class="spinner"></span> Loading...</p>`;

    try {
        const [featuredSnap, activeSnap] = await Promise.all([
            getDocs(query(collection(db, "users"), where("featured", "==", true), limit(10))),
            getDocs(query(collection(db, "users"), orderBy("messageCount", "desc"), limit(20)))
        ]);

        const featuredIds = new Set();
        let html = "";

        featuredSnap.docs
            .filter(d => d.id !== currentUid && !d.data().isBanned)
            .forEach(d => {
                featuredIds.add(d.id);
                html += userRowHtml(d, `<span style="background: linear-gradient(135deg, #ffd700, #ffb020); color:#000; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:10px;"><i class="fas fa-star"></i> FEATURED</span>`);
            });

        let rank = 1;
        activeSnap.docs
            .filter(d => d.id !== currentUid && !d.data().isBanned && !featuredIds.has(d.id))
            .forEach(d => {
                const badge = `<span style="color: var(--text-gray); font-size: 0.75rem;">#${rank}</span>`;
                html += userRowHtml(d, badge);
                rank++;
            });

        rankedList.innerHTML = html || `<p style="color: var(--text-gray); text-align:center; padding: 20px 0;">No members to show yet.</p>`;
    } catch (err) {
        rankedList.innerHTML = `<p style="color: var(--error); text-align:center; padding: 20px 0;">Couldn't load rankings: ${err.message}</p>`;
    }
}

// ---------- Search box ----------
async function runSearch() {
    const term = searchInput.value.trim();

    if (!term) {
        results.innerHTML = "";
        rankedTitle.classList.remove('hidden');
        rankedCard.classList.remove('hidden');
        return;
    }

    // Hide the ranked list while actively searching
    rankedTitle.classList.add('hidden');
    rankedCard.classList.add('hidden');
    results.innerHTML = `<p style="color: var(--text-gray); text-align:center; padding: 20px 0;"><span class="spinner"></span> Searching...</p>`;

    try {
        // Prefix search on username (case-sensitive, matches how usernames are stored)
        const q = query(
            collection(db, "users"),
            orderBy("username"),
            startAt(term),
            endAt(term + "\uf8ff"),
            limit(20)
        );
        const snap = await getDocs(q);

        const matches = snap.docs.filter(d => d.id !== currentUid && !d.data().isBanned);

        if (matches.length === 0) {
            results.innerHTML = `<p style="color: var(--text-gray); text-align:center; padding: 20px 0;">No users found for "${term}".</p>`;
            return;
        }

        results.innerHTML = matches.map(d => userRowHtml(d)).join("");
    } catch (err) {
        results.innerHTML = `<p style="color: var(--error); text-align:center; padding: 20px 0;">Search failed: ${err.message}</p>`;
    }
}

if (searchBtn) searchBtn.addEventListener('click', runSearch);
if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSearch();
    });
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() === '') runSearch();
    });
}
