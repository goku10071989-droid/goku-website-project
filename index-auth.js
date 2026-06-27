// Dashboard controller for index.html
// Depends on auth.js (window.initAuth, window.signInWithGoogle, window.signOut, window.supabase)
(async function () {
    'use strict';

    const $ = id => document.getElementById(id);

    const signinBtn       = $('signin-btn');
    const heroSigninBtn   = $('hero-signin-btn');
    const signoutBtn      = $('signout-btn');
    const userEmailEl     = $('user-email');
    const userMenu        = $('user-menu');
    const loadingView     = $('loading-view');
    const guestView       = $('guest-view');
    const dashboardView   = $('dashboard-view');
    const familiesGrid    = $('families-grid');
    const familiesLoading = $('families-loading');
    const familiesEmpty   = $('families-empty');
    const createModal     = $('create-modal');
    const createForm      = $('create-form');
    const editModal       = $('edit-modal');
    const editForm        = $('edit-form');

    let currentUser = null;
    let editingFamilyId = null;

    // ── View management ────────────────────────────────────────────────
    function showView(view) {
        loadingView.style.display   = view === 'loading'   ? 'flex'  : 'none';
        guestView.style.display     = view === 'guest'     ? 'flex'  : 'none';
        dashboardView.style.display = view === 'dashboard' ? 'block' : 'none';
    }

    function updateHeaderAuth(user) {
        if (user) {
            signinBtn.style.display = 'none';
            userMenu.style.display  = 'flex';
            userEmailEl.textContent = user.email || user.id;
        } else {
            signinBtn.style.display = 'block';
            userMenu.style.display  = 'none';
            userEmailEl.textContent = '';
        }
    }

    // ── Auth callback ──────────────────────────────────────────────────
    async function onAuthChange(session) {
        currentUser = session?.user ?? null;
        updateHeaderAuth(currentUser);
        if (currentUser) {
            showView('dashboard');
            await loadFamilies();
        } else {
            showView('guest');
        }
    }

    // ── Load families from Supabase ────────────────────────────────────
    async function loadFamilies() {
        const sb = window.supabase;
        if (!sb || !currentUser) return;

        familiesGrid.style.display    = 'none';
        familiesEmpty.style.display   = 'none';
        familiesLoading.style.display = 'flex';

        try {
            const { data, error } = await sb
                .from('families')
                .select('id, name, created_at, content')
                .eq('owner_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            familiesLoading.style.display = 'none';

            if (!data || data.length === 0) {
                familiesEmpty.style.display = 'flex';
                return;
            }
            familiesGrid.style.display = 'grid';
            familiesGrid.innerHTML = data.map(renderFamilyCard).join('');
        } catch (err) {
            familiesLoading.innerHTML = '<p style="color:#e74c3c;padding:16px;">Lỗi khi tải danh sách.</p>';
            console.error('[index-auth] loadFamilies', err);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────
    function countMembers(content) {
        if (!content) return 0;
        let obj = content;
        if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch (e) { return 0; } }
        let n = 0;
        function walk(node) {
            if (!node) return;
            n++;
            (node.spouses  || []).forEach(() => n++);
            (node.children || []).forEach(walk);
        }
        walk(obj);
        return n;
    }

    function esc(str) {
        return String(str || '').replace(/[&<>"']/g, function (m) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
        });
    }

    function renderFamilyCard(f) {
        const members = countMembers(f.content);
        const date    = f.created_at ? new Date(f.created_at).toLocaleDateString('vi-VN') : '';
        const nameEsc = esc(f.name || 'Không tên');
        return '<div class="family-card" onclick="openFamily(\'' + f.id + '\')">' +
            '<div class="family-card-icon">🌳</div>' +
            '<div class="family-card-body">' +
                '<div class="family-card-name">' + nameEsc + '</div>' +
                '<div class="family-card-meta">' +
                    '<span>👥 ' + members + ' thành viên</span>' +
                    '<span>📅 ' + date + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="family-card-actions" onclick="event.stopPropagation()">' +
                '<button class="btn-card-action btn-card-edit" data-id="' + f.id + '" data-name="' + nameEsc + '" onclick="showEditFamilyModal(this.dataset.id, this.dataset.name)" title="Đổi tên">✏️</button>' +
                '<button class="btn-card-action btn-card-delete" data-id="' + f.id + '" data-name="' + nameEsc + '" onclick="deleteFamilyTree(this.dataset.id, this.dataset.name)" title="Xóa cây gia phả">🗑️</button>' +
            '</div>' +
            '<div class="family-card-arrow">›</div>' +
        '</div>';
    }

    window.openFamily = function (id) {
        window.location.href = 'giapha.html?family_id=' + encodeURIComponent(id);
    };

    // ── Modal ──────────────────────────────────────────────────────────
    function showModal() {
        createModal.style.display = 'flex';
        setTimeout(() => $('cf-family-name').focus(), 50);
    }

    function hideModal() {
        createModal.style.display = 'none';
        createForm.reset();
    }

    async function handleCreate(e) {
        e.preventDefault();
        const familyName = $('cf-family-name').value.trim();
        const rootName   = $('cf-root-name').value.trim();
        const rootGender = $('cf-root-gender').value;
        const rootBirth  = $('cf-root-birth').value || '';
        if (!familyName || !rootName) return;

        const rootId = '_' + Math.random().toString(36).substr(2, 9);
        const rootMember = {
            id: rootId, treeName: familyName, name: rootName,
            gender: rootGender, birthYear: rootBirth, deathYear: 'Đang sống',
            birthOrder: 1, spouses: [], children: []
        };

        const submitBtn = createForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang tạo...';

        try {
            const { data, error } = await window.supabase
                .from('families')
                .insert({ name: familyName, owner_id: currentUser.id, content: rootMember })
                .select('id')
                .single();
            if (error) throw error;
            window.location.href = 'giapha.html?family_id=' + encodeURIComponent(data.id);
        } catch (err) {
            console.error('[index-auth] createFamily', err);
            alert('Lỗi khi tạo gia phả: ' + (err.message || String(err)));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Tạo Gia Phả';
        }
    }

    // ── Edit Family Modal ──────────────────────────────────────────────
    function showEditModal(id, name) {
        editingFamilyId = id;
        $('ef-family-id').value = id;
        $('ef-family-name').value = name;
        editModal.style.display = 'flex';
        setTimeout(() => $('ef-family-name').focus(), 50);
    }

    function hideEditModal() {
        editModal.style.display = 'none';
        editForm.reset();
        editingFamilyId = null;
    }

    async function handleEditSubmit(e) {
        e.preventDefault();
        const id   = $('ef-family-id').value;
        const name = $('ef-family-name').value.trim();
        if (!id || !name || !currentUser) return;

        const submitBtn = editForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu...';

        try {
            const { error } = await window.supabase
                .from('families')
                .update({ name })
                .eq('id', id)
                .eq('owner_id', currentUser.id);
            if (error) throw error;
            hideEditModal();
            await loadFamilies();
        } catch (err) {
            console.error('[index-auth] editFamily', err);
            alert('Lỗi khi đổi tên: ' + (err.message || String(err)));
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lưu';
        }
    }

    // ── Delete Family ──────────────────────────────────────────────────
    window.deleteFamilyTree = async function (id, name) {
        if (!currentUser) return;
        if (!confirm('Bạn có chắc muốn xóa cây gia phả "' + (name || '') + '" không?\nHành động này không thể khôi phục!')) return;
        try {
            const { error } = await window.supabase
                .from('families')
                .delete()
                .eq('id', id)
                .eq('owner_id', currentUser.id);
            if (error) throw error;
            await loadFamilies();
        } catch (err) {
            console.error('[index-auth] deleteFamily', err);
            alert('Lỗi khi xóa: ' + (err.message || String(err)));
        }
    };

    window.showEditFamilyModal = showEditModal;

    // ── Wire up events ─────────────────────────────────────────────────
    signinBtn?.addEventListener('click',     function () { window.signInWithGoogle(); });
    heroSigninBtn?.addEventListener('click', function () { window.signInWithGoogle(); });
    signoutBtn?.addEventListener('click',    async function () { await window.signOut(); location.reload(); });

    $('edit-modal-close-btn')?.addEventListener('click',  hideEditModal);
    $('edit-modal-cancel-btn')?.addEventListener('click', hideEditModal);
    editModal?.addEventListener('click', function (e) { if (e.target === editModal) hideEditModal(); });
    editForm?.addEventListener('submit', handleEditSubmit);

    $('create-family-btn')?.addEventListener('click',       showModal);
    $('create-family-btn-empty')?.addEventListener('click', showModal);
    $('modal-close-btn')?.addEventListener('click',  hideModal);
    $('modal-cancel-btn')?.addEventListener('click', hideModal);
    createModal?.addEventListener('click', function (e) { if (e.target === createModal) hideModal(); });
    createForm?.addEventListener('submit', handleCreate);

    // ── Init ───────────────────────────────────────────────────────────
    showView('loading');
    await window.initAuth(onAuthChange);
})();
