/* public/assets/app.js */
(function () {
  const App = window.APP || {};
  const isAdmin = App.mode === 'admin';
  const adminPath = (App.adminPath || 'admin').replace(/^\/+|\/+$/g, '');
  const $root = () => $('#spaRoot');

  // ===== Toastr
  if (window.toastr) {
    toastr.options = {
      positionClass: "toast-bottom-right",
      timeOut: 2400,
      progressBar: true
    };
  }

  // ===== AOS init
  function aos() {
    try { window.AOS && AOS.init({ duration: 650, once: true, offset: 40 }); } catch {}
  }

  // ===== Progress bar
  function progress(on) {
    const el = document.getElementById('topProgress');
    if (!el) return;
    if (on) {
      el.style.width = '30%';
      setTimeout(() => el.style.width = '70%', 160);
    } else {
      el.style.width = '100%';
      setTimeout(() => el.style.width = '0%', 220);
    }
  }

  // ===== Modal
  function modalOpen(title, html, footHtml) {
    $('#modalTitle').text(title || '');
    $('#modalBody').html(html || '');
    $('#modalFoot').html(footHtml || '');
    $('#modal').removeClass('hidden');
  }
  function modalClose() {
    $('#modal').addClass('hidden');
    $('#modalBody').html('');
    $('#modalFoot').html('');
  }
  $(document).on('click', '[data-modal-close="1"]', modalClose);

  // ===== Mobile nav / sidebar (SAFE)
  $(document).on('click', '#btnMobileNav', () => $('#mobileNav').toggleClass('hidden'));
  $(document).on('click', '#btnSidebar', () => $('#adminSidebar').toggleClass('open'));

  // ===== Helpers
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  // ===== URL mapping
  function toPartialUrl(prettyUrl) {
    const u = new URL(prettyUrl, location.origin);
    const path = u.pathname;

    // already partial
    if (path.startsWith('/p/')) return u.pathname + u.search;
    if (path.startsWith(`/${adminPath}/p/`)) return u.pathname + u.search;

    if (isAdmin) {
      // ✅ CRITICAL FIX: root admin harus ke login dulu (bukan dashboard)
      if (path === `/${adminPath}` || path === `/${adminPath}/`) return `/${adminPath}/p/login`;

      // pretty admin -> partial admin
      if (path === `/${adminPath}/login`) return `/${adminPath}/p/login`;
      if (path === `/${adminPath}/dashboard`) return `/${adminPath}/p/dashboard`;
      if (path === `/${adminPath}/orders`) return `/${adminPath}/p/orders`;
      if (path === `/${adminPath}/products`) return `/${adminPath}/p/products`;
      if (path === `/${adminPath}/withdraw`) return `/${adminPath}/p/withdraw`;
      if (path === `/${adminPath}/settings`) return `/${adminPath}/p/settings`;
      if (path === `/${adminPath}/whatsapp`) return `/${adminPath}/p/whatsapp`;
      if (path === `/${adminPath}/logs`) return `/${adminPath}/p/logs`;
      if (path === `/${adminPath}/audit`) return `/${adminPath}/p/audit`;

      return `/${adminPath}/p/login`;
    }

    // public pretty -> partial
    if (path === '/' || path === '') return '/p/landing';
    if (path === '/landing') return '/p/landing';
    if (path === '/order') return '/p/order';
    if (path === '/invoice') return `/p/invoice${u.search}`;

    return '/p/notfound';
  }

  function toPrettyUrl(partialOrPrettyUrl) {
    const u = new URL(partialOrPrettyUrl, location.origin);
    const path = u.pathname;

    // already pretty
    if (!path.startsWith('/p/') && !path.startsWith(`/${adminPath}/p/`)) return u.pathname + u.search;

    // admin partial -> admin pretty
    if (path.startsWith(`/${adminPath}/p/`)) {
      const sub = path.replace(`/${adminPath}/p/`, '');
      if (sub === 'login') return `/${adminPath}/login`;
      if (sub === 'dashboard') return `/${adminPath}/dashboard`;
      if (sub === 'orders') return `/${adminPath}/orders`;
      if (sub === 'products') return `/${adminPath}/products`;
      if (sub === 'withdraw') return `/${adminPath}/withdraw`;
      if (sub === 'settings') return `/${adminPath}/settings`;
      if (sub === 'whatsapp') return `/${adminPath}/whatsapp`;
      if (sub === 'logs') return `/${adminPath}/logs`;
      if (sub === 'audit') return `/${adminPath}/audit`;
      return `/${adminPath}/login`;
    }

    // public partial -> pretty
    if (path === '/p/landing') return '/';
    if (path === '/p/order') return '/order';
    if (path === '/p/invoice') return `/invoice${u.search}`;
    return '/';
  }

  // ===== SPA navigation
  async function go(prettyUrl, push = true) {
    const partialUrl = toPartialUrl(prettyUrl);
    const pretty = toPrettyUrl(prettyUrl);

    progress(true);
    try {
      // ✅ FIX: pakai ajax json, kalau ternyata html maka masuk catch dan kita render html.
      const r = await $.ajax({
        url: partialUrl,
        method: 'GET',
        dataType: 'json'
      });

      if (r && r.redirect) {
        location.href = r.redirect;
        return;
      }

      if (!r || r.ok === false) {
        if (r?.html) $root().html(r.html);
        if (r?.title) document.title = r.title;
        aos();
        return;
      }

      $root().html(r.html);
      if (r.title) document.title = r.title;

      if (push) history.pushState({ url: pretty }, '', pretty);

      bindAfterRender(partialUrl, r);
      aos();
    } catch (xhr) {
      const html = xhr && xhr.responseText;

      // ✅ FIX: kalau response html (redirect/page), render supaya tidak blank
      if (html && typeof html === 'string' && html.trim().startsWith('<')) {
        $root().html(html);
        if (push) history.pushState({ url: pretty }, '', pretty);
        aos();
        return;
      }

      // hard fallback
      location.href = prettyUrl;
    } finally {
      progress(false);
    }
  }

  // intercept internal links
  $(document).on('click', 'a[data-spa="1"]', function (e) {
    const href = $(this).attr('href');
    if (!href) return;
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    e.preventDefault();
    go(href, true);
  });

  window.addEventListener('popstate', (e) => {
    const url = e.state?.url || (location.pathname + location.search);
    go(url, false);
  });

  // ===== Logout
  $(document).on('click', '#btnLogout', async () => {
    try {
      const r = await $.post(`/${adminPath}/api/logout`);
      if (r?.redirect) location.href = r.redirect;
      else location.href = `/${adminPath}/login`;
    } catch {
      toastr?.error && toastr.error('Gagal logout');
    }
  });

  // ===== Realtime handlers
  if (window.WSRT && WSRT.on) {
    WSRT.on(async (msg) => {
      if (msg.type === 'invoice') {
        const qs = new URLSearchParams(location.search);
        const token = qs.get('token');
        if (token && msg.token === token) {
          await go(`/invoice?token=${encodeURIComponent(token)}`, false);
        }
      }

      if (msg.type === 'dashboard' && isAdmin) {
        if (location.pathname === `/${adminPath}/dashboard` || location.pathname === `/${adminPath}`) {
          refreshDashboardCards();
        }
      }

      if (msg.type === 'wa' && isAdmin) {
        const st = msg.state || {};
        const waBadge = document.getElementById('waBadge');
        if (waBadge) {
          waBadge.innerHTML = `<i class="ri-whatsapp-line"></i> WA: <b>${String(st.connection || '...').toUpperCase()}</b>`;
        }
        if (location.pathname === `/${adminPath}/whatsapp`) {
          updateWaPanel(st);
        }
      }

      if (msg.type === 'log' && isAdmin) {
        if (location.pathname === `/${adminPath}/logs`) {
          appendLogLine(msg.line);
        }
      }
    });

    // subscribe defaults
    if (isAdmin) {
      WSRT.subDashboard && WSRT.subDashboard(true);
      WSRT.subWa && WSRT.subWa(true);
      WSRT.subLogs && WSRT.subLogs(false);
    }
  }

  // ===== Page-specific after render
  function bindAfterRender(partialUrl, payload) {
    if (!isAdmin) {
      if (partialUrl.startsWith('/p/invoice')) {
        const qs = new URLSearchParams(location.search);
        const token = qs.get('token');
        if (token && window.WSRT && WSRT.subInvoice) WSRT.subInvoice(token);
      }
      if (partialUrl.startsWith('/p/order')) bindOrderForm();
      if (partialUrl.startsWith('/p/landing')) bindLanding();
      return;
    }

    // Admin pages
    if (partialUrl.includes(`/${adminPath}/p/login`)) bindAdminLogin();
    if (partialUrl.includes(`/${adminPath}/p/dashboard`)) refreshDashboardCards();
    if (partialUrl.includes(`/${adminPath}/p/orders`)) renderOrdersTable();
    if (partialUrl.includes(`/${adminPath}/p/products`)) renderProductsTables();
    if (partialUrl.includes(`/${adminPath}/p/withdraw`)) renderWithdrawTable();
    if (partialUrl.includes(`/${adminPath}/p/settings`)) bindSettings();
    if (partialUrl.includes(`/${adminPath}/p/whatsapp`)) bindWhatsappPage();
    if (partialUrl.includes(`/${adminPath}/p/logs`)) bindLogs();
    if (partialUrl.includes(`/${adminPath}/p/audit`)) renderAuditTable();
  }

  // ===== Public: landing hooks
  function bindLanding() {
    $('a[href*="#"]').off('click._hash').on('click._hash', function (e) {
      const href = $(this).attr('href');
      if (!href || !href.includes('#')) return;
      const id = href.split('#')[1];
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ===== Public: order form submit
  function bindOrderForm() {
    $('#orderForm').off('submit').on('submit', async function (e) {
      e.preventDefault();
      const $btn = $('#btnCreateInvoice');
      $btn.prop('disabled', true).text('Membuat invoice...');

      try {
        const payload = {
          product_id: $('#product_id').val(),
          tier_id: $('#tier_id').val(),
          game_id: $('#game_id').val(),
          nickname: $('#nickname').val(),
          whatsapp: $('#whatsapp').val(),
          email: $('#email').val()
        };

        const r = await $.post('/api/public/order', payload);
        if (!r.ok) {
          toastr?.error && toastr.error(r.message || 'Gagal');
          return;
        }

        toastr?.success && toastr.success(r.toast?.message || 'Invoice dibuat');

        if (r.data?.invoice_url) {
          const pretty = toPrettyUrl(r.data.invoice_url);
          go(pretty, true);
        }
      } catch {
        toastr?.error && toastr.error('Server error');
      } finally {
        $btn.prop('disabled', false).text('Buat Invoice');
      }
    });

    // tier options dynamic
    $('#product_id').off('change').on('change', function () {
      const pid = $(this).val();
      const all = window.__TIERS || [];
      const sel = $('#tier_id');
      sel.html('');
      all.filter(t => String(t.product_id) === String(pid) && Number(t.active) === 1)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .forEach(t => {
          sel.append(`<option value="${t.id}">${escapeHtml(t.label)} — Rp ${Number(t.price).toLocaleString('id-ID')}</option>`);
        });
    }).trigger('change');
  }

  // ===== Admin: login
  function bindAdminLogin() {
    $('#adminLoginForm').off('submit').on('submit', async function (e) {
      e.preventDefault();
      const btn = $('#btnAdminLogin');
      btn.prop('disabled', true).text('Login...');
      try {
        const r = await $.post(`/${adminPath}/api/login`, {
          username: $('#username').val(),
          password: $('#password').val()
        });
        if (!r.ok) {
          toastr?.error && toastr.error(r.message || 'Login gagal');
          return;
        }

        // ✅ FIX: arahkan ke pretty dashboard, bukan ?tab=...
        location.href = `/${adminPath}/dashboard`;
      } catch {
        toastr?.error && toastr.error('Server error');
      } finally {
        btn.prop('disabled', false).text('Login');
      }
    });

    $('#btnReqOtp').off('click').on('click', async () => {
      try {
        const r = await $.post(`/${adminPath}/api/reset/request`, {});
        if (r.ok) toastr?.success && toastr.success('OTP dikirim ke WA admin');
        else toastr?.error && toastr.error(r.message || 'Gagal');
      } catch {
        toastr?.error && toastr.error('Server error');
      }
    });

    $('#btnResetWithOtp').off('click').on('click', async () => {
      modalOpen('Reset Password (OTP)', `
        <div class="grid gap-3">
          <div>
            <div class="label">OTP</div>
            <input class="input" id="otpCode" placeholder="6 digit"/>
          </div>
          <div>
            <div class="label">Password Baru</div>
            <input class="input" id="newPass" type="password" placeholder="min 8 karakter"/>
          </div>
          <div class="help">OTP dikirim lewat WhatsApp bot ke nomor admin.</div>
        </div>
      `, `
        <button class="btn btn-ghost" data-modal-close="1">Tutup</button>
        <button class="btn btn-primary" id="btnDoReset"><i class="ri-key-2-line"></i> Reset</button>
      `);

      $('#btnDoReset').off('click').on('click', async () => {
        try {
          const r = await $.post(`/${adminPath}/api/reset/confirm`, {
            otp: $('#otpCode').val(),
            new_password: $('#newPass').val()
          });
          if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
          toastr?.success && toastr.success('Password berhasil direset');
          modalClose();
        } catch {
          toastr?.error && toastr.error('Server error');
        }
      });
    });
  }

  // ===== Admin: dashboard cards
  async function refreshDashboardCards() {
    try {
      const r = await $.get(`/${adminPath}/api/dashboard/json`);
      if (!r.ok) return;
      $('#statOrders').text(r.data.orders);
      $('#statPaid').text(r.data.paid);
      $('#statWaiting').text(r.data.waiting);
    } catch {}
  }

  // ===== Grid helpers
  function pill(v) {
    const s = String(v || '').toLowerCase();
    if (!window.gridjs) return escapeHtml(v);
    if (['paid', 'done', 'success', 'open'].includes(s)) return gridjs.html(`<span class="pill ok">${escapeHtml(v)}</span>`);
    if (['pending', 'waiting', 'processing', 'connecting'].includes(s)) return gridjs.html(`<span class="pill warn">${escapeHtml(v)}</span>`);
    return gridjs.html(`<span class="pill bad">${escapeHtml(v)}</span>`);
  }

  // ===== Admin: Orders table (Grid.js)
  function renderOrdersTable() {
    const el = document.getElementById('ordersTable');
    if (!el || !window.gridjs) return;

    const rows = window.__ORDERS || [];
    el.innerHTML = '';

    new gridjs.Grid({
      search: true,
      pagination: { limit: 12 },
      sort: true,
      columns: [
        { name: 'Order ID' },
        { name: 'Produk' },
        { name: 'Game ID' },
        { name: 'Nickname' },
        { name: 'WA' },
        { name: 'Total' },
        { name: 'Pay' },
        { name: 'Fulfill' },
        { name: 'Action', sort: false }
      ],
      data: rows.map(o => [
        o.order_id,
        o.product_name,
        o.game_id || '-',
        o.nickname || '-',
        o.whatsapp_raw || '-',
        `Rp ${Number(o.gross_amount || 0).toLocaleString('id-ID')}`,
        pill(o.pay_status),
        pill(o.fulfill_status),
        gridjs.html(`
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-xs" data-act="processing" data-id="${o.order_id}"><i class="ri-loader-4-line"></i> Processing</button>
            <button class="btn btn-primary btn-xs" data-act="done" data-id="${o.order_id}"><i class="ri-check-line"></i> Done</button>
            <button class="btn btn-danger btn-xs" data-act="rejected" data-id="${o.order_id}"><i class="ri-close-line"></i> Reject</button>
          </div>
        `)
      ])
    }).render(el);

    $(document).off('click._orderAct').on('click._orderAct', 'button[data-id][data-act]', function () {
      const orderId = $(this).data('id');
      const act = $(this).data('act');

      modalOpen(`Update Order: ${orderId}`, `
        <div class="grid gap-3">
          <div class="badge"><i class="ri-information-line"></i> Action: <b>${escapeHtml(String(act).toUpperCase())}</b></div>
          <div>
            <div class="label">Catatan Admin (opsional)</div>
            <textarea class="textarea" id="orderNote" placeholder="contoh: Top up sudah masuk. Terima kasih."></textarea>
          </div>
          <div class="help">User akan menerima notifikasi WhatsApp + link invoice.</div>
        </div>
      `, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-primary" id="btnSaveOrder"><i class="ri-save-3-line"></i> Simpan</button>
      `);

      $('#btnSaveOrder').off('click').on('click', async () => {
        try {
          const r = await $.post(`/${adminPath}/api/order/${encodeURIComponent(orderId)}/status`, {
            action: act,
            note: $('#orderNote').val()
          });
          if (!r.ok) { toastr?.error && toastr.error(r.message || 'Gagal'); return; }
          toastr?.success && toastr.success('Order updated');
          modalClose();
          go(`/${adminPath}/orders`, false);
        } catch {
          toastr?.error && toastr.error('Server error');
        }
      });
    });
  }

  // ===== Admin: Products tables + delete action
  function renderProductsTables() {
    // Products
    const elP = document.getElementById('productsTable');
    if (elP && window.gridjs) {
      elP.innerHTML = '';
      const rows = window.__PRODUCTS || [];
      new gridjs.Grid({
        search: true,
        pagination: { limit: 10 },
        sort: true,
        columns: [
          { name: 'ID' },
          { name: 'SKU' },
          { name: 'Nama' },
          { name: 'Active' },
          { name: 'Action', sort: false }
        ],
        data: rows.map(p => [
          p.id,
          p.sku,
          p.name,
          p.active ? gridjs.html(`<span class="pill ok">ON</span>`) : gridjs.html(`<span class="pill bad">OFF</span>`),
          gridjs.html(`
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-xs" data-prod-edit="${p.id}"><i class="ri-edit-line"></i></button>
              <button class="btn btn-danger btn-xs" data-prod-del="${p.id}"><i class="ri-delete-bin-6-line"></i></button>
            </div>
          `)
        ])
      }).render(elP);
    }

    // Tiers
    const elT = document.getElementById('tiersTable');
    if (elT && window.gridjs) {
      elT.innerHTML = '';
      const rows = window.__TIERS || [];
      new gridjs.Grid({
        search: true,
        pagination: { limit: 12 },
        sort: true,
        columns: [
          { name: 'ID' },
          { name: 'Product ID' },
          { name: 'Label' },
          { name: 'Qty' },
          { name: 'Price' },
          { name: 'Action', sort: false }
        ],
        data: rows.map(t => [
          t.id,
          t.product_id,
          t.label,
          t.qty,
          `Rp ${Number(t.price || 0).toLocaleString('id-ID')}`,
          gridjs.html(`
            <div class="flex gap-2">
              <button class="btn btn-danger btn-xs" data-tier-del="${t.id}"><i class="ri-delete-bin-6-line"></i></button>
            </div>
          `)
        ])
      }).render(elT);
    }

    // Create product
    $('#btnAddProduct').off('click').on('click', () => {
      modalOpen('Tambah Produk', `
        <div class="grid gap-3">
          <div><div class="label">SKU</div><input class="input" id="pSku" placeholder="RD-001"/></div>
          <div><div class="label">Nama</div><input class="input" id="pName" placeholder="Royal Dreams Chips"/></div>
          <div><div class="label">Image URL (opsional)</div><input class="input" id="pImg" placeholder="https://..."/></div>
        </div>
      `, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-primary" id="btnSaveP"><i class="ri-save-3-line"></i> Simpan</button>
      `);

      $('#btnSaveP').off('click').on('click', async () => {
        const r = await $.post(`/${adminPath}/api/products/create`, {
          sku: $('#pSku').val(),
          name: $('#pName').val(),
          image: $('#pImg').val(),
          active: 1,
          sort_order: 0
        });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Produk dibuat');
        modalClose();
        go(`/${adminPath}/products`, false);
      });
    });

    // Create tier
    $('#btnAddTier').off('click').on('click', () => {
      const products = window.__PRODUCTS || [];
      modalOpen('Tambah Nominal (Tier)', `
        <div class="grid gap-3">
          <div>
            <div class="label">Produk</div>
            <select class="select" id="tProd">
              ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (ID ${p.id})</option>`).join('')}
            </select>
          </div>
          <div><div class="label">Label</div><input class="input" id="tLabel" placeholder="1B"/></div>
          <div class="grid grid-cols-2 gap-3">
            <div><div class="label">Qty</div><input class="input" id="tQty" type="number" value="1"/></div>
            <div><div class="label">Harga</div><input class="input" id="tPrice" type="number" value="65000"/></div>
          </div>
          <div class="help">Contoh label: 120M / 250M / 1B / 10-19B (64.500/B)</div>
        </div>
      `, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-primary" id="btnSaveT"><i class="ri-save-3-line"></i> Simpan</button>
      `);

      $('#btnSaveT').off('click').on('click', async () => {
        const r = await $.post(`/${adminPath}/api/tiers/create`, {
          product_id: $('#tProd').val(),
          label: $('#tLabel').val(),
          qty: $('#tQty').val(),
          price: $('#tPrice').val()
        });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Tier dibuat');
        modalClose();
        go(`/${adminPath}/products`, false);
      });
    });

    // delete handlers
    $(document).off('click._pd').on('click._pd', '[data-prod-del]', async function () {
      const id = $(this).data('prod-del');
      modalOpen('Hapus Produk?', `<div class="muted">Produk ID <b>${id}</b> akan dihapus.</div>`, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-danger" id="btnDelP"><i class="ri-delete-bin-6-line"></i> Hapus</button>
      `);
      $('#btnDelP').off('click').on('click', async () => {
        const r = await $.post(`/${adminPath}/api/products/delete`, { id });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Produk dihapus');
        modalClose();
        go(`/${adminPath}/products`, false);
      });
    });

    $(document).off('click._td').on('click._td', '[data-tier-del]', async function () {
      const id = $(this).data('tier-del');
      modalOpen('Hapus Tier?', `<div class="muted">Tier ID <b>${id}</b> akan dihapus.</div>`, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-danger" id="btnDelT"><i class="ri-delete-bin-6-line"></i> Hapus</button>
      `);
      $('#btnDelT').off('click').on('click', async () => {
        const r = await $.post(`/${adminPath}/api/tiers/delete`, { id });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Tier dihapus');
        modalClose();
        go(`/${adminPath}/products`, false);
      });
    });
  }

  // ===== Admin: Withdraw table
  function renderWithdrawTable() {
    const el = document.getElementById('withdrawTable');
    if (!el || !window.gridjs) return;

    el.innerHTML = '';
    const rows = window.__WITHDRAWS || [];

    new gridjs.Grid({
      search: true,
      pagination: { limit: 12 },
      sort: true,
      columns: ['ID', 'WD ID', 'Bank', 'Rek', 'Nama', 'Nominal', 'Status', 'Action'],
      data: rows.map(w => [
        w.id,
        w.wd_id,
        w.bank_code,
        w.account_number,
        w.account_name || '-',
        `Rp ${Number(w.nominal || 0).toLocaleString('id-ID')}`,
        pill(w.status),
        gridjs.html(`
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-xs" data-wd-check="${w.id}"><i class="ri-search-line"></i></button>
            <button class="btn btn-primary btn-xs" data-wd-submit="${w.id}"><i class="ri-send-plane-2-line"></i></button>
            <button class="btn btn-ghost btn-xs" data-wd-status="${w.id}"><i class="ri-refresh-line"></i></button>
          </div>
        `)
      ])
    }).render(el);

    $('#btnNewWithdraw').off('click').on('click', () => {
      modalOpen('Buat Withdraw', `
        <div class="grid gap-3">
          <div class="grid grid-cols-2 gap-3">
            <div><div class="label">Bank Code</div><input class="input" id="wdBank" placeholder="DANA / OVO / BCA"/></div>
            <div><div class="label">Nomor Rek/Wallet</div><input class="input" id="wdAcc" placeholder="0813xxxx"/></div>
          </div>
          <div><div class="label">Nominal</div><input class="input" id="wdNom" type="number" value="10000"/></div>
          <div class="help">Setelah buat draft, klik 🔍 untuk auto-detect nama.</div>
        </div>
      `, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-primary" id="btnCreateWd"><i class="ri-save-3-line"></i> Buat</button>
      `);

      $('#btnCreateWd').off('click').on('click', async () => {
        const r = await $.post(`/${adminPath}/api/withdraw/create`, {
          bank_code: $('#wdBank').val(),
          account_number: $('#wdAcc').val(),
          nominal: $('#wdNom').val()
        });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Draft dibuat');
        modalClose();
        go(`/${adminPath}/withdraw`, false);
      });
    });

    $(document).off('click._wd').on('click._wd', '[data-wd-check],[data-wd-submit],[data-wd-status]', async function () {
      const id = $(this).data('wd-check') || $(this).data('wd-submit') || $(this).data('wd-status');

      if ($(this).data('wd-check')) {
        const r = await $.post(`/${adminPath}/api/withdraw/${id}/check`, {});
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal cek');
        toastr?.success && toastr.success('Nama terdeteksi: ' + (r.data?.account_name || '-'));
        go(`/${adminPath}/withdraw`, false);
      }

      if ($(this).data('wd-submit')) {
        modalOpen('Submit Withdraw', `
          <div class="grid gap-3">
            <div class="label">Catatan (opsional)</div>
            <input class="input" id="wdNote" placeholder="Withdraw saldo..."/>
          </div>
        `, `
          <button class="btn btn-ghost" data-modal-close="1">Batal</button>
          <button class="btn btn-primary" id="btnDoSubmit"><i class="ri-send-plane-2-line"></i> Submit</button>
        `);
        $('#btnDoSubmit').off('click').on('click', async () => {
          const r = await $.post(`/${adminPath}/api/withdraw/${id}/submit`, { note: $('#wdNote').val() });
          if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal submit');
          toastr?.success && toastr.success('Submitted');
          modalClose();
          go(`/${adminPath}/withdraw`, false);
        });
      }

      if ($(this).data('wd-status')) {
        const r = await $.post(`/${adminPath}/api/withdraw/${id}/status`, {});
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal cek status');
        toastr?.success && toastr.success('Status diperbarui');
        go(`/${adminPath}/withdraw`, false);
      }
    });
  }

  // ===== Admin: Settings
  function bindSettings() {
    $('#btnTestGateway').off('click').on('click', async () => {
      const r = await $.post(`/${adminPath}/api/settings/test`, {});
      if (!r.ok) return toastr?.error && toastr.error(r.message || 'Test gagal');
      toastr?.success && toastr.success('Gateway OK');
      modalOpen('Gateway Profile', `
        <pre class="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto">${escapeHtml(JSON.stringify(r.data, null, 2))}</pre>
      `, `<button class="btn btn-primary" data-modal-close="1">OK</button>`);
    });

    $('#settingsForm').off('submit').on('submit', async function (e) {
      e.preventDefault();
      const btn = $('#btnSaveSettings');
      btn.prop('disabled', true).text('Menyimpan...');
      try {
        const r = await $.post(`/${adminPath}/api/settings/save`, {
          site_name: $('#site_name').val(),
          site_url: $('#site_url').val(),
          api_url: $('#api_url').val(),
          api_key: $('#api_key').val(),
          wa_admin: $('#wa_admin').val(),
          webhook_secret: $('#webhook_secret').val()
        });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Settings tersimpan');
      } catch {
        toastr?.error && toastr.error('Server error');
      } finally {
        btn.prop('disabled', false).text('Simpan');
      }
    });
  }

  // ===== Admin: WhatsApp
  function bindWhatsappPage() {
    WSRT?.subWa && WSRT.subWa(true);

    $.get(`/${adminPath}/api/wa/status`).then(r => {
      if (r.ok) updateWaPanel(r.data);
    });

    $('#btnWaPair').off('click').on('click', async () => {
      const phone = $('#waPairPhone').val();
      const custom = $('#waPairCustom').val();
      const btn = $('#btnWaPair');
      btn.prop('disabled', true).text('Requesting...');
      try {
        const r = await $.post(`/${adminPath}/api/wa/pair`, { phone, custom });
        if (!r.ok) return toastr?.error && toastr.error(r.message || 'Gagal');
        toastr?.success && toastr.success('Pairing code dibuat');
        $('#waPairCode').text(r.data.code);
      } catch {
        toastr?.error && toastr.error('Server error');
      } finally {
        btn.prop('disabled', false).html('<i class="ri-link"></i> Request Pairing Code');
      }
    });

    $('#btnWaReset').off('click').on('click', async () => {
      modalOpen('Reset WhatsApp Session?', `<div class="muted">Session WA akan dihapus. Kamu harus connect ulang via QR/pair.</div>`, `
        <button class="btn btn-ghost" data-modal-close="1">Batal</button>
        <button class="btn btn-danger" id="btnDoWaReset"><i class="ri-logout-circle-r-line"></i> Reset</button>
      `);
      $('#btnDoWaReset').off('click').on('click', async () => {
        const r = await $.post(`/${adminPath}/api/wa/logout`, {});
        if (r.ok) toastr?.success && toastr.success('Session direset');
        else toastr?.error && toastr.error(r.message || 'Gagal');
        modalClose();
      });
    });
  }

  function updateWaPanel(st) {
    $('#waStatus').text((st.connection || 'idle').toUpperCase());
    if (st.last_qr_png) {
      $('#waQrImg').attr('src', st.last_qr_png).removeClass('hidden');
      $('#waQrHint').removeClass('hidden');
    } else {
      $('#waQrImg').addClass('hidden');
      $('#waQrHint').addClass('hidden');
    }
    if (st.pairing_code) {
      $('#waPairCode').text(st.pairing_code);
      $('#pairBox').removeClass('hidden');
    } else {
      $('#pairBox').addClass('hidden');
    }
  }

  // ===== Admin: Live logs
  function bindLogs() {
    WSRT?.subLogs && WSRT.subLogs(true);
    $('#btnExportLogs').off('click').on('click', () => {
      const text = $('#logBox').text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `live-logs-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function appendLogLine(line) {
    const el = document.getElementById('logBox');
    if (!el) return;
    const s = `[${line.ts}] ${String(line.level || 'info').toUpperCase()} - ${line.msg} ${line.meta ? JSON.stringify(line.meta) : ''}\n`;
    el.textContent += s;
    el.scrollTop = el.scrollHeight;
  }

  // ===== Admin: Audit table
  function renderAuditTable() {
    const el = document.getElementById('auditTable');
    if (!el || !window.gridjs) return;
    el.innerHTML = '';
    const rows = window.__AUDIT || [];
    new gridjs.Grid({
      search: true,
      pagination: { limit: 12 },
      sort: true,
      columns: ['Time', 'Actor', 'Action', 'Target', 'Meta'],
      data: rows.map(a => [
        a.created_at,
        `${a.actor}${a.actor_id ? `#${a.actor_id}` : ''}`,
        a.action,
        `${a.target || '-'}:${a.target_id || '-'}`,
        gridjs.html(`<span class="muted text-xs">${escapeHtml(JSON.stringify(a.meta || {}))}</span>`)
      ])
    }).render(el);
  }

  // ===== Boot (CRITICAL FIX)
  function boot() {
    aos();

    const currentPretty = location.pathname + location.search;

    if (isAdmin) {
      // ✅ FIX: kalau buka /admin langsung -> /admin/login
      if (location.pathname === `/${adminPath}` || location.pathname === `/${adminPath}/`) {
        go(`/${adminPath}/login`, true);
      } else {
        go(currentPretty, false);
      }
      return;
    }

    // public
    go(currentPretty, false);
  }

  boot();
})();
