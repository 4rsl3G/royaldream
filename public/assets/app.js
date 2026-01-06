/* public/assets/app.js */
(function () {
  const App = window.APP || {};
  const isAdmin = App.mode === 'admin';
  const adminPath = (App.adminPath || 'admin').replace(/^\/+|\/+$/g, '');
  const $root = () => $('#spaRoot');

  // ========= Toastr =========
  if (window.toastr) {
    toastr.options = {
      positionClass: 'toast-bottom-right',
      timeOut: 2400,
      progressBar: true
    };
  }

  // ========= AOS =========
  function aos() {
    try { window.AOS && AOS.init({ duration: 650, once: true, offset: 40 }); } catch {}
  }

  // ========= Progress bar =========
  function progress(on) {
    const el = document.getElementById('topProgress');
    if (!el) return;
    if (on) {
      el.style.width = '30%';
      setTimeout(() => (el.style.width = '70%'), 160);
    } else {
      el.style.width = '100%';
      setTimeout(() => (el.style.width = '0%'), 220);
    }
  }

  // ========= Modal =========
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

  // ========= Safe bind buttons (no error if missing) =========
  $(document).on('click', '#btnMobileNav', () => $('#mobileNav').toggleClass('hidden'));
  $(document).on('click', '#btnSidebar', () => $('#adminSidebar').toggleClass('open'));

  // ========= Helpers =========
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // ========= URL mapping =========
  // Kita mau user-friendly URL:
  // Public:
  //   "/"           -> fetch "/p/landing"
  //   "/order"      -> fetch "/p/order"
  //   "/invoice?.." -> fetch "/p/invoice?.."
  //
  // Admin:
  //   "/<admin>"              -> fetch "/<admin>/p/dashboard"
  //   "/<admin>/login"        -> fetch "/<admin>/p/login"
  //   "/<admin>/dashboard"    -> fetch "/<admin>/p/dashboard"
  //   "/<admin>/orders"       -> fetch "/<admin>/p/orders"
  //   dst...
  //
  function toPartialUrl(prettyUrl) {
    const u = new URL(prettyUrl, location.origin);
    const path = u.pathname;

    // allow direct partial
    if (path.startsWith('/p/')) return u.pathname + u.search;
    if (isAdmin && path.startsWith(`/${adminPath}/p/`)) return u.pathname + u.search;

    if (isAdmin) {
      // admin pretty -> partial
      if (path === `/${adminPath}` || path === `/${adminPath}/`) return `/${adminPath}/p/dashboard`;
      if (path === `/${adminPath}/login`) return `/${adminPath}/p/login`;
      if (path === `/${adminPath}/dashboard`) return `/${adminPath}/p/dashboard`;
      if (path === `/${adminPath}/orders`) return `/${adminPath}/p/orders`;
      if (path === `/${adminPath}/products`) return `/${adminPath}/p/products`;
      if (path === `/${adminPath}/withdraw`) return `/${adminPath}/p/withdraw`;
      if (path === `/${adminPath}/settings`) return `/${adminPath}/p/settings`;
      if (path === `/${adminPath}/whatsapp`) return `/${adminPath}/p/whatsapp`;
      if (path === `/${adminPath}/logs`) return `/${adminPath}/p/logs`;
      if (path === `/${adminPath}/audit`) return `/${adminPath}/p/audit`;

      // fallback
      return `/${adminPath}/p/login`;
    }

    // public pretty -> partial
    if (path === '/' || path === '') return '/p/landing';
    if (path === '/landing') return '/p/landing';
    if (path === '/order') return '/p/order';
    if (path === '/invoice') return `/p/invoice${u.search}`;

    // kalau user ketik /p/... tetap bisa
    return '/p/notfound';
  }

  function toPrettyUrl(partialOrPrettyUrl) {
    const u = new URL(partialOrPrettyUrl, location.origin);
    const path = u.pathname;

    // already pretty
    if (!path.startsWith('/p/') && !(isAdmin && path.startsWith(`/${adminPath}/p/`))) return u.pathname + u.search;

    if (isAdmin && path.startsWith(`/${adminPath}/p/`)) {
      const sub = path.replace(`/${adminPath}/p/`, '');
      if (sub === 'dashboard') return `/${adminPath}/dashboard`;
      if (sub === 'login') return `/${adminPath}/login`;
      if (sub === 'orders') return `/${adminPath}/orders`;
      if (sub === 'products') return `/${adminPath}/products`;
      if (sub === 'withdraw') return `/${adminPath}/withdraw`;
      if (sub === 'settings') return `/${adminPath}/settings`;
      if (sub === 'whatsapp') return `/${adminPath}/whatsapp`;
      if (sub === 'logs') return `/${adminPath}/logs`;
      if (sub === 'audit') return `/${adminPath}/audit`;
      return `/${adminPath}/dashboard`;
    }

    // public
    if (path === '/p/landing') return '/';
    if (path === '/p/order') return '/order';
    if (path === '/p/invoice') return `/invoice${u.search}`;
    return '/';
  }

  // ========= SPA navigation =========
  async function go(prettyUrl, push = true) {
    const partialUrl = toPartialUrl(prettyUrl);
    const pretty = toPrettyUrl(prettyUrl);

    progress(true);
    try {
      const r = await $.get(partialUrl);

      // redirect support
      if (r && r.redirect) {
        location.href = r.redirect;
        return;
      }

      // expected JSON payload: { ok, title, html }
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
    } catch (e) {
      // hard fallback to pretty page
      location.href = prettyUrl;
    } finally {
      progress(false);
    }
  }

  // intercept only internal links
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

  // ========= Logout =========
  $(document).on('click', '#btnLogout', async () => {
    try {
      // sesuai style route kamu: /<adminPath>/api/logout
      const r = await $.post(`/${adminPath}/api/logout`);
      if (r?.redirect) location.href = r.redirect;
      else location.href = `/${adminPath}/login`;
    } catch {
      toastr?.error && toastr.error('Gagal logout');
    }
  });

  // ========= Realtime WSRT =========
  if (window.WSRT && WSRT.on) {
    WSRT.on(async (msg) => {
      if (msg.type === 'invoice') {
        const qs = new URLSearchParams(location.search);
        const token = qs.get('token');
        if (token && msg.token === token) {
          // refresh invoice without changing url
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

  // ========= After render hooks =========
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

  // ========= Public: landing =========
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

  // ========= Public: order =========
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

        // backend kamu kirim invoice_url, kita ubah jadi pretty kalau /p/invoice...
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
      all.filter((t) => String(t.product_id) === String(pid) && Number(t.active) === 1)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .forEach((t) => {
          sel.append(`<option value="${t.id}">${escapeHtml(t.label)} — Rp ${Number(t.price).toLocaleString('id-ID')}</option>`);
        });
    }).trigger('change');
  }

  // ========= Admin: login =========
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
        location.href = r.redirect || `/${adminPath}`;
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
      } catch { toastr?.error && toastr.error('Server error'); }
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
        } catch { toastr?.error && toastr.error('Server error'); }
      });
    });
  }

  // ========= Admin: dashboard cards =========
  async function refreshDashboardCards() {
    try {
      const r = await $.get(`/${adminPath}/api/dashboard/json`);
      if (!r.ok) return;
      $('#statOrders').text(r.data.orders);
      $('#statPaid').text(r.data.paid);
      $('#statWaiting').text(r.data.waiting);
    } catch {}
  }

  // ========= Grid helpers =========
  function pill(v) {
    const s = String(v || '').toLowerCase();
    if (!window.gridjs) return escapeHtml(v);
    if (['paid', 'done', 'success', 'open'].includes(s)) return gridjs.html(`<span class="pill ok">${escapeHtml(v)}</span>`);
    if (['pending', 'waiting', 'processing', 'connecting'].includes(s)) return gridjs.html(`<span class="pill warn">${escapeHtml(v)}</span>`);
    return gridjs.html(`<span class="pill bad">${escapeHtml(v)}</span>`);
  }

  // ========= Admin: Orders table =========
  function renderOrdersTable() {
    const el = document.getElementById('ordersTable');
    if (!el || !window.gridjs) return;

    const rows = window.__ORDERS || [];
    el.innerHTML = '';

    new gridjs.Grid({
      search: true,
      pagination: { limit: 12 },
      sort: true,
      columns: ['Order ID', 'Produk', 'Game ID', 'Nickname', 'WA', 'Total', 'Pay', 'Fulfill', { name: 'Action', sort: false }],
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
        } catch { toastr?.error && toastr.error('Server error'); }
      });
    });
  }

  // ========= Admin: Products / Withdraw / Settings / WA / Logs / Audit =========
  // (Isi fungsi-fungsi ini kamu sudah punya; biarkan sesuai versi kamu—tidak aku ubah logic-nya di sini)
  // Untuk ringkas, aku panggil kembali fungsi yang sudah ada di file kamu:
  function renderProductsTables(){ /* keep your existing implementation */ }
  function renderWithdrawTable(){ /* keep your existing implementation */ }
  function bindSettings(){ /* keep your existing implementation */ }
  function bindWhatsappPage(){ /* keep your existing implementation */ }
  function updateWaPanel(st){ /* keep your existing implementation */ }
  function bindLogs(){ /* keep your existing implementation */ }
  function appendLogLine(line){ /* keep your existing implementation */ }
  function renderAuditTable(){ /* keep your existing implementation */ }

  // ========= Boot =========
  function boot() {
    aos();

    const currentPretty = location.pathname + location.search;

    if (isAdmin) {
      // default: /<admin> show dashboard (partial), but keep URL pretty
      if (location.pathname === `/${adminPath}` || location.pathname === `/${adminPath}/`) {
        go(`/${adminPath}/dashboard`, true);
      } else {
        // load whatever current URL is (pretty)
        go(currentPretty, false);
      }
      return;
    }

    // public
    // kalau user ketik /p/... tetap jalan, tapi URL akan tetap /p/...
    // rekomendasi: gunakan /, /order, /invoice?token=...
    go(currentPretty, false);
  }

  boot();

})();