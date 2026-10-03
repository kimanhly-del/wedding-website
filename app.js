(function () {
  'use strict';

  /* ================= Tiện ích ================= */
  const KEY = 'wedding-site-v1';
  const AUTH = 'wedding-admin-ok';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pad = n => String(n).padStart(2, '0');
  const app = $('#app'), dlg = $('#dlg');
  const STATUS = { yes: 'Sẽ tham dự', no: 'Không tham dự', pending: 'Chưa trả lời' };
  const GROUPS = ['Nhà trai', 'Nhà gái', 'Bạn bè', 'Đồng nghiệp', 'Gia đình'];

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function toLocalInput(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function copyText(text) {
    const done = () => toast('Đã sao chép');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Không sao chép được'); } ta.remove();
    }
  }
  function compress(file, max = 1000, q = 0.78) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', q));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ================= Dữ liệu ================= */
  function sampleData() {
    const d = new Date(); d.setDate(d.getDate() + 90); d.setHours(11, 0, 0, 0);
    const t1 = uid(), t2 = uid();
    return {
      pin: '1234',
      lastBackup: 0,
      wedding: {
        bride: 'Minh Anh', groom: 'Quốc Bảo',
        date: toLocalInput(d),
        venue: 'Trung tâm tiệc cưới Hoa Sen',
        address: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
        story: 'Chúng mình gặp nhau vào một chiều mưa Sài Gòn, và từ đó mỗi ngày bên nhau đều là một câu chuyện đẹp.\nSự hiện diện của bạn là niềm vui lớn nhất trong ngày trọng đại của chúng mình.',
        heroImage: '',
        album: [],
        events: [
          { id: uid(), name: 'Đón khách', time: '10:00', place: 'Sảnh chính' },
          { id: uid(), name: 'Lễ thành hôn', time: '11:00', place: 'Sân vườn' },
          { id: uid(), name: 'Tiệc chiêu đãi', time: '12:00', place: 'Sảnh Hoa Sen' }
        ],
        zalo: '', email: '',
        bank: 'Vietcombank', account: '0123456789', holder: 'NGUYEN VAN A', qr: ''
      },
      tables: [{ id: t1, name: 'Bàn 1', capacity: 10 }, { id: t2, name: 'Bàn 2', capacity: 10 }],
      guests: [
        { id: uid(), name: 'Nguyễn Văn An', group: 'Nhà trai', count: 2, phone: '0901234567', status: 'yes', diet: '', wish: 'Chúc hai bạn trăm năm hạnh phúc!', table: t1 },
        { id: uid(), name: 'Trần Thị Bình', group: 'Nhà gái', count: 3, phone: '0912345678', status: 'yes', diet: 'Ăn chay', wish: '', table: t2 },
        { id: uid(), name: 'Lê Hoàng Cường', group: 'Bạn bè', count: 1, phone: '', status: 'pending', diet: '', wish: '', table: '' },
        { id: uid(), name: 'Phạm Thu Dung', group: 'Đồng nghiệp', count: 1, phone: '', status: 'no', diet: '', wish: 'Tiếc quá, hẹn gặp mừng sau!', table: '' }
      ]
    };
  }
  // Nội dung thiệp hiển thị cho khách: lấy từ data.js (đã xuất bản). Cô dâu chú rể đang đăng nhập thì thấy bản đang chỉnh.
  function W() {
    const pub = window.WEDDING_DATA;
    if (pub && !isAuthed()) return Object.assign({}, S.wedding, pub, { album: pub.album || [], events: pub.events || [] });
    return S.wedding;
  }
  const sheetUrl = () => ((window.WEDDING_CONFIG || {}).sheetUrl || '').trim();
  function normalize(raw) {
    const base = sampleData();
    if (!raw || typeof raw !== 'object') return base;
    return {
      pin: raw.pin || base.pin,
      sheetKey: raw.sheetKey || '',
      lastBackup: raw.lastBackup || 0,
      wedding: Object.assign({}, base.wedding, raw.wedding || {}),
      tables: Array.isArray(raw.tables) ? raw.tables : base.tables,
      guests: Array.isArray(raw.guests) ? raw.guests : base.guests
    };
  }
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return normalize(JSON.parse(s)); } catch (e) { /* bỏ qua */ }
    return sampleData();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { toast('Không lưu được: bộ nhớ trình duyệt đã đầy. Hãy giảm số ảnh.'); return false; }
  }
  if (!localStorage.getItem(KEY)) save();

  /* ================= Điều hướng ================= */
  let countdownTimer, adminTab = 'dash', draft = null;
  const F = { q: '', status: '', group: '' };
  const isAuthed = () => { try { return sessionStorage.getItem(AUTH) === '1'; } catch (e) { return false; } };

  function route() {
    clearInterval(countdownTimer);
    if (location.hash === '#/admin') { isAuthed() ? renderAdmin() : renderLogin(); }
    else renderPublic();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ================= TRANG THIỆP (khách) ================= */
  function fmtDate(w) {
    const d = new Date(w.date);
    if (isNaN(d)) return '';
    const day = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `${day} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function renderPublic() {
    const w = W();
    document.title = `Thiệp cưới ${w.groom} & ${w.bride}`;
    const hasImg = !!w.heroImage;
    const heroStyle = hasImg ? `style="background-image:linear-gradient(rgba(40,30,20,.45),rgba(40,30,20,.55)),url('${w.heroImage}')"` : '';
    const mapQ = encodeURIComponent(w.address || w.venue || '');
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${mapQ}`;
    app.innerHTML = `
    <nav class="pubnav no-print">
      <button data-scroll="story">Câu chuyện</button><button data-scroll="events">Lịch trình</button>
      <button data-scroll="place">Địa điểm</button><button data-scroll="rsvp">Xác nhận</button><button data-scroll="gift">Mừng cưới</button>
    </nav>
    <header class="hero ${hasImg ? 'has-img' : ''}" ${heroStyle}>
      <div class="kicker">Trân trọng kính mời bạn đến dự lễ cưới</div>
      <h1>${esc(w.groom)}<span class="amp">&amp;</span>${esc(w.bride)}</h1>
      <div class="date">${esc(fmtDate(w))}</div>
      <div class="countdown" id="countdown" aria-label="Đếm ngược đến ngày cưới"></div>
    </header>
    <section class="block" id="story"><h2>Câu chuyện của chúng mình</h2>
      <p class="lead">${esc(w.story)}</p>
      ${w.album.length ? `<div class="album">${w.album.map((src, i) => `<img src="${src}" alt="Ảnh cưới ${i + 1}" data-act="zoom" data-i="${i}">`).join('')}</div>` : ''}
    </section>
    <section class="block" id="events"><h2>Lịch trình</h2>
      ${w.events.length ? `<ul class="timeline">${w.events.map(e => `<li><time>${esc(e.time)}</time> &nbsp;<b>${esc(e.name)}</b><small>${esc(e.place)}</small></li>`).join('')}</ul>` : '<p class="center help">Lịch trình sẽ được cập nhật.</p>'}
      <div class="actions"><button class="btn ghost" data-act="ics">📅 Thêm vào lịch</button></div>
    </section>
    <section class="block" id="place"><h2>Địa điểm</h2>
      <p class="center"><b>${esc(w.venue)}</b><br>${esc(w.address)}</p>
      ${mapQ ? `<div class="map"><iframe loading="lazy" title="Bản đồ" src="https://www.google.com/maps?q=${mapQ}&output=embed"></iframe></div>
      <div class="actions"><a class="btn" target="_blank" rel="noopener" href="${dir}">🧭 Chỉ đường</a></div>` : ''}
    </section>
    <section class="block" id="rsvp"><h2>Xác nhận tham dự</h2>
      <div class="card rsvp-card" id="rsvpBox">${rsvpForm()}</div>
    </section>
    <section class="block gift" id="gift"><h2>Mừng cưới</h2>
      <div class="card rsvp-card center">
        <p class="help">Sự có mặt của bạn là món quà quý giá nhất. Nếu muốn gửi lời chúc qua tài khoản, thông tin ở dưới đây.</p>
        <dl><dt>Ngân hàng</dt><dd>${esc(w.bank)}</dd><dt>Số tài khoản</dt><dd>${esc(w.account)}</dd><dt>Chủ tài khoản</dt><dd>${esc(w.holder)}</dd></dl>
        <button class="btn ghost sm" data-act="copyAcc">Sao chép số tài khoản</button>
        ${w.qr ? `<img class="qr" src="${w.qr}" alt="Mã QR chuyển khoản">` : ''}
      </div>
    </section>
    <footer class="pubfoot no-print">Cảm ơn bạn rất nhiều ♥<br><a href="#/admin">Quản lý (dành cho cô dâu chú rể)</a></footer>`;
    startCountdown();
  }
  function startCountdown() {
    const el = $('#countdown'); if (!el) return;
    const target = new Date(W().date).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (isNaN(target)) { el.innerHTML = ''; return; }
      if (diff <= 0) { el.innerHTML = '<div class="thanks" style="padding:14px 22px">Cảm ơn bạn đã đồng hành cùng chúng mình ♥</div>'; clearInterval(countdownTimer); return; }
      const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
      el.innerHTML = [[d, 'Ngày'], [h, 'Giờ'], [m, 'Phút'], [s, 'Giây']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    };
    tick(); countdownTimer = setInterval(tick, 1000);
  }
  function rsvpForm() {
    return `<form class="form" id="rsvpForm" novalidate>
      <label>Họ và tên *<input name="name" required maxlength="80" autocomplete="name" placeholder="Nguyễn Văn A"></label>
      <label>Bạn sẽ tham dự chứ? *<select name="status"><option value="yes">Có, mình sẽ tham dự</option><option value="no">Rất tiếc, mình không thể đến</option></select></label>
      <label data-yes>Số người đi cùng (tính cả bạn)<input type="number" name="count" min="1" max="10" value="1"></label>
      <label data-yes>Món ăn kiêng / dị ứng (nếu có)<input name="diet" maxlength="120" placeholder="Ví dụ: ăn chay"></label>
      <label>Lời chúc gửi đến cô dâu chú rể<textarea name="wish" maxlength="400"></textarea></label>
      <button class="btn" type="submit">Gửi xác nhận</button>
    </form>`;
  }
  function handleRsvp(f) {
    const name = f.name.value.trim();
    if (!name) { toast('Vui lòng nhập họ tên'); f.name.focus(); return; }
    const status = f.status.value;
    const count = status === 'yes' ? Math.min(10, Math.max(1, parseInt(f.count.value, 10) || 1)) : 0;
    const diet = f.diet.value.trim(), wish = f.wish.value.trim();
    const key = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const ex = S.guests.find(g => key(g.name) === key(name));
    if (ex) Object.assign(ex, { status, count: count || ex.count, diet, wish });
    else S.guests.push({ id: uid(), name, group: 'Khách tự xác nhận', count: count || 1, phone: '', status, diet, wish, table: '' });
    save();
    const w = W();
    const msg = `Xin chào ${w.groom} & ${w.bride}! Mình là ${name}. ` +
      (status === 'yes' ? `Mình xác nhận SẼ THAM DỰ cùng ${count} người (tính cả mình).` : 'Rất tiếc mình KHÔNG THỂ THAM DỰ.') +
      (diet ? ` Ăn uống: ${diet}.` : '') + (wish ? ` Lời chúc: ${wish}` : '');
    const zalo = (w.zalo || '').replace(/\D/g, '');
    const hasSheet = !!sheetUrl();
    $('#rsvpBox').innerHTML = `<h3 class="center">${hasSheet ? 'Đang gửi xác nhận...' : 'Gần xong rồi!'}</h3>
      <p id="rsvpNote">${hasSheet ? 'Vui lòng chờ trong giây lát.' : 'Bấm một trong các nút dưới đây để gửi tin xác nhận đến cô dâu chú rể:'}</p>
      <div class="msgbox" id="rsvpMsg">${esc(msg)}</div>
      <div class="actions">
        <button class="btn" data-act="copyMsg">Sao chép tin nhắn</button>
        ${zalo ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://zalo.me/${zalo}">Mở Zalo</a>` : ''}
        ${w.email ? `<a class="btn ghost" href="mailto:${esc(w.email)}?subject=${encodeURIComponent('Xác nhận tham dự: ' + name)}&body=${encodeURIComponent(msg)}">Gửi email</a>` : ''}
      </div>
      ${!zalo && !w.email ? '<p class="help center">Hãy sao chép tin nhắn và gửi cho cô dâu chú rể qua kênh bạn thường dùng.</p>' : ''}`;
    $('#rsvpBox').dataset.msg = msg;
    if (hasSheet) {
      sendToSheet({ name, status, count, diet, wish }).then(ok => {
        const h = $('#rsvpBox h3'), n = $('#rsvpNote'); if (!h || !n) return;
        h.textContent = ok ? 'Cảm ơn bạn! Đã ghi nhận ♥' : 'Chưa gửi được xác nhận';
        n.textContent = ok ? 'Cô dâu chú rể đã nhận được xác nhận của bạn. Bạn có thể nhắn thêm qua các nút bên dưới (không bắt buộc):'
          : 'Kết nối bị lỗi. Bạn hãy thử lại sau, hoặc gửi tin nhắn dưới đây cho cô dâu chú rể:';
      });
    }
  }
  function sendToSheet(payload) {
    return fetch(sheetUrl(), { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(() => true, () => false);
  }
  // Kéo RSVP từ Google Sheet về danh sách khách trong khu quản lý
  async function syncSheet() {
    if (!sheetUrl()) { toast('Chưa dán địa chỉ Google Sheet vào config.js'); return; }
    if (!S.sheetKey) { toast('Hãy nhập mã đọc (SECRET) ở mục Google Sheet'); return; }
    toast('Đang đồng bộ...');
    try {
      const res = await fetch(sheetUrl() + '?key=' + encodeURIComponent(S.sheetKey));
      const data = await res.json();
      if (!data.ok) { toast(data.error === 'unauthorized' ? 'Mã đọc không đúng' : 'Lỗi từ Google Sheet'); return; }
      const key = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
      let added = 0, updated = 0;
      data.rows.forEach(r => {   // dòng sau ghi đè dòng trước
        if (!r.name) return;
        const g = S.guests.find(x => key(x.name) === key(r.name));
        const count = Math.max(1, parseInt(r.count, 10) || 1);
        if (g) { Object.assign(g, { status: r.status, diet: r.diet || '', wish: r.wish || '' }); if (r.status === 'yes') g.count = count; updated++; }
        else { S.guests.push({ id: uid(), name: String(r.name), group: 'Khách tự xác nhận', count, phone: '', status: r.status, diet: r.diet || '', wish: r.wish || '', table: '' }); added++; }
      });
      save(); renderAdmin(); toast(`Đồng bộ xong: thêm ${added}, cập nhật ${updated}`);
    } catch (e) { toast('Không kết nối được tới Google Sheet'); }
  }
  function makeIcs() {
    const w = W(), d = new Date(w.date); if (isNaN(d)) return;
    const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const end = new Date(d.getTime() + 4 * 36e5);
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding//VI', 'BEGIN:VEVENT', `UID:${uid()}@wedding`, `DTSTAMP:${f(new Date())}`,
      `DTSTART:${f(d)}`, `DTEND:${f(end)}`, `SUMMARY:Đám cưới ${w.groom} & ${w.bride}`, `LOCATION:${(w.venue + ', ' + w.address).replace(/[,;]/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    download('dam-cuoi.ics', ics, 'text/calendar');
  }

  /* ================= ĐĂNG NHẬP ================= */
  function renderLogin() {
    document.title = 'Quản lý đám cưới';
    app.innerHTML = `<div class="login"><div class="card">
      <h2 class="center">Khu vực quản lý</h2>
      <form class="form" id="loginForm"><label>Mã PIN<input type="password" name="pin" inputmode="numeric" autocomplete="off" autofocus></label>
      <button class="btn" type="submit">Đăng nhập</button>
      <p class="help center">Lần đầu dùng, PIN mặc định là <b>1234</b>. Hãy đổi trong mục Cài đặt.</p></form>
      <p class="center"><a href="#/">← Về trang thiệp</a></p></div></div>`;
  }

  /* ================= QUẢN LÝ ================= */
  const TABS = [['dash', 'Tổng quan'], ['guests', 'Khách mời'], ['tables', 'Xếp bàn'], ['content', 'Nội dung thiệp'], ['settings', 'Cài đặt']];
  function renderAdmin() {
    document.title = 'Quản lý đám cưới';
    if (adminTab === 'content' && !draft) draft = JSON.parse(JSON.stringify(S.wedding));
    app.innerHTML = `
    <div class="admin-top no-print"><h1>💍 ${esc(S.wedding.groom)} &amp; ${esc(S.wedding.bride)}</h1>
      <div><a class="btn ghost sm" href="#/">Xem thiệp</a> <button class="btn ghost sm" data-act="logout">Đăng xuất</button></div></div>
    <div class="tabs no-print">${TABS.map(([k, l]) => `<button class="${k === adminTab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <main class="panel">${({ dash: tabDash, guests: tabGuests, tables: tabTables, content: tabContent, settings: tabSettings })[adminTab]()}</main>`;
  }
  const guestStats = () => {
    const g = S.guests, yes = g.filter(x => x.status === 'yes');
    return { total: g.length, yes: yes.length, people: yes.reduce((a, x) => a + (+x.count || 0), 0), no: g.filter(x => x.status === 'no').length, pending: g.filter(x => x.status === 'pending').length, seated: yes.filter(x => x.table).length };
  };
  function tabDash() {
    const s = guestStats(), t = s.total || 1;
    const days = Math.ceil((new Date(S.wedding.date) - Date.now()) / 864e5);
    const stale = S.guests.length && (!S.lastBackup || Date.now() - S.lastBackup > 7 * 864e5);
    return `${stale ? `<div class="alert">⚠️ ${S.lastBackup ? 'Đã hơn 7 ngày chưa sao lưu.' : 'Bạn chưa sao lưu dữ liệu lần nào.'} Dữ liệu chỉ nằm trong trình duyệt này. <a href="#" data-act="exportJson">Sao lưu ngay</a></div>` : ''}
    <div class="stats">
      <div class="stat"><b>${isNaN(days) ? '–' : (days > 0 ? days : 0)}</b><span>Ngày còn lại</span></div>
      <div class="stat"><b>${s.total}</b><span>Khách / nhóm được mời</span></div>
      <div class="stat"><b>${s.yes}</b><span>Đã xác nhận đi</span></div>
      <div class="stat"><b>${s.people}</b><span>Tổng số người sẽ đến</span></div>
      <div class="stat"><b>${s.pending}</b><span>Chưa trả lời</span></div>
      <div class="stat"><b>${s.no}</b><span>Không tham dự</span></div>
    </div>
    <div class="sec"><h3>Tiến độ phản hồi</h3>
      <div class="bar" title="Đi / Không đi / Chưa trả lời"><i style="width:${s.yes / t * 100}%;background:var(--green)"></i><i style="width:${s.no / t * 100}%;background:var(--rose)"></i><i style="width:${s.pending / t * 100}%;background:#d8c9a8"></i></div>
      <p class="help">Xanh: sẽ đến · Đỏ: không đến · Be: chưa trả lời. Đã xếp bàn ${s.seated}/${s.yes} nhóm khách sẽ đến.</p></div>
    <div class="sec"><h3>Lời chúc gần đây</h3>${S.guests.filter(g => g.wish).slice(-5).reverse().map(g => `<p><b>${esc(g.name)}:</b> ${esc(g.wish)}</p>`).join('') || '<p class="help">Chưa có lời chúc nào.</p>'}</div>`;
  }

  /* ---- Khách mời ---- */
  function tabGuests() {
    const groups = [...new Set([...GROUPS, ...S.guests.map(g => g.group).filter(Boolean)])];
    return `<div class="toolbar no-print">
      <input type="search" id="fq" placeholder="Tìm theo tên, SĐT..." value="${esc(F.q)}">
      <select id="fs"><option value="">Mọi trạng thái</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${F.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="fg"><option value="">Mọi nhóm</option>${groups.map(g => `<option ${F.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
    <div class="toolbar-actions"><button class="btn" data-act="addGuest">+ Thêm khách</button>
      <button class="btn ghost" data-act="exportCsv">Xuất CSV</button><button class="btn ghost" data-act="print">In danh sách</button></div>
    <div class="tablewrap"><table><thead><tr><th>Họ tên</th><th>Nhóm</th><th>Số người</th><th>SĐT</th><th>Trạng thái</th><th>Bàn</th><th class="no-print"></th></tr></thead>
    <tbody id="guestRows">${guestRows()}</tbody></table></div>`;
  }
  function filteredGuests() {
    const q = F.q.trim().toLowerCase();
    return S.guests.filter(g => (!q || (g.name + ' ' + g.phone).toLowerCase().includes(q)) && (!F.status || g.status === F.status) && (!F.group || g.group === F.group));
  }
  function guestRows() {
    const list = filteredGuests();
    if (!list.length) return `<tr><td colspan="7" class="empty">${S.guests.length ? 'Không có khách phù hợp bộ lọc.' : 'Chưa có khách nào. Bấm “+ Thêm khách” để bắt đầu.'}</td></tr>`;
    const tn = id => (S.tables.find(t => t.id === id) || {}).name || '–';
    return list.map(g => `<tr>
      <td><b>${esc(g.name)}</b>${g.diet ? `<br><small class="help">🍽 ${esc(g.diet)}</small>` : ''}</td><td>${esc(g.group)}</td><td>${esc(g.count)}</td><td>${esc(g.phone)}</td>
      <td><select data-chg="status" data-id="${g.id}" aria-label="Trạng thái">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${g.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td>${esc(tn(g.table))}</td>
      <td class="act no-print"><button class="btn ghost sm" data-act="editGuest" data-id="${g.id}">Sửa</button> <button class="btn danger sm" data-act="delGuest" data-id="${g.id}">Xóa</button></td></tr>`).join('');
  }
  function guestDialog(id) {
    const g = id ? S.guests.find(x => x.id === id) : { name: '', group: 'Bạn bè', count: 1, phone: '', status: 'pending', diet: '', wish: '', table: '' };
    if (!g) return;
    dlg.className = ''; dlg.dataset.id = id || '';
    dlg.innerHTML = `<h3>${id ? 'Sửa khách mời' : 'Thêm khách mời'}</h3>
    <form class="form" id="gform">
      <label>Họ tên *<input name="name" required maxlength="80" value="${esc(g.name)}"></label>
      <div class="row2"><label>Nhóm<input name="group" list="grpList" value="${esc(g.group)}"><datalist id="grpList">${GROUPS.map(x => `<option>${x}</option>`).join('')}</datalist></label>
        <label>Số người<input type="number" name="count" min="1" max="20" value="${esc(g.count)}"></label></div>
      <div class="row2"><label>Số điện thoại<input name="phone" inputmode="tel" value="${esc(g.phone)}"></label>
        <label>Trạng thái<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${g.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <label>Bàn<select name="table"><option value="">Chưa xếp</option>${S.tables.map(t => `<option value="${t.id}" ${g.table === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <label>Món kiêng<input name="diet" value="${esc(g.diet)}"></label>
      <label>Lời chúc<textarea name="wish">${esc(g.wish)}</textarea></label>
      <div class="actions"><button class="btn" type="submit">Lưu</button><button type="button" class="btn ghost" data-act="closeDlg">Hủy</button></div>
    </form>`;
    dlg.showModal();
  }
  function saveGuest(f) {
    const name = f.name.value.trim(); if (!name) { toast('Vui lòng nhập họ tên'); return; }
    const data = { name, group: f.group.value.trim(), count: Math.max(1, parseInt(f.count.value, 10) || 1), phone: f.phone.value.trim(), status: f.status.value, table: f.table.value, diet: f.diet.value.trim(), wish: f.wish.value.trim() };
    const id = dlg.dataset.id;
    if (id) Object.assign(S.guests.find(x => x.id === id), data); else S.guests.push(Object.assign({ id: uid() }, data));
    if (save()) { dlg.close(); renderAdmin(); toast('Đã lưu'); }
  }
  function exportCsv() {
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const tn = id => (S.tables.find(t => t.id === id) || {}).name || '';
    const rows = [['Họ tên', 'Nhóm', 'Số người', 'SĐT', 'Trạng thái', 'Món kiêng', 'Lời chúc', 'Bàn']].concat(S.guests.map(g => [g.name, g.group, g.count, g.phone, STATUS[g.status], g.diet, g.wish, tn(g.table)]));
    download('danh-sach-khach.csv', '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ---- Xếp bàn ---- */
  function tabTables() {
    const attending = S.guests.filter(g => g.status !== 'no');
    const un = attending.filter(g => !S.tables.some(t => t.id === g.table));
    const opts = `<option value="">Chọn bàn...</option>` + S.tables.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    return `<form class="inline-form no-print" id="tableForm"><input name="name" placeholder="Tên bàn (VD: Bàn 3)" required><input name="cap" type="number" min="1" max="30" value="10" style="width:100px" aria-label="Sức chứa"><button class="btn" type="submit">+ Thêm bàn</button><button type="button" class="btn ghost" data-act="print">In sơ đồ</button></form>
    <div class="tables-grid">
    ${S.tables.map(t => {
      const gs = attending.filter(g => g.table === t.id), used = gs.reduce((a, g) => a + (+g.count || 0), 0);
      return `<div class="tcard ${used > t.capacity ? 'over' : ''}"><h3><span>${esc(t.name)}</span><span>${used}/${t.capacity}</span></h3>
        <ul>${gs.map(g => `<li><span>${esc(g.name)} (${g.count})</span><button class="no-print" data-act="unseat" data-id="${g.id}" title="Bỏ khỏi bàn">✕</button></li>`).join('') || '<li class="help">Chưa có ai</li>'}</ul>
        ${used > t.capacity ? '<p class="help" style="color:var(--rose)">Vượt sức chứa!</p>' : ''}
        <div class="no-print"><button class="btn ghost sm" data-act="renameTable" data-id="${t.id}">Sửa</button> <button class="btn danger sm" data-act="delTable" data-id="${t.id}">Xóa bàn</button></div></div>`;
    }).join('')}
    <div class="tcard"><h3><span>Chưa xếp bàn</span><span>${un.length}</span></h3>
      <ul>${un.map(g => `<li><span>${esc(g.name)} (${g.count})</span><select class="no-print" data-chg="seat" data-id="${g.id}" style="max-width:120px">${opts}</select></li>`).join('') || '<li class="help">Đã xếp hết 🎉</li>'}</ul></div>
    </div>`;
  }

  /* ---- Nội dung thiệp ---- */
  function tabContent() {
    const w = draft;
    const inp = (n, l, type = 'text') => `<label>${l}<input name="${n}" type="${type}" value="${esc(w[n])}"></label>`;
    return `<form id="contentForm" class="form" autocomplete="off">
      <div class="sec form"><h3>Cô dâu & chú rể</h3><div class="row2">${inp('groom', 'Tên chú rể')}${inp('bride', 'Tên cô dâu')}</div>${inp('date', 'Ngày giờ tổ chức', 'datetime-local')}
        <label>Ảnh bìa<input type="file" accept="image/*" data-file="heroImage"></label>
        ${w.heroImage ? `<div class="thumbs"><div><img src="${w.heroImage}" alt="Ảnh bìa"><button type="button" data-act="rmHero" title="Xóa">✕</button></div></div>` : ''}</div>
      <div class="sec form"><h3>Câu chuyện & album</h3><label>Lời giới thiệu<textarea name="story" rows="5">${esc(w.story)}</textarea></label>
        <label>Thêm ảnh vào album<input type="file" accept="image/*" multiple data-file="album"></label>
        <div class="thumbs">${w.album.map((s, i) => `<div><img src="${s}" alt=""><button type="button" data-act="rmAlbum" data-i="${i}" title="Xóa">✕</button></div>`).join('')}</div>
        <p class="help">Ảnh được tự động thu nhỏ để tiết kiệm bộ nhớ.</p></div>
      <div class="sec form"><h3>Địa điểm</h3>${inp('venue', 'Tên nơi tổ chức')}${inp('address', 'Địa chỉ (dùng để hiện bản đồ)')}</div>
      <div class="sec"><h3>Lịch trình</h3>
        ${w.events.map((e, i) => `<div class="ev-row" data-i="${i}"><input data-ev="name" placeholder="Tên" value="${esc(e.name)}"><input data-ev="time" type="time" value="${esc(e.time)}"><input data-ev="place" placeholder="Nơi" value="${esc(e.place)}"><button type="button" class="btn danger sm" data-act="rmEvent" data-i="${i}">✕</button></div>`).join('')}
        <button type="button" class="btn ghost sm" data-act="addEvent">+ Thêm mục</button></div>
      <div class="sec form"><h3>Nhận xác nhận từ khách</h3><div class="row2">${inp('zalo', 'Số Zalo của bạn')}${inp('email', 'Email của bạn', 'email')}</div>
        <p class="help">Khách sẽ gửi xác nhận về Zalo / email này. Sau đó bạn cập nhật trạng thái trong mục Khách mời.</p></div>
      <div class="sec form"><h3>Mừng cưới</h3><div class="row2">${inp('bank', 'Ngân hàng')}${inp('account', 'Số tài khoản')}</div>${inp('holder', 'Chủ tài khoản')}
        <label>Ảnh mã QR<input type="file" accept="image/*" data-file="qr"></label>
        ${w.qr ? `<div class="thumbs"><div><img src="${w.qr}" alt="QR"><button type="button" data-act="rmQr" title="Xóa">✕</button></div></div>` : ''}</div>
      <div class="savebar"><button class="btn" type="submit">Lưu thay đổi</button> <a class="btn ghost" href="#/">Xem thiệp</a></div></form>`;
  }
  function collectContent() {
    const f = $('#contentForm'); if (!f || !draft) return;
    ['groom', 'bride', 'date', 'story', 'venue', 'address', 'zalo', 'email', 'bank', 'account', 'holder'].forEach(n => { if (f[n]) draft[n] = f[n].value.trim(); });
    draft.events = $$('.ev-row', f).map((r, i) => ({ id: (draft.events[i] || {}).id || uid(), name: $('[data-ev=name]', r).value.trim(), time: $('[data-ev=time]', r).value, place: $('[data-ev=place]', r).value.trim() }));
  }
  async function handleFile(input) {
    collectContent();
    const files = [...input.files]; if (!files.length) return;
    try {
      for (const file of files) {
        const url = await compress(file, input.dataset.file === 'qr' ? 600 : 1000);
        if (input.dataset.file === 'album') draft.album.push(url); else draft[input.dataset.file] = url;
      }
      renderAdmin();
    } catch (e) { toast('Không đọc được ảnh'); }
  }

  /* ---- Cài đặt ---- */
  function tabSettings() {
    const last = S.lastBackup ? new Date(S.lastBackup).toLocaleString('vi-VN') : 'chưa bao giờ';
    return `<div class="sec"><h3>Xuất bản thiệp cho khách</h3>
      <p class="help">Khách mở website trên điện thoại của họ sẽ không thấy nội dung bạn chỉnh trong trình duyệt này. Sau mỗi lần sửa nội dung thiệp: bấm nút dưới đây, rồi đặt file <b>data.js</b> vừa tải vào cùng thư mục với <b>index.html</b> (thay file cũ) và đưa lên Vercel lại.</p>
      <button class="btn" data-act="publish">Tải file data.js</button></div>
    <div class="sec"><h3>Google Sheet (nhận RSVP tự động)</h3>
      <p>${sheetUrl() ? '✅ Đã kết nối Google Sheet qua <code>config.js</code>.' : '⚠️ Chưa kết nối. Làm theo <b>SETUP_GOOGLE_SHEET.md</b>, rồi dán địa chỉ vào <code>config.js</code>.'}</p>
      <form class="form" id="sheetForm" style="max-width:420px"><label>Mã đọc (SECRET trong Apps Script)<input name="key" type="password" value="${esc(S.sheetKey || '')}" autocomplete="off"></label>
      <div class="actions" style="justify-content:flex-start;margin:0"><button class="btn ghost" type="submit">Lưu mã</button><button class="btn" type="button" data-act="syncSheet">Đồng bộ từ Google Sheet</button></div></form></div>
    <div class="sec"><h3>Sao lưu & khôi phục</h3><p class="help">Dữ liệu được lưu trong trình duyệt này. Lần sao lưu gần nhất: ${last}.</p>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-act="exportJson">Tải file sao lưu (.json)</button>
      <label class="btn ghost" style="cursor:pointer">Khôi phục từ file<input type="file" accept=".json,application/json" data-import hidden></label></div></div>
    <div class="sec"><h3>Đổi mã PIN</h3><form class="form" id="pinForm" style="max-width:320px"><label>PIN mới (tối thiểu 4 ký tự)<input name="pin" type="password" minlength="4" required></label><button class="btn" type="submit">Đổi PIN</button></form>
      <p class="help">PIN chỉ ngăn người khác mở nhầm khu quản lý, không phải bảo mật cao.</p></div>
    <div class="sec"><h3>Dữ liệu</h3><div class="actions" style="justify-content:flex-start"><button class="btn ghost" data-act="resetSample">Nạp lại dữ liệu mẫu</button><button class="btn danger" data-act="clearAll">Xóa toàn bộ dữ liệu</button></div></div>`;
  }

  /* ================= Sự kiện ================= */
  document.addEventListener('click', e => {
    const sc = e.target.closest('[data-scroll]');
    if (sc) { const el = document.getElementById(sc.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { collectContent(); adminTab = tab.dataset.tab; if (adminTab !== 'content') draft = null; renderAdmin(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, i = +b.dataset.i;
    switch (b.dataset.act) {
      case 'zoom': dlg.className = 'lightbox'; dlg.innerHTML = `<img src="${W().album[i]}" alt=""><form method="dialog" style="display:none"></form>`; dlg.showModal(); break;
      case 'ics': makeIcs(); break;
      case 'publish': download('data.js', '// Nội dung thiệp đã xuất bản. Được tạo từ khu quản lý.\nwindow.WEDDING_DATA = ' + JSON.stringify(S.wedding, null, 2) + ';\n', 'text/javascript'); toast('Đã tải data.js'); break;
      case 'syncSheet': { const k = $('#sheetForm input[name=key]'); if (k) { S.sheetKey = k.value.trim(); save(); } syncSheet(); break; }
      case 'copyAcc': copyText(W().account); break;
      case 'copyMsg': copyText($('#rsvpBox').dataset.msg); break;
      case 'logout': try { sessionStorage.removeItem(AUTH); } catch (er) { } location.hash = '#/'; break;
      case 'closeDlg': dlg.close(); break;
      case 'addGuest': guestDialog(); break;
      case 'editGuest': guestDialog(id); break;
      case 'delGuest': { const g = S.guests.find(x => x.id === id); if (g && confirm(`Xóa khách “${g.name}”?`)) { S.guests = S.guests.filter(x => x.id !== id); save(); renderAdmin(); } break; }
      case 'exportCsv': exportCsv(); break;
      case 'print': window.print(); break;
      case 'unseat': { const g = S.guests.find(x => x.id === id); if (g) { g.table = ''; save(); renderAdmin(); } break; }
      case 'renameTable': { const t = S.tables.find(x => x.id === id); const n = prompt('Tên bàn:', t.name); if (n && n.trim()) { t.name = n.trim(); const c = parseInt(prompt('Sức chứa:', t.capacity), 10); if (c > 0) t.capacity = c; save(); renderAdmin(); } break; }
      case 'delTable': { const t = S.tables.find(x => x.id === id); if (t && confirm(`Xóa “${t.name}”? Khách ở bàn này sẽ trở về danh sách chưa xếp.`)) { S.tables = S.tables.filter(x => x.id !== id); S.guests.forEach(g => { if (g.table === id) g.table = ''; }); save(); renderAdmin(); } break; }
      case 'addEvent': collectContent(); draft.events.push({ id: uid(), name: '', time: '', place: '' }); renderAdmin(); break;
      case 'rmEvent': collectContent(); draft.events.splice(i, 1); renderAdmin(); break;
      case 'rmAlbum': collectContent(); draft.album.splice(i, 1); renderAdmin(); break;
      case 'rmHero': collectContent(); draft.heroImage = ''; renderAdmin(); break;
      case 'rmQr': collectContent(); draft.qr = ''; renderAdmin(); break;
      case 'exportJson': e.preventDefault(); S.lastBackup = Date.now(); save(); download(`sao-luu-dam-cuoi-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 2), 'application/json'); if (adminTab) renderAdmin(); toast('Đã tải file sao lưu'); break;
      case 'resetSample': if (confirm('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu mẫu?')) { const pin = S.pin; S = sampleData(); S.pin = pin; save(); draft = null; renderAdmin(); toast('Đã nạp dữ liệu mẫu'); } break;
      case 'clearAll': if (confirm('XÓA TOÀN BỘ dữ liệu? Hành động này không thể hoàn tác (hãy sao lưu trước).')) { const pin = S.pin; S = sampleData(); S.pin = pin; S.guests = []; S.tables = []; S.wedding.events = []; S.wedding.bride = ''; S.wedding.groom = ''; S.wedding.story = ''; save(); draft = null; renderAdmin(); toast('Đã xóa dữ liệu'); } break;
    }
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'rsvpForm') handleRsvp(f);
    else if (f.id === 'loginForm') {
      if (f.pin.value === S.pin) { try { sessionStorage.setItem(AUTH, '1'); } catch (er) { } renderAdmin(); }
      else { toast('PIN không đúng'); f.pin.value = ''; f.pin.focus(); }
    }
    else if (f.id === 'gform') saveGuest(f);
    else if (f.id === 'tableForm') { const n = f.name.value.trim(); if (!n) return; S.tables.push({ id: uid(), name: n, capacity: Math.max(1, parseInt(f.cap.value, 10) || 10) }); save(); renderAdmin(); }
    else if (f.id === 'contentForm') {
      collectContent();
      if (!draft.groom || !draft.bride) { toast('Hãy nhập tên cô dâu và chú rể'); return; }
      const old = S.wedding; S.wedding = JSON.parse(JSON.stringify(draft));
      if (save()) { draft = JSON.parse(JSON.stringify(S.wedding)); renderAdmin(); toast('Đã lưu nội dung thiệp'); } else S.wedding = old;
    }
    else if (f.id === 'sheetForm') { S.sheetKey = f.key.value.trim(); save(); toast('Đã lưu mã đọc'); }
    else if (f.id === 'pinForm') { const p = f.pin.value.trim(); if (p.length < 4) { toast('PIN cần tối thiểu 4 ký tự'); return; } S.pin = p; save(); f.reset(); toast('Đã đổi PIN'); }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'fq') { F.q = t.value; $('#guestRows').innerHTML = guestRows(); }
    if (t.closest && t.closest('#rsvpForm') && t.name === 'status') {
      $$('[data-yes]', t.closest('form')).forEach(l => l.classList.toggle('hidden', t.value === 'no'));
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fs') { F.status = t.value; $('#guestRows').innerHTML = guestRows(); }
    else if (t.id === 'fg') { F.group = t.value; $('#guestRows').innerHTML = guestRows(); }
    else if (t.dataset.chg === 'status') { const g = S.guests.find(x => x.id === t.dataset.id); if (g) { g.status = t.value; save(); toast('Đã cập nhật'); } }
    else if (t.dataset.chg === 'seat') { const g = S.guests.find(x => x.id === t.dataset.id); if (g && t.value) { g.table = t.value; save(); renderAdmin(); } }
    else if (t.dataset.file) handleFile(t);
    else if (t.hasAttribute && t.hasAttribute('data-import')) {
      const file = t.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!data || !data.wedding || !Array.isArray(data.guests)) throw new Error('bad');
          if (!confirm('Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Tiếp tục?')) return;
          S = normalize(data); save(); draft = null; renderAdmin(); toast('Đã khôi phục dữ liệu');
        } catch (er) { toast('File không hợp lệ'); }
      };
      r.readAsText(file); t.value = '';
    }
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  route();
})();
