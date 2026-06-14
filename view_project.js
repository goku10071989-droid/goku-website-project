import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://hewkwhlkdfvqjqnhvrgs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RUqmL2o8pQjeqnPloJIxtQ_m7hDyZzJ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const q = new URLSearchParams(location.search);
const token = q.get('share');
const container = document.getElementById('public-project');

async function init() {
    if (!token) {
        container.innerHTML = '<p>No share token provided.</p>';
        return;
    }
    container.innerHTML = '<p>Loading...</p>';
    const { data, error } = await supabase.from('projects').select('*').eq('share_token', token).single();
    if (error || !data) {
        container.innerHTML = '<p>Project not found or not shared.</p>';
        return;
    }
    render(data);
}

function render(p) {
    const el = document.createElement('div');
    el.className = 'project-detail';
    const title = document.createElement('h1');
    title.textContent = p.name;
    const desc = document.createElement('p');
    desc.textContent = p.content?.description ?? '';
    const code = document.createElement('pre');
    code.textContent = p.content?.code ?? '';
    el.append(title, desc, code);
    container.innerHTML = '';
    container.appendChild(el);
}

init();
