let familyData = null;
    let selectedNodeId = null;

        // Cấu hình các biến phục vụ tính năng Zoom và Kéo thả (Pan)
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let pinchStartDistance = null;
        let initialScaleForPinch = null;
        let prePrintState = null;

        async function init() {
            // If URL contains family_id, load that family from Supabase and render
            try {
                const params = new URLSearchParams(location.search);
                const familyIdFromQuery = params.get('family_id');
                if (familyIdFromQuery) {
                    initPanZoomListeners();
                    document.body.classList.add('sidebar-collapsed');
                    updateSidebarToggleButton();
                    if (window.initAuth) await window.initAuth(updateAuthUI);
                    await loadFamilyById(familyIdFromQuery);
                    return;
                }
            } catch (err) {
                console.warn('Failed to parse family_id from URL', err);
            }

            const savedData = localStorage.getItem('family_tree_data');
            if (savedData) {
                familyData = JSON.parse(savedData);
                renderTree();
                selectMember(familyData.id);
            }
            // Auto-hide left sidebar on initial page load
            document.body.classList.add('sidebar-collapsed');
            updateSidebarToggleButton();
            initPanZoomListeners(); // Kích hoạt bộ lắng nghe sự kiện kéo thả chuột
            if (window.initAuth) window.initAuth(updateAuthUI); // Initialize Supabase auth (non-blocking)
        }

        // Supabase auth is handled by auth.js; use window.initAuth / window.supabase

        function updateAuthUI(session) {
            const userSection = document.getElementById('header-user-section');
            const userEmailEl = document.getElementById('header-user-email');
            if (!userSection || !userEmailEl) return;
            if (session && session.user) {
                const email = session.user.email || (session.user.user_metadata && session.user.user_metadata.email) || '';
                userSection.style.display = 'flex';
                userEmailEl.textContent = email;
            } else {
                userSection.style.display = 'none';
                userEmailEl.textContent = '';
            }
        }

        async function handleSignOut() {
            if (window.signOut) await window.signOut();
            window.location.href = 'index.html';
        }


        // Load a single family by id and render tree
        async function loadFamilyById(familyId) {
            if (!familyId) return;
            if (!window.supabase) {
                if (window.initAuth) await window.initAuth(updateAuthUI);
                if (!window.supabase) {
                    console.error('[giapha] supabase client not available');
                    return;
                }
            }
            try {
                const { data, error } = await window.supabase.from('families').select('*').eq('id', familyId).single();
                if (error) {
                    console.error('[giapha] loadFamilyById error', error);
                    return;
                }
                if (!data) {
                    console.warn('[giapha] no family row found for id', familyId);
                    return;
                }

                // data.content is expected to be the saved family JSON
                let content = data.content;
                if (!content) {
                    // If no content, create minimal structure from row
                    content = { id: data.id, treeName: data.name || '', name: data.name || '', spouses: [], children: [] };
                }
                // If content is a string, try to parse
                if (typeof content === 'string') {
                    try { content = JSON.parse(content); } catch(e) { /* ignore */ }
                }

                familyData = content;
                // Ensure id present
                if (!familyData.id) familyData.id = data.id;
                selectedNodeId = familyData.id;
                // Hide root-actions and show tree
                const rootAct = document.getElementById('root-actions'); if (rootAct) rootAct.style.display = 'none';
                renderTree();
                // Update header title
                const titleEl = document.getElementById('family-title');
                if (titleEl) titleEl.textContent = data.name || familyData.treeName || 'Gia Phả';
                // Check ownership for read-only mode
                try {
                    const { data: { session } } = await window.supabase.auth.getSession();
                    if (!session || !session.user || session.user.id !== data.owner_id) {
                        setReadOnly(true);
                    }
                } catch(e) { setReadOnly(true); }
            } catch (err) {
                console.error('[giapha] failed to load family by id', err);
            }
        }

        let isReadOnly = false;

        function setReadOnly(flag) {
            isReadOnly = flag;
            const badge = document.getElementById('readonly-badge');
            if (badge) badge.style.display = flag ? 'inline-flex' : 'none';
            if (flag) document.body.classList.add('readonly-mode');
            else document.body.classList.remove('readonly-mode');
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>"']/g, function(m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
        }

        // Open a family in the editor page
        function openFamily(familyId) {
            if (!familyId) return;
            const base = location.pathname.replace(/\/[^\/]*$/, '');
            const sep = base.endsWith('/') ? '' : '/';
            window.location.href = base + sep + 'giapha.html?family_id=' + encodeURIComponent(familyId);
        }

        // Sign-in/out provided by auth.js as window.signInWithGoogle / window.signOut

        function toggleSidebar() {
            document.body.classList.toggle('sidebar-collapsed');
            updateSidebarToggleButton();
        }

        function updateSidebarToggleButton() {
            const btn = document.getElementById('sidebar-toggle-btn');
            if (!btn) return;

            const isCollapsed = document.body.classList.contains('sidebar-collapsed');
            btn.innerText = isCollapsed ? '☰' : '✕';
            btn.title = isCollapsed ? 'Hiện menu trái' : 'Ẩn menu trái';
        }

        function generateId() {
            return '_' + Math.random().toString(36).substr(2, 9);
        }

        // Tìm kiếm nâng cao cấu trúc cây
        function findNodeById(root, id) {
            if (!root) return null;
            if (root.id === id) return { type: 'member', node: root, parent: null };
            
            if (root.spouses) {
                for (let s of root.spouses) {
                    if (s.id === id) return { type: 'spouse', node: s, mainMember: root };
                }
            }
            
            if (root.children) {
                for (let child of root.children) {
                    if (child.id === id) return { type: 'member', node: child, parent: root };
                    let found = findNodeById(child, id);
                    if (found) return found;
                }
            }
            return null;
        }

        async function saveToStorage() {
            try {
                // If Supabase client available and user signed in, persist to DB first
                if (window.supabase) {
                    try {
                        const { data: { session } } = await window.supabase.auth.getSession();
                        if (session && session.user) {
                            const owner_id = session.user.id;
                            const params = new URLSearchParams(location.search);
                            const familyIdFromQuery = params.get('family_id');

                            // Prepare row payload
                            const payload = {
                                name: (familyData && (familyData.treeName || familyData.name)) ? (familyData.treeName || familyData.name) : 'Gia phả',
                                owner_id,
                                content: familyData
                            };

                            if (familyIdFromQuery) {
                                // Update existing row
                                const { data, error } = await window.supabase
                                    .from('families')
                                    .update(payload)
                                    .eq('id', familyIdFromQuery)
                                    .select('id')
                                    .single();
                                if (error) console.warn('[giapha] failed to update family row', error);
                                else if (data && data.id) {
                                    // ensure local id matches DB id
                                    if (!familyData.id || familyData.id !== data.id) familyData.id = data.id;
                                }
                            } else {
                                // Insert new row
                                const { data, error } = await window.supabase
                                    .from('families')
                                    .insert(payload)
                                    .select('id')
                                    .single();
                                if (error) {
                                    console.warn('[giapha] failed to insert family row', error);
                                } else if (data && data.id) {
                                    // set familyData id to DB id and update URL (without reloading)
                                    familyData.id = data.id;
                                    const newUrl = new URL(location.href);
                                    newUrl.searchParams.set('family_id', data.id);
                                    history.replaceState(history.state, '', newUrl.toString());
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[giapha] error while saving to supabase', e);
                    }
                }
            } catch (err) {
                console.warn('[giapha] saveToStorage outer error', err);
            }

            // Always save a local copy
            try {
                localStorage.setItem('family_tree_data', JSON.stringify(familyData));
            } catch (e) {
                console.warn('[giapha] failed to write localStorage', e);
            }
        }

        function countPersons(root) {
            if (!root) return 0;
            const seen = new Set();
            function traverse(node) {
                if (!node) return;
                if (node.id) seen.add(node.id);
                if (node.spouses && node.spouses.length) {
                    node.spouses.forEach(s => { if (s && s.id) seen.add(s.id); });
                }
                if (node.children && node.children.length) {
                    node.children.forEach(c => traverse(c));
                }
            }
            traverse(root);
            return seen.size;
        }

        function updateTotalCount() {
            const el = document.getElementById('total-count');
            const count = familyData ? countPersons(familyData) : 0;
            if (el) el.innerText = `Tổng thành viên: ${count}`;
        }

        // QUẢN LÝ TÍNH NĂNG ZOOM & PAN (KÉO THẢ)
        function initPanZoomListeners() {
            const container = document.getElementById('tree-container');
            if (!container) {
                console.error('[giapha] initPanZoomListeners: #tree-container not found');
                return;
            }
            console.log('[giapha] initPanZoomListeners: attaching pointer listeners to #tree-container');
            
            // Bắt đầu kéo: dùng Pointer Events để hoạt động ổn định trên chuột và touchpads
            if (window.PointerEvent) {
                container.addEventListener('pointerdown', (e) => {
                if (document.body.classList.contains('print-mode')) return;
                // Nếu click vào các thẻ thành viên hoặc nút bấm thì không kích hoạt kéo màn hình
                if (e.target.closest && (e.target.closest('.card') || e.target.closest('.zoom-controls') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select'))) return;
                console.log('[giapha] pointerdown', {x: e.clientX, y: e.clientY, target: e.target.tagName});
                isDragging = true;
                startX = e.clientX - panX;
                startY = e.clientY - panY;
                try { container.setPointerCapture && container.setPointerCapture(e.pointerId); } catch(_) {}
            });

            // Di chuyển khi pointer thay đổi
                window.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                // throttle small moves? keep simple for now
                panX = e.clientX - startX;
                panY = e.clientY - startY;
                // small debug
                // console.log('[giapha] pointermove', {panX, panY});
                applyTransform();
            });

            // Kết thúc kéo
                window.addEventListener('pointerup', (e) => {
                    if (!isDragging) return;
                    console.log('[giapha] pointerup');
                    isDragging = false;
                    try { container.releasePointerCapture && container.releasePointerCapture(e.pointerId); } catch(_) {}
                });
            } else {
                // Fallback for older browsers: mouse events
                container.addEventListener('mousedown', (e) => {
                    if (document.body.classList.contains('print-mode')) return;
                    if (e.target.closest && (e.target.closest('.card') || e.target.closest('.zoom-controls') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select'))) return;
                    isDragging = true;
                    startX = e.clientX - panX;
                    startY = e.clientY - panY;
                });

                window.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    panX = e.clientX - startX;
                    panY = e.clientY - startY;
                    applyTransform();
                });

                window.addEventListener('mouseup', () => {
                    isDragging = false;
                });
            }

            // Lăn bánh xe chuột để Zoom In / Zoom Out
            container.addEventListener('wheel', (e) => {
                if (document.body.classList.contains('print-mode')) return;
                e.preventDefault();
                const zoomStep = 0.05;
                if (e.deltaY < 0) {
                    scale = Math.min(scale + zoomStep, 3); // Giới hạn tối đa phóng to là 3 lần
                } else {
                    scale = Math.max(scale - zoomStep, 0.15); // Giới hạn tối thiểu thu nhỏ là 0.15 lần
                }
                applyTransform();
            }, { passive: false });

            // Touch events: support one-finger pan and two-finger pinch-to-zoom
            function getTouchDistance(t1, t2) {
                const dx = t2.clientX - t1.clientX;
                const dy = t2.clientY - t1.clientY;
                return Math.hypot(dx, dy);
            }

            container.addEventListener('touchstart', (e) => {
                if (document.body.classList.contains('print-mode')) return;
                if (!e.touches || e.touches.length === 0) return;

                // If the touch is on an interactive element (buttons, links, inputs, sidebar toggle, zoom controls, cards, or sidebar), don't start pan
                const target = e.target;
                if (target && target.closest) {
                    const interactive = target.closest('button, a, input, select, textarea, .sidebar-toggle, .sidebar, .zoom-controls, .card');
                    if (interactive) return;
                }

                if (e.touches.length === 1) {
                    isDragging = true;
                    startX = e.touches[0].clientX - panX;
                    startY = e.touches[0].clientY - panY;
                    e.preventDefault();
                } else if (e.touches.length === 2) {
                    // Begin pinch
                    pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
                    initialScaleForPinch = scale;
                    e.preventDefault();
                }
            }, { passive: false });

            container.addEventListener('touchmove', (e) => {
                if (document.body.classList.contains('print-mode')) return;
                if (!e.touches || e.touches.length === 0) return;

                if (e.touches.length === 1 && isDragging) {
                    panX = e.touches[0].clientX - startX;
                    panY = e.touches[0].clientY - startY;
                    applyTransform();
                    e.preventDefault();
                } else if (e.touches.length === 2 && pinchStartDistance) {
                    const newDist = getTouchDistance(e.touches[0], e.touches[1]);
                    const ratio = newDist / pinchStartDistance;
                    scale = Math.max(0.15, Math.min(initialScaleForPinch * ratio, 3));
                    applyTransform();
                    e.preventDefault();
                }
            }, { passive: false });

            container.addEventListener('touchend', (e) => {
                // When fingers lifted, reset states appropriately
                if (!e.touches || e.touches.length === 0) {
                    isDragging = false;
                    pinchStartDistance = null;
                    initialScaleForPinch = null;
                } else if (e.touches.length === 1) {
                    // If one finger remains after pinch, allow continued pan
                    isDragging = true;
                    startX = e.touches[0].clientX - panX;
                    startY = e.touches[0].clientY - panY;
                    pinchStartDistance = null;
                    initialScaleForPinch = null;
                }
            });
        }

        function applyTransform() {
            const root = document.getElementById('tree-root');
            if (root) {
                // Sử dụng thuộc tính translate và scale của CSS để di chuyển và phóng to đồ họa
                root.style.transform = `translate(calc(-50% + ${panX}px), ${panY}px) scale(${scale})`;
            }
        }

        function zoomIn() {
            if (document.body.classList.contains('print-mode')) return;
            scale = Math.min(scale + 0.15, 3);
            applyTransform();
        }

        function zoomOut() {
            if (document.body.classList.contains('print-mode')) return;
            scale = Math.max(scale - 0.15, 0.15);
            applyTransform();
        }

        function resetZoom() {
            if (document.body.classList.contains('print-mode')) return;
            scale = 1;
            panX = 0;
            panY = 0;
            applyTransform();
        }

        function fitTreeToA0Viewport() {
            const container = document.getElementById('tree-container');
            const root = document.getElementById('tree-root');
            if (!container || !root) return;

            root.style.transform = 'translate(0px, 0px) scale(1)';

            const rootBounds = root.getBoundingClientRect();
            const containerBounds = container.getBoundingClientRect();

            if (!rootBounds.width || !rootBounds.height) return;

            const margin = 28;
            const availableWidth = Math.max(containerBounds.width - margin * 2, 100);
            const availableHeight = Math.max(containerBounds.height - margin * 2, 100);

            const fitScale = Math.min(
                availableWidth / rootBounds.width,
                availableHeight / rootBounds.height,
                1.5
            );

            const centeredX = (containerBounds.width - rootBounds.width * fitScale) / 2;
            const topY = margin;

            root.style.transform = `translate(${centeredX}px, ${topY}px) scale(${fitScale})`;
        }

        function restoreAfterPrint() {
            if (!prePrintState) return;

            document.body.classList.remove('print-mode');
            scale = prePrintState.scale;
            panX = prePrintState.panX;
            panY = prePrintState.panY;

            if (prePrintState.sidebarCollapsed) {
                document.body.classList.add('sidebar-collapsed');
            } else {
                document.body.classList.remove('sidebar-collapsed');
            }

            applyTransform();
            updateSidebarToggleButton();
            prePrintState = null;
        }

        function prepareAndPrintA0() {
            if (!familyData) {
                alert('Chưa có dữ liệu gia phả để in.');
                return;
            }

            prePrintState = {
                scale,
                panX,
                panY,
                sidebarCollapsed: document.body.classList.contains('sidebar-collapsed')
            };

            document.body.classList.remove('sidebar-collapsed');
            updateSidebarToggleButton();
            document.body.classList.add('print-mode');

            fitTreeToA0Viewport();
            setTimeout(() => {
                window.print();
            }, 120);
        }

        async function exportPDF() {
            if (!familyData) { alert('Chưa có dữ liệu gia phả để xuất.'); return; }
            if (typeof domtoimage === 'undefined' || typeof window.jspdf === 'undefined') {
                alert('Không thể tải thư viện. Vui lòng kiểm tra kết nối internet.');
                return;
            }

            const btn = document.getElementById('export-pdf-btn');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xuất...'; }

            const prevState = {
                scale, panX, panY,
                sidebarCollapsed: document.body.classList.contains('sidebar-collapsed')
            };

            try {
                document.body.classList.remove('sidebar-collapsed');
                document.body.classList.add('print-mode');
                updateSidebarToggleButton();

                const root = document.getElementById('tree-root');
                root.style.transform = 'none';
                root.style.willChange = 'auto';

                await new Promise(r => setTimeout(r, 200));

                const W = root.offsetWidth  || root.scrollWidth;
                const H = root.offsetHeight || root.scrollHeight;
                const PAD_MM = 8;

                const dataUrl = await domtoimage.toPng(root, {
                    bgcolor: '#ffffff',
                    width: W,
                    height: H,
                    filter: function(node) {
                        return !(node.classList && node.classList.contains('order'));
                    }
                });

                const { jsPDF } = window.jspdf;
                const pxToMm   = 25.4 / 96;
                const pageW    = W * pxToMm + PAD_MM * 2;
                const pageH    = H * pxToMm + PAD_MM * 2;

                const pdf = new jsPDF({
                    orientation: pageW >= pageH ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: [pageW, pageH],
                    compress: true,
                });

                pdf.addImage(dataUrl, 'PNG', PAD_MM, PAD_MM, W * pxToMm, H * pxToMm);

                const filename = (familyData.treeName || 'cay-gia-pha').replace(/\s+/g, '-') + '.pdf';
                pdf.save(filename);

            } catch (err) {
                alert('Lỗi khi xuất PDF: ' + (err.message || String(err)));
                console.error('[giapha] exportPDF', err);
            } finally {
                document.body.classList.remove('print-mode');
                if (prevState.sidebarCollapsed) document.body.classList.add('sidebar-collapsed');
                scale = prevState.scale;
                panX  = prevState.panX;
                panY  = prevState.panY;
                applyTransform();
                updateSidebarToggleButton();
                if (btn) { btn.disabled = false; btn.textContent = '📄 Xuất PDF'; }
            }
        }

        async function exportImage() {
            if (!familyData) {
                alert('Chưa có dữ liệu gia phả để xuất.');
                return;
            }
            if (typeof domtoimage === 'undefined') {
                alert('Không thể tải thư viện xuất ảnh. Vui lòng kiểm tra kết nối internet.');
                return;
            }

            const btn = document.getElementById('export-img-btn');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xuất...'; }

            const prevState = {
                scale, panX, panY,
                sidebarCollapsed: document.body.classList.contains('sidebar-collapsed')
            };

            try {
                document.body.classList.remove('sidebar-collapsed');
                document.body.classList.add('print-mode');
                updateSidebarToggleButton();

                const root = document.getElementById('tree-root');
                root.style.transform = 'none';
                root.style.willChange = 'auto';

                await new Promise(r => setTimeout(r, 180));

                const W = root.offsetWidth  || root.scrollWidth;
                const H = root.offsetHeight || root.scrollHeight;

                const dataUrl = await domtoimage.toPng(root, {
                    bgcolor: '#ffffff',
                    width: W,
                    height: H,
                    filter: function(node) {
                        return !(node.classList && node.classList.contains('order'));
                    }
                });

                const filename = (familyData.treeName || 'cay-gia-pha').replace(/\s+/g, '-') + '.png';
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                link.remove();
            } catch (err) {
                alert('Lỗi khi xuất ảnh: ' + (err.message || String(err)));
                console.error('[giapha] exportImage', err);
            } finally {
                document.body.classList.remove('print-mode');
                if (prevState.sidebarCollapsed) document.body.classList.add('sidebar-collapsed');
                scale = prevState.scale;
                panX  = prevState.panX;
                panY  = prevState.panY;
                applyTransform();
                updateSidebarToggleButton();
                if (btn) { btn.disabled = false; btn.textContent = '🖼️ Xuất PNG'; }
            }
        }

        // CHỨC NĂNG XÓA THÀNH VIÊN
        async function deleteMember() {
            if (!selectedNodeId) return;
            
            const res = findNodeById(familyData, selectedNodeId);
            if (!res) return;

            let confirmMsg = `Bạn có chắc chắn muốn xóa "${res.node.name}" không?`;
            
            if (res.type === 'member') {
                if (!res.parent) {
                    confirmMsg = `⚠️ Chú ý: Người này là Thành Viên Gốc. Xóa đi đồng nghĩa xóa TOÀN BỘ CÂY GIA PHẢ! Bạn vẫn muốn xóa?`;
                } else if (res.node.children && res.node.children.length > 0) {
                    confirmMsg = `⚠️ Cảnh báo quan trọng: Xóa "${res.node.name}" sẽ ĐỒNG THỜI XÓA SẠCH tất cả con, cháu, chắt... thuộc nhánh của người này! Hành động không thể khôi phục. Bạn đồng ý?`;
                }
            }

            if (confirm(confirmMsg)) {
                if (res.type === 'member' && !res.parent) {
                    // Xóa gốc (Xóa hết)
                    familyData = null;
                    selectedNodeId = null;
                } else if (res.type === 'spouse') {
                    // Xóa vợ hoặc chồng phối ngẫu
                    res.mainMember.spouses = res.mainMember.spouses.filter(s => s.id !== selectedNodeId);
                    
                    // Kiểm tra và dọn dẹp liên kết Cha/Mẹ của con cháu liên quan đến người vừa xóa
                    if (res.mainMember.children) {
                        res.mainMember.children.forEach(child => {
                            if (child.spouseParentId === selectedNodeId) {
                                child.spouseParentId = ""; // Trả về trạng thái không rõ mẹ/cha cụ thể
                            }
                        });
                    }
                    selectedNodeId = res.mainMember.id; // Chuyển vùng chọn về người phối ngẫu chính
                } else if (res.type === 'member' && res.parent) {
                    // Xóa con (Xóa toàn bộ nhánh con cháu bên dưới)
                    res.parent.children = res.parent.children.filter(c => c.id !== selectedNodeId);
                    selectedNodeId = res.parent.id; // Chuyển vùng chọn về cha mẹ của người vừa xóa
                }

                await saveToStorage();
                hideForm();
                renderTree();
            }
        }

        // FORM THAO TÁC THÊM MỚI
        function showAddForm(type) {
            document.getElementById('form-container').style.display = 'block';
            document.getElementById('form-type').value = type;
            document.getElementById('member-form').reset();
            
            document.getElementById('order-group').style.display = 'none';
            document.getElementById('spouse-parent-group').style.display = 'none';

            const res = findNodeById(familyData, selectedNodeId);

            if (type === 'root') {
                document.getElementById('form-title').innerText = "Thêm Thành Viên Gốc";
                // Show family/tree name field when creating root
                document.getElementById('family-name-group').style.display = 'block';
                const famInput = document.getElementById('input-family-name');
                famInput.value = (familyData && familyData.treeName) ? familyData.treeName : '';
                famInput.setAttribute('required', 'required');
            } else if (type === 'spouse') {
                document.getElementById('form-title').innerText = "Thêm Vợ / Chồng";
                document.getElementById('family-name-group').style.display = 'none';
                document.getElementById('input-family-name').removeAttribute('required');
                const current = res.type === 'member' ? res.node : res.mainMember;
                document.getElementById('input-gender').value = current.gender === 'Nam' ? 'Nữ' : 'Nam';
            } else if (type === 'child') {
                document.getElementById('form-title').innerText = "Thêm Con";
                document.getElementById('family-name-group').style.display = 'none';
                document.getElementById('input-family-name').removeAttribute('required');
                document.getElementById('order-group').style.display = 'flex';
                
                const bloodlineNode = res.type === 'member' ? res.node : res.mainMember;
                document.getElementById('input-order').value = (bloodlineNode.children ? bloodlineNode.children.length : 0) + 1;
                
                if (bloodlineNode.spouses && bloodlineNode.spouses.length > 0) {
                    document.getElementById('spouse-parent-group').style.display = 'flex';
                    const selectSpouse = document.getElementById('input-spouse-parent');
                    selectSpouse.innerHTML = '<option value="">-- Không chọn / Không rõ --</option>';
                    bloodlineNode.spouses.forEach(s => {
                        let role = s.gender === 'Nữ' ? 'Vợ' : 'Chồng';
                        let selectedAttr = (res.type === 'spouse' && res.node.id === s.id) ? 'selected' : '';
                        selectSpouse.innerHTML += `<option value="${s.id}" ${selectedAttr}>${s.name} (${role})</option>`;
                    });
                }
            }
        }

        // FORM THAO TÁC SỬA THÔNG TIN
        function showEditForm() {
            const res = findNodeById(familyData, selectedNodeId);
            if (!res) return;
            
            document.getElementById('form-container').style.display = 'block';
            document.getElementById('form-type').value = 'edit';
            document.getElementById('form-title').innerText = "Sửa Thông Tin";
            
            const node = res.node;
            document.getElementById('input-name').value = node.name;
            document.getElementById('input-gender').value = node.gender;
            document.getElementById('input-birth').value = node.birthYear || '';
            document.getElementById('input-death').value = (node.deathYear === 'Đang sống') ? '' : node.deathYear;
            // If editing the root member, allow editing the family/tree name
            if (res.type === 'member' && !res.parent) {
                document.getElementById('family-name-group').style.display = 'block';
                document.getElementById('input-family-name').value = familyData && familyData.treeName ? familyData.treeName : '';
                document.getElementById('input-family-name').removeAttribute('required');
            } else {
                document.getElementById('family-name-group').style.display = 'none';
                document.getElementById('input-family-name').removeAttribute('required');
            }
            
            if (res.type === 'member' && res.parent) {
                document.getElementById('order-group').style.display = 'flex';
                document.getElementById('input-order').value = node.birthOrder || 1;
                
                if (res.parent.spouses && res.parent.spouses.length > 0) {
                    document.getElementById('spouse-parent-group').style.display = 'flex';
                    const selectSpouse = document.getElementById('input-spouse-parent');
                    selectSpouse.innerHTML = '<option value="">-- Không chọn / Không rõ --</option>';
                    res.parent.spouses.forEach(s => {
                        let role = s.gender === 'Nữ' ? 'Vợ' : 'Chồng';
                        let selectedAttr = node.spouseParentId === s.id ? 'selected' : '';
                        selectSpouse.innerHTML += `<option value="${s.id}" ${selectedAttr}>${s.name} (${role})</option>`;
                    });
                } else {
                    document.getElementById('spouse-parent-group').style.display = 'none';
                }
            } else {
                document.getElementById('order-group').style.display = 'none';
                document.getElementById('spouse-parent-group').style.display = 'none';
            }
        }

        function hideForm() {
            document.getElementById('form-container').style.display = 'none';
        }

        async function handleFormSubmit(e) {
            e.preventDefault();
            
            const type = document.getElementById('form-type').value;
            const name = document.getElementById('input-name').value;
            const gender = document.getElementById('input-gender').value;
            const birth = document.getElementById('input-birth').value || "";
            let death = document.getElementById('input-death').value || "Đang sống";
            const order = parseInt(document.getElementById('input-order').value) || 1;
            const spouseParentId = document.getElementById('input-spouse-parent').value || "";
            const familyName = (document.getElementById('input-family-name') && document.getElementById('input-family-name').value) ? document.getElementById('input-family-name').value.trim() : '';

            if (type === 'edit') {
                const res = findNodeById(familyData, selectedNodeId);
                if (res) {
                    res.node.name = name;
                    res.node.gender = gender;
                    res.node.birthYear = birth;
                    res.node.deathYear = death;
                    
                    if (res.type === 'member') {
                        res.node.birthOrder = order;
                        res.node.spouseParentId = spouseParentId;
                        if (res.parent) {
                            res.parent.children.sort((a, b) => (a.birthOrder || 1) - (b.birthOrder || 1));
                        }
                        // If editing the root member, also allow updating the family/tree name
                        if (!res.parent) {
                            if (familyName) familyData.treeName = familyName;
                        }
                    }
                }
            } else if (type === 'root') {
                if (!familyName) {
                    alert('Vui lòng nhập Tên Gia Phả.');
                    return;
                }

                // Build local family object
                familyData = {
                    id: generateId(), treeName: familyName, name: name, gender: gender, birthYear: birth, deathYear: death,
                    birthOrder: 1, spouses: [], children: []
                };
                selectedNodeId = familyData.id;

                
            } else if (type === 'spouse') {
                const res = findNodeById(familyData, selectedNodeId);
                const target = res.type === 'member' ? res.node : res.mainMember;
                if (target) {
                    target.spouses.push({
                        id: generateId(), name: name, gender: gender, birthYear: birth, deathYear: death
                    });
                }
            } else if (type === 'child') {
                const res = findNodeById(familyData, selectedNodeId);
                const target = res.type === 'member' ? res.node : res.mainMember;
                if (target) {
                    const newChild = {
                        id: generateId(), name: name, gender: gender, birthYear: birth, deathYear: death,
                        birthOrder: order, spouseParentId: spouseParentId, spouses: [], children: []
                    };
                    if (!target.children) target.children = [];
                    target.children.push(newChild);
                    target.children.sort((a, b) => (a.birthOrder || 1) - (b.birthOrder || 1));
                }
            }

            await saveToStorage();
            hideForm();
            renderTree();
            selectMember(selectedNodeId);
        }

        function buildAncestryPath(targetId) {
            if (!familyData) return null;
            function search(node, path) {
                if (!node) return null;
                const cur = [...path, node.name];
                if (node.id === targetId) return cur;
                for (let child of (node.children || [])) {
                    const found = search(child, cur);
                    if (found) return found;
                }
                return null;
            }
            return search(familyData, []);
        }

        function selectMember(id) {
            selectedNodeId = id;

            if (document.body.classList.contains('sidebar-collapsed')) {
                document.body.classList.remove('sidebar-collapsed');
                updateSidebarToggleButton();
            }

            document.querySelectorAll('.card').forEach(el => el.classList.remove('card-selected'));
            const element = document.getElementById('card-' + id);
            if (element) element.classList.add('card-selected');

            const res = findNodeById(familyData, id);
            if (res) {
                const node = res.node;
                document.getElementById('root-actions').style.display = 'none';
                document.getElementById('member-actions').style.display = 'block';
                
                let extraInfo = '';
                if (res.type === 'spouse') {
                    extraInfo = `<br>Vị trí: Bạn đời của ${res.mainMember.name}`;
                } else {
                    extraInfo = `<br>Con thứ: ${node.birthOrder || 1}`;
                    if (node.spouseParentId && res.parent) {
                        let sp = res.parent.spouses.find(s => s.id === node.spouseParentId);
                        if (sp) {
                            let label = res.parent.gender === 'Nam' ? 'Mẹ' : 'Cha';
                            extraInfo += `<br>${label}: ${sp.name}`;
                        }
                    }
                }

                function renderPath(names) {
                    return names.map((n, i) => {
                        const esc = escapeHtml(n);
                        return i === names.length - 1
                            ? `<span class="ancestry-current">${esc}</span>`
                            : esc;
                    }).join(' <span class="ancestry-arrow">→</span> ');
                }

                let ancestryHtml = '';
                if (res.type === 'spouse') {
                    const mainPath = buildAncestryPath(res.mainMember.id);
                    if (mainPath) {
                        ancestryHtml = `<div class="ancestry-path">${renderPath([...mainPath, node.name + ' (Bạn đời)'])}</div>`;
                    }
                } else {
                    const path = buildAncestryPath(id);
                    if (path) {
                        ancestryHtml = `<div class="ancestry-path">${renderPath(path)}</div>`;
                    }
                }

                document.getElementById('selected-info').innerHTML = `
                    ${ancestryHtml}
                    <br>Giới tính: ${node.gender}<br>
                    Năm sinh: ${node.birthYear || 'Chưa rõ'}<br>
                    Năm mất: ${node.deathYear}${extraInfo}
                `;
            }
        }

        function formatYears(birthYear, deathYear) {
            const alive = !deathYear || deathYear === 'Đang sống';
            if (alive) return birthYear ? String(birthYear) : '';
            return (birthYear || '?') + ' - ' + deathYear;
        }

        // Tạo cây đồ họa (Đệ quy cấu trúc)
        // Tạo cây đồ họa (Đệ quy cấu trúc)
        function createTreeHTML(node, parentNode = null) {
            if (!node) return '';

            let html = `<li>`;
            html += `<div class="member-block" id="block-${node.id}">`;
            
            let yearsStr = formatYears(node.birthYear, node.deathYear);

            let parentSpouseText = '';
            if (node.spouseParentId && parentNode && parentNode.spouses) {
                let sp = parentNode.spouses.find(s => s.id === node.spouseParentId);
                if (sp) {
                    let relationLabel = parentNode.gender === 'Nam' ? 'Mẹ' : 'Cha';
                    parentSpouseText = `<div class="parent-spouse">(${relationLabel}: ${sp.name})</div>`;
                }
            }

            const genderClassMain = node.gender === 'Nam' ? 'gender-nam' : 'gender-nu';
            const selectedClassMain = selectedNodeId === node.id ? 'card-selected' : '';
            
            // 1. Tạo HTML cho thành viên chính
            let mainMemberHTML = `
                <div class="card ${genderClassMain} ${selectedClassMain}" id="card-${node.id}" onclick="selectMember('${node.id}'); event.stopPropagation();">
                    <div class="name">${node.name}</div>
                    <div class="years">${yearsStr}</div>
                    ${parentSpouseText}
                </div>
            `;

            let firstSpouseHTML = '';
            let otherSpousesHTML = '';

            if (node.spouses && node.spouses.length > 0) {
                // 2. Xử lý người vợ/chồng đầu tiên (Hiển thị bên trái thành viên chính)
                const firstSpouse = node.spouses[0];
                const fsGenderClass = firstSpouse.gender === 'Nam' ? 'gender-nam' : 'gender-nu';
                const fsSelectedClass = selectedNodeId === firstSpouse.id ? 'card-selected' : '';
                let fsYearsStr = formatYears(firstSpouse.birthYear, firstSpouse.deathYear);

                // Lưu ý dấu "+" nằm ở bên phải của người vợ/chồng đầu tiên này
                firstSpouseHTML = `
                    <div class="spouse-container">
                        <div class="card ${fsGenderClass} ${fsSelectedClass}" id="card-${firstSpouse.id}" onclick="selectMember('${firstSpouse.id}'); event.stopPropagation();">
                            <div class="name">${firstSpouse.name}</div>
                            <div class="years">${fsYearsStr}</div>
                        </div>
                        <div class="spouse-sign">+</div>
                    </div>
                `;

                // 3. Xử lý các người vợ/chồng tiếp theo từ người thứ 2 trở đi (Hiển thị bên phải)
                if (node.spouses.length > 1) {
                    otherSpousesHTML += `<div class="spouse-container">`;
                    for (let i = 1; i < node.spouses.length; i++) {
                        const spouse = node.spouses[i];
                        const genderClassSpouse = spouse.gender === 'Nam' ? 'gender-nam' : 'gender-nu';
                        const selectedClassSpouse = selectedNodeId === spouse.id ? 'card-selected' : '';
                        let sYearsStr = formatYears(spouse.birthYear, spouse.deathYear);

                        // Dấu "+" nằm ở bên trái của các người vợ/chồng tiếp theo
                        otherSpousesHTML += `
                            <div class="spouse-sign">+</div>
                            <div class="card ${genderClassSpouse} ${selectedClassSpouse}" id="card-${spouse.id}" onclick="selectMember('${spouse.id}'); event.stopPropagation();">
                                <div class="name">${spouse.name}</div>
                                <div class="years">${sYearsStr}</div>
                                </div>
                        `;
                    }
                    otherSpousesHTML += `</div>`;
                }
            }

            // 4. Ghép các khối lại theo đúng thứ tự: Trái -> Giữa -> Phải
            html += firstSpouseHTML + mainMemberHTML + otherSpousesHTML;

            html += `</div>`; // Đóng .member-block

            // Khối con cái (giữ nguyên)
            if (node.children && node.children.length > 0) {
                html += `<ul>`;
                node.children.forEach(child => {
                    html += createTreeHTML(child, node);
                });
                html += `</ul>`;
            }

            html += `</li>`;
            return html;
        }

        function renderTree() {
            const container = document.getElementById('tree-root');
            if (!familyData) {
                container.innerHTML = '';
                document.getElementById('root-actions').style.display = 'block';
                document.getElementById('member-actions').style.display = 'none';
                updateTotalCount();
                return;
            }
            container.innerHTML = `<ul>${createTreeHTML(familyData)}</ul>`;
            applyTransform(); // Giữ nguyên tọa độ dịch chuyển và tỉ lệ thu phóng sau khi render lại dữ liệu
            if (selectedNodeId) selectMember(selectedNodeId);
            updateTotalCount();
        }

        // XUẤT FILE JSON
        function exportJSON() {
            if (!familyData) {
                alert("Không có dữ liệu để xuất file!");
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(familyData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "cay_gia_pha.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        // NHẬP FILE JSON
        function triggerImportJSON() {
            document.getElementById('import-file').click();
        }

        function importJSON(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parsedData = JSON.parse(e.target.result);
                    if (parsedData && parsedData.name && parsedData.id) {
                        familyData = parsedData;
                        selectedNodeId = familyData.id;
                                    (async () => { await saveToStorage(); })();
                        resetZoom(); // Reset lại màn hình cho người dùng dễ nhìn cấu trúc cây mới nhập
                        renderTree();
                        alert("Nhập dữ liệu gia phả thành công!");
                    } else {
                        alert("Cấu trúc tệp JSON không đúng định dạng gia phả.");
                    }
                } catch (err) {
                    alert("Lỗi khi đọc file JSON: " + err.message);
                }
            };
            reader.readAsText(file);
            event.target.value = ''; 
        }


        // ── TÍNH NĂNG TÌM KIẾM THÀNH VIÊN ────────────────────────────────
        function getAllMembers(root) {
            const members = [];
            function traverse(node) {
                if (!node) return;
                members.push({ id: node.id, name: node.name, gender: node.gender, birthYear: node.birthYear, isSpouse: false });
                (node.spouses || []).forEach(s => {
                    members.push({ id: s.id, name: s.name, gender: s.gender, birthYear: s.birthYear, isSpouse: true });
                });
                (node.children || []).forEach(c => traverse(c));
            }
            traverse(root);
            return members;
        }

        function highlightMatch(text, query) {
            if (!query) return escapeHtml(text);
            const escaped = escapeHtml(text);
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return escaped.replace(new RegExp('(' + escapedQuery + ')', 'gi'), '<mark>$1</mark>');
        }

        function handleSearch(query) {
            const resultsEl = document.getElementById('search-results');
            if (!resultsEl) return;

            const q = (query || '').trim();
            if (!q || !familyData) {
                resultsEl.style.display = 'none';
                resultsEl.innerHTML = '';
                return;
            }

            const all = getAllMembers(familyData);
            const lower = q.toLowerCase();
            const matches = all.filter(m => m.name && m.name.toLowerCase().includes(lower));

            if (matches.length === 0) {
                resultsEl.innerHTML = '<div class="search-no-result">Không tìm thấy thành viên nào</div>';
            } else {
                resultsEl.innerHTML = matches.map(m => {
                    const icon = m.gender === 'Nữ' ? '👩' : '👨';
                    const meta = m.birthYear ? m.birthYear : '';
                    return '<div class="search-result-item" onclick="selectSearchResult(\'' + m.id + '\')">' +
                        '<span class="sri-icon">' + icon + '</span>' +
                        '<span class="sri-name">' + highlightMatch(m.name, q) + '</span>' +
                        (meta ? '<span class="sri-meta">' + meta + '</span>' : '') +
                    '</div>';
                }).join('');
            }
            resultsEl.style.display = 'block';
        }

        function panToCard(id) {
            const card      = document.getElementById('card-' + id);
            const container = document.getElementById('tree-container');
            if (!card || !container) return;
            const cr = container.getBoundingClientRect();
            const cc = card.getBoundingClientRect();
            panX += (cr.width  / 2) - (cc.left - cr.left + cc.width  / 2);
            panY += (cr.height / 2) - (cc.top  - cr.top  + cc.height / 2);
            applyTransform();
        }

        function selectSearchResult(id) {
            const searchInput = document.getElementById('search-input');
            const resultsEl   = document.getElementById('search-results');
            if (searchInput) searchInput.value = '';
            if (resultsEl)   { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }

            selectMember(id);
            // Đợi transition sidebar hoàn tất (250ms) rồi mới tính vị trí pan
            setTimeout(() => panToCard(id), 260);
        }

        // Đóng kết quả tìm kiếm khi click ra ngoài
        document.addEventListener('click', function (e) {
            const container = document.getElementById('search-container');
            if (container && !container.contains(e.target)) {
                const resultsEl = document.getElementById('search-results');
                if (resultsEl) resultsEl.style.display = 'none';
            }
        });

        window.addEventListener('afterprint', restoreAfterPrint);
        window.onload = init;