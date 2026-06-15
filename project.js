import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://hewkwhlkdfvqjqnhvrgs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RUqmL2o8pQjeqnPloJIxtQ_m7hDyZzJ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const signinBtn = document.getElementById('signin-btn');
const signoutBtn = document.getElementById('signout-btn');
const userInfo = document.getElementById('user-info');
const projectsList = document.getElementById('projects-list');
const newProjectBtn = document.getElementById('new-project-btn');
const modal = document.getElementById('project-modal');
const modalTitle = document.getElementById('modal-title');
const projName = document.getElementById('proj-name');
const projCode = document.getElementById('proj-code');
const projDesc = document.getElementById('proj-desc');
const saveBtn = document.getElementById('save-project');
const cancelBtn = document.getElementById('cancel-project');

let currentUser = null;
let editingProjectId = null;

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user || null;
    updateAuthUI();
    if (currentUser) await loadProjects();

    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user ?? null;
        updateAuthUI();
        if (currentUser) loadProjects(); else projectsList.innerHTML = '';
    });
}

function updateAuthUI() {
    if (currentUser) {
        signinBtn.style.display = 'none';
        signoutBtn.style.display = 'inline-block';
        userInfo.textContent = currentUser.email || currentUser.id;
    } else {
        signinBtn.style.display = 'inline-block';
        signoutBtn.style.display = 'none';
        userInfo.textContent = '';
    }
}

signinBtn?.addEventListener('click', async () => {
    // Ensure Supabase redirects back to the exact page the user is on.
    const redirectTo = window.location.origin + window.location.pathname;
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
});

signoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

newProjectBtn?.addEventListener('click', () => openModal());
cancelBtn?.addEventListener('click', () => closeModal());

saveBtn?.addEventListener('click', async () => {
    const name = projName.value.trim();
    const code = projCode.value;
    const description = projDesc.value;
    if (!name) return alert('Name required');
    const content = { name, code, description };

    if (!currentUser) return alert('Sign in required');

    if (editingProjectId) {
        const { error } = await supabase
            .from('projects')
            .update({ name, content })
            .eq('id', editingProjectId);
        if (error) return alert('Update failed: ' + error.message);
    } else {
        const { error } = await supabase
            .from('projects')
            .insert([{ name, owner_id: currentUser.id, content, share_token: null }]);
        if (error) return alert('Insert failed: ' + error.message);
    }
    closeModal();
    await loadProjects();
});

function openModal(project = null) {
    editingProjectId = project?.id ?? null;
    modalTitle.textContent = project ? 'Edit Project' : 'New Project';
    projName.value = project?.content?.name ?? '';
    projCode.value = project?.content?.code ?? '';
    projDesc.value = project?.content?.description ?? '';
    modal.style.display = 'block';
}

function closeModal() {
    editingProjectId = null;
    projName.value = '';
    projCode.value = '';
    projDesc.value = '';
    modal.style.display = 'none';
}

async function loadProjects() {
    if (!currentUser) return;
    projectsList.innerHTML = '<p>Loading...</p>';
    const { data, error } = await supabase.from('projects').select('*').eq('owner_id', currentUser.id).order('id', { ascending: false });
    if (error) {
        projectsList.innerHTML = '<p>Error loading projects</p>';
        return;
    }
    renderProjects(data || []);
}

function renderProjects(items) {
    if (!items.length) {
        projectsList.innerHTML = '<p>No projects yet.</p>';
        return;
    }
    projectsList.innerHTML = '';
    items.forEach(p => {
        const el = document.createElement('div');
        el.className = 'project-card';
        const name = document.createElement('h3');
        name.textContent = p.name;
        const desc = document.createElement('p');
        desc.textContent = p.content?.description ?? '';
        const actions = document.createElement('div');
        actions.className = 'project-actions';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'cta-button';
        editBtn.addEventListener('click', () => openModal(p));

        const shareBtn = document.createElement('button');
        shareBtn.textContent = p.share_token ? 'Unshare' : 'Share';
        shareBtn.className = 'login-button';
        shareBtn.addEventListener('click', () => toggleShare(p));

        const viewBtn = document.createElement('a');
        viewBtn.textContent = 'View';
        viewBtn.className = 'login-button';
        viewBtn.href = p.share_token ? `view_project.html?share=${encodeURIComponent(p.share_token)}` : '#';
        viewBtn.target = '_blank';

        actions.append(editBtn, shareBtn, viewBtn);
        el.append(name, desc, actions);
        projectsList.appendChild(el);
    });
}

async function toggleShare(project) {
    if (!currentUser) return alert('Sign in required');
    if (project.share_token) {
        // Unshare
        const { error } = await supabase.from('projects').update({ share_token: null }).eq('id', project.id);
        if (error) return alert('Unshare failed: ' + error.message);
        alert('Project unshared');
    } else {
        const token = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
        const { error } = await supabase.from('projects').update({ share_token: token }).eq('id', project.id);
        if (error) return alert('Share failed: ' + error.message);
        const url = `${location.origin}/view_project.html?share=${encodeURIComponent(token)}`;
        await navigator.clipboard?.writeText(url).catch(()=>{});
        alert('Share URL copied to clipboard:\n' + url);
    }
    await loadProjects();
}

init();
