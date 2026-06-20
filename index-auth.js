import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://hewkwhlkdfvqjqnhvrgs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RUqmL2o8pQjeqnPloJIxtQ_m7hDyZzJ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;

const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userInfo = document.getElementById('user-info');

let currentUser = null;

async function initIndexAuth() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user || null;
    } catch (err) {
        console.warn('[index-auth] getUser failed', err);
        currentUser = null;
    }
    updateAuthUI();
    if (currentUser && typeof loadFamilies === 'function') loadFamilies(currentUser);

    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user ?? null;
        updateAuthUI();
        if (currentUser && typeof loadFamilies === 'function') loadFamilies(currentUser);
        if (!currentUser && document.getElementById('families-list-panel')) {
            document.getElementById('families-list-panel').style.display = 'none';
        }
    });
}

function updateAuthUI() {
    if (!userInfo || !signInBtn || !signOutBtn) return;
    if (currentUser) {
        signInBtn.style.display = 'none';
        signOutBtn.style.display = 'block';
        userInfo.style.display = 'block';
        userInfo.textContent = currentUser.email || currentUser.id;
    } else {
        signInBtn.style.display = 'block';
        signOutBtn.style.display = 'none';
        userInfo.style.display = 'none';
        userInfo.textContent = '';
    }
}

signInBtn?.addEventListener('click', async () => {
    const redirectTo = window.location.origin + window.location.pathname;
    console.log('[index-auth] signIn redirectTo=', redirectTo);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
});

signOutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

// Initialize when DOM is ready (defer ensures DOM parsed)
initIndexAuth();
