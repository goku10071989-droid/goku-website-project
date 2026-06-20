// auth.js - centralized Supabase auth helper (adds globals: window.initAuth, window.getSupabase, window.signInWithGoogle, window.signOut)
(function(){
    const SUPABASE_URL = 'https://hewkwhlkdfvqjqnhvrgs.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_RUqmL2o8pQjeqnPloJIxtQ_m7hDyZzJ';
    let supabaseClient = null;
    let authHandledFromUrl = false;

    async function handleAuthFromUrlOnce(onAuthChange) {
        console.log('[auth] handleAuthFromUrlOnce start', { locationHash: location.hash, locationSearch: location.search, authHandledFromUrl });
        if (authHandledFromUrl) return;
        const hasAuthInSearch = location.search.includes('access_token') || location.search.includes('code');
        const hasAuthInHash = location.hash && (location.hash.includes('access_token') || location.hash.includes('code') || location.hash.includes('type='));
        if (!(hasAuthInSearch || hasAuthInHash)) {
            console.log('[auth] no auth tokens in URL');
            return;
        }
        try {
            console.log('[auth] calling getSessionFromUrl');
            await supabaseClient.auth.getSessionFromUrl({ storeSession: true });
            const { data: { session } } = await supabaseClient.auth.getSession();
            console.log('[auth] session from URL', session);
            authHandledFromUrl = true;
            if (onAuthChange) onAuthChange(session);
            try { history.replaceState({}, document.title, location.pathname + location.search); } catch(e) {}
        } catch (err) {
            console.warn('[auth] No session from URL', err);
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
            window.addEventListener('hashchange', (e) => { console.log('[auth] hashchange event', { hash: location.hash }); handleAuthFromUrlOnce(onAuthChange).catch(()=>{}); });
            window.addEventListener('popstate', (e) => { console.log('[auth] popstate event', { href: location.href }); handleAuthFromUrlOnce(onAuthChange).catch(()=>{}); });

            // Expose a manual debug trigger
            window.debugAuthCheck = function() { console.log('[auth] debugAuthCheck invoked'); return handleAuthFromUrlOnce(onAuthChange); };

            // Poll for session as a fallback (extended window to catch late fragments)
            let pollCount = 0;
            const pollInterval = setInterval(async () => {
                pollCount++;
                try {
                    if (authHandledFromUrl) { clearInterval(pollInterval); return; }
                    console.log('[auth] poll check', { pollCount, locationHash: location.hash });
                    await supabaseClient.auth.getSessionFromUrl({ storeSession: true }).catch(()=>{});
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (session && session.user) {
                        console.log('[auth] session found in poll', { pollCount, session });
                        if (onAuthChange) onAuthChange(session);
                        authHandledFromUrl = true;
                        try { history.replaceState({}, document.title, location.pathname + location.search); } catch(e) {}
                        clearInterval(pollInterval);
                        return;
                    }
                } catch(e) { console.warn('[auth] poll error', e); }
                // keep polling longer (20s) to handle delayed fragments
                if (pollCount > 40) clearInterval(pollInterval);
            }, 500);

            // Some browsers / hosting setups may append the fragment after load.
            // Also catch pageshow (bfcache), and visibilitychange when fragment may appear.
            window.addEventListener('pageshow', (e) => { console.log('[auth] pageshow', { persisted: e.persisted, hash: location.hash }); handleAuthFromUrlOnce(onAuthChange).catch(()=>{}); });
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { console.log('[auth] visibilitychange visible', { hash: location.hash }); handleAuthFromUrlOnce(onAuthChange).catch(()=>{}); } });

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
        console.log('[auth] signInWithGoogle redirectTo=', redirectTo);
        try {
            await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        } catch (err) {
            console.error('[auth] Sign in failed', err);
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
