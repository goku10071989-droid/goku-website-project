// auth.js - centralized Supabase auth helper (adds globals: window.initAuth, window.getSupabase, window.signInWithGoogle, window.signOut)
(function(){
    const SUPABASE_URL = 'https://hewkwhlkdfvqjqnhvrgs.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_RUqmL2o8pQjeqnPloJIxtQ_m7hDyZzJ';
    let supabaseClient = null;
    let authHandledFromUrl = false;

    async function handleAuthFromUrlOnce(onAuthChange) {
        if (authHandledFromUrl) return;
        const hasAuthInSearch = location.search.includes('access_token') || location.search.includes('code');
        const hasAuthInHash = location.hash && (location.hash.includes('access_token') || location.hash.includes('code') || location.hash.includes('type='));
        if (!(hasAuthInSearch || hasAuthInHash)) return;
        try {
            await supabaseClient.auth.getSessionFromUrl({ storeSession: true });
            const { data: { session } } = await supabaseClient.auth.getSession();
            authHandledFromUrl = true;
            if (onAuthChange) onAuthChange(session);
            try { history.replaceState({}, document.title, location.pathname + location.search); } catch(e) {}
        } catch (err) {
            console.warn('No session from URL', err);
        }
    }

    window.initAuth = async function(onAuthChange) {
        if (supabaseClient) return supabaseClient;
        try {
            const m = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
            const { createClient } = m;
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
            window.supabase = supabaseClient;

            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (onAuthChange) onAuthChange(session);
            } catch (err) {
                console.warn('Supabase getSession failed', err);
            }

            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (onAuthChange) onAuthChange(session);
            });

            // Try to handle auth tokens in URL now and in near future
            handleAuthFromUrlOnce(onAuthChange);

            // Listen for hashchange and popstate to catch tokens that appear slightly later
            window.addEventListener('hashchange', () => handleAuthFromUrlOnce(onAuthChange).catch(()=>{}));
            window.addEventListener('popstate', () => handleAuthFromUrlOnce(onAuthChange).catch(()=>{}));

            // Poll briefly for session as a fallback
            let pollCount = 0;
            const pollInterval = setInterval(async () => {
                pollCount++;
                try {
                    if (authHandledFromUrl) { clearInterval(pollInterval); return; }
                    await supabaseClient.auth.getSessionFromUrl({ storeSession: true }).catch(()=>{});
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (session && session.user) {
                        if (onAuthChange) onAuthChange(session);
                        authHandledFromUrl = true;
                        try { history.replaceState({}, document.title, location.pathname + location.search); } catch(e) {}
                        clearInterval(pollInterval);
                        return;
                    }
                } catch(e) {}
                if (pollCount > 12) clearInterval(pollInterval);
            }, 500);

            return supabaseClient;
        } catch (err) {
            console.error('Failed to load Supabase client:', err);
            throw err;
        }
    };

    window.getSupabase = function() { return supabaseClient; };

    window.signInWithGoogle = async function() {
        if (!supabaseClient) await window.initAuth();
        const redirectTo = window.location.href.split('#')[0];
        try {
            await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        } catch (err) {
            console.error('Sign in failed', err);
            throw err;
        }
    };

    window.signOut = async function() {
        if (!supabaseClient) await window.initAuth();
        try {
            await supabaseClient.auth.signOut();
        } catch (err) {
            console.error('Sign out failed', err);
            throw err;
        }
    };
})();
