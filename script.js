/* ==========================================================
   GameX - منطق الموقع الرئيسي
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const SLIDE_MS = 6000;

  const state = {
    games: [],
    cat: 'الكل',
    q: '',
    sort: 'default',
    slideIdx: 0,
    slides: [],
    timer: null
  };

  /* ---------- أدوات مساعدة ---------- */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // يسمح فقط بروابط http و https
  function safeUrl(u) {
    try {
      const x = new URL(String(u).trim());
      return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : '#';
    } catch { return '#'; }
  }

  // يستخرج كود فيديو يوتيوب من أي شكل للرابط
  function youtubeId(u) {
    const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // يرجع نوع الفيديو وروابطه، أو null لو الرابط مش صالح
  function videoInfo(u) {
    if (!u) return null;
    const id = youtubeId(u);
    if (id) return { type: 'yt', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` };
    if (/^https?:\/\//i.test(u) && /\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { type: 'file', src: u };
    return null;
  }

  function thumb(g) {
    return g.image || 'https://placehold.co/640x360/161b22/00c2ff?text=GameX';
  }

  function linksOf(g) {
    return (g.links || []).filter(l => l && safeUrl(l.url) !== '#');
  }

  function findGame(id) {
    return state.games.find(g => String(g.id) === String(id));
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function openModal(sel) {
    $(sel).hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal(sel) {
    $(sel).hidden = true;
    const anyOpen = $$('.modal').some(m => !m.hidden);
    if (!anyOpen) document.body.classList.remove('modal-open');
  }

  /* ---------- البانر المميز ---------- */
  function renderBanner() {
    const box = $('#banner');
    const featured = state.games
      .filter(g => g.featured)
      .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));

    state.slides = featured;
    if (!featured.length) { box.hidden = true; return; }
    box.hidden = false;

    $('#slides').innerHTML = featured.map((g, i) => {
      const hasVideo = !!videoInfo(g.video);
      const hasDl = linksOf(g).length > 0;
      return `
      <div class="slide ${i === 0 ? 'active' : ''}">
        <img src="${esc(thumb(g))}" alt="${esc(g.title)}">
        <div class="slide-info">
          <span class="badge">⭐ مميزة · ${esc(g.category)}</span>
          <h2>${esc(g.title)}</h2>
          <p>${esc(String(g.description || '').slice(0, 140))}</p>
          <div class="card-actions">
            ${hasVideo ? `<button class="btn btn-video" data-video="${esc(g.id)}">▶ شاهد الفيديو</button>` : ''}
            ${hasDl ? `<button class="btn btn-green" data-dl="${esc(g.id)}">⬇ تنزيل</button>` : ''}
            <button class="btn btn-ghost-sm" data-open="${esc(g.id)}">التفاصيل</button>
          </div>
        </div>
      </div>`;
    }).join('');

    $('#dots').innerHTML = featured.map((_, i) =>
      `<button class="dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="شريحة ${i + 1}"></button>`
    ).join('');

    state.slideIdx = 0;
    $('#prevSlide').hidden = featured.length < 2;
    $('#nextSlide').hidden = featured.length < 2;
    startSlider();
  }

  function showSlide(i) {
    const n = state.slides.length;
    if (!n) return;
    state.slideIdx = (i + n) % n;
    $$('.slide', $('#slides')).forEach((s, k) => s.classList.toggle('active', k === state.slideIdx));
    $$('.dot', $('#dots')).forEach((d, k) => d.classList.toggle('active', k === state.slideIdx));
    restartBar();
  }

  function restartBar() {
    const bar = $('#banner-bar');
    bar.classList.remove('run');
    void bar.offsetWidth; // إعادة تشغيل الأنيميشن
    bar.style.setProperty('--dur', SLIDE_MS + 'ms');
    bar.classList.add('run');
  }

  function startSlider() {
    clearInterval(state.timer);
    if (state.slides.length < 2) {
      $('#banner-bar').classList.remove('run');
      return;
    }
    restartBar();
    state.timer = setInterval(() => showSlide(state.slideIdx + 1), SLIDE_MS);
  }

  /* ---------- الفلاتر والشبكة ---------- */
  function renderCategories() {
    const cats = ['الكل', ...new Set(state.games.map(g => g.category).filter(Boolean))];
    $('#categories').innerHTML = cats.map(c =>
      `<button class="filter-btn ${c === state.cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`
    ).join('');
  }

  function sortList(list) {
    const arr = [...list];
    if (state.sort === 'name') arr.sort((a, b) => String(a.title).localeCompare(b.title, 'ar'));
    if (state.sort === 'cat') arr.sort((a, b) => String(a.category).localeCompare(b.category, 'ar'));
    return arr;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return sortList(state.games.filter(g =>
      (state.cat === 'الكل' || g.category === state.cat) &&
      (!q ||
        String(g.title).toLowerCase().includes(q) ||
        String(g.description || '').toLowerCase().includes(q))
    ));
  }

  function cardHTML(g, i) {
    const hasVideo = !!videoInfo(g.video);
    const hasDl = linksOf(g).length > 0;
    const desc = String(g.description || '');
    return `
    <article class="card reveal" style="--d:${(i % 8) * 70}ms">
      <div class="card-media" data-open="${esc(g.id)}">
        <img src="${esc(thumb(g))}" alt="${esc(g.title)}" loading="lazy">
        ${hasVideo ? '<span class="play-badge">▶</span>' : ''}
        ${g.featured ? '<span class="ribbon">مميزة</span>' : ''}
      </div>
      <div class="card-body">
        <div class="meta-row">
          <span class="badge">${esc(g.category)}</span>
          ${g.size ? `<span class="meta">💾 ${esc(g.size)}</span>` : ''}
          ${g.version ? `<span class="meta">v${esc(g.version)}</span>` : ''}
        </div>
        <h3 data-open="${esc(g.id)}">${esc(g.title)}</h3>
        <p>${esc(desc.slice(0, 100))}${desc.length > 100 ? '…' : ''}</p>
        <div class="card-actions">
          ${hasVideo ? `<button class="btn btn-video" data-video="${esc(g.id)}">▶ الفيديو</button>` : ''}
          ${hasDl ? `<button class="btn btn-green" data-dl="${esc(g.id)}">⬇ تنزيل</button>` : '<span class="no-dl">قريباً</span>'}
        </div>
      </div>
    </article>`;
  }

  function renderGrid() {
    const list = filtered();
    $('#gamesGrid').innerHTML = list.map(cardHTML).join('');
    $('#empty').hidden = list.length > 0;
    $('#countInfo').innerHTML = `عرض <strong>${list.length}</strong> من ${state.games.length} لعبة`;
    observeReveal();
  }

  /* ---------- ظهور البطاقات عند التمرير ---------- */
  let revealObserver = null;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(el => el.classList.add('visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            revealObserver.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
    }
    $$('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
  }

  /* ---------- الفيديو ---------- */
  function openVideo(id) {
    const g = findGame(id);
    const v = g && videoInfo(g.video);
    if (!v) { toast('لا يوجد فيديو لهذه اللعبة حالياً'); return; }

    $('#vTitle').textContent = g.title;
    $('#videoWrap').innerHTML = v.type === 'yt'
      ? `<iframe src="${esc(v.src)}" title="${esc(g.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
      : `<video src="${esc(v.src)}" controls autoplay playsinline></video>`;

    const dl = $('#vDownload');
    const links = linksOf(g);
    dl.hidden = links.length === 0;
    dl.dataset.dl = g.id;
    openModal('#videoModal');
  }

  function closeVideo() {
    $('#videoWrap').innerHTML = ''; // يوقف الفيديو عند الإغلاق
    closeModal('#videoModal');
  }

  /* ---------- التنزيل ---------- */
  function downloadFirst(id) {
    const g = findGame(id);
    const links = g ? linksOf(g) : [];
    if (!links.length) { toast('روابط التحميل غير متاحة حالياً'); return; }
    window.open(safeUrl(links[0].url), '_blank', 'noopener,noreferrer');
    toast(`جارٍ فتح رابط تحميل: ${g.title}`);
  }

  /* ---------- نافذة التفاصيل ---------- */
  function openDetails(id) {
    const g = findGame(id);
    if (!g) return;

    $('#m-img').src = thumb(g);
    $('#m-img').alt = g.title;
    $('#m-cat').textContent = g.category || '';
    $('#m-title').textContent = g.title;
    $('#m-desc').textContent = g.description || '';

    const specs = [
      g.size && `💾 الحجم: ${g.size}`,
      g.version && `🔢 الإصدار: ${g.version}`,
      g.developer && `🏢 المطور: ${g.developer}`
    ].filter(Boolean);
    $('#m-specs').innerHTML = specs.map(x => `<span class="spec">${esc(x)}</span>`).join('');

    const links = linksOf(g);
    $('#m-links').innerHTML = links.length
      ? links.map(l => `
          <a class="dl" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer nofollow">
            ${esc(l.name || 'رابط تحميل')}
          </a>`).join('')
      : '<p>لا توجد روابط تحميل حالياً</p>';

    const vBtn = $('#m-video');
    vBtn.hidden = !videoInfo(g.video);
    vBtn.dataset.video = g.id;

    const dBtn = $('#m-download');
    dBtn.hidden = links.length === 0;
    dBtn.dataset.dl = g.id;

    openModal('#detailsModal');
  }

  /* ---------- الإحصائيات ---------- */
  function animateNumber(el, to) {
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderStats() {
    const cats = new Set(state.games.map(g => g.category).filter(Boolean));
    const links = state.games.reduce((s, g) => s + linksOf(g).length, 0);
    const videos = state.games.filter(g => videoInfo(g.video)).length;
    animateNumber($('#stat-games'), state.games.length);
    animateNumber($('#stat-cats'), cats.size);
    animateNumber($('#stat-links'), links);
    animateNumber($('#stat-videos'), videos);
  }

  /* ---------- الأحداث ---------- */
  function bindEvents() {
    // كل النقرات من مكان واحد
    document.addEventListener('click', e => {
      const t = e.target;

      const dl = t.closest('[data-dl]');
      if (dl) { downloadFirst(dl.dataset.dl); return; }

      const vid = t.closest('[data-video]');
      if (vid) { openVideo(vid.dataset.video); return; }

      const op = t.closest('[data-open]');
      if (op) { openDetails(op.dataset.open); return; }

      const dot = t.closest('[data-dot]');
      if (dot) { showSlide(+dot.dataset.dot); startSlider(); return; }

      const cat = t.closest('[data-cat]');
      if (cat) {
        state.cat = cat.dataset.cat;
        renderCategories();
        renderGrid();
        return;
      }

      if (t.closest('#prevSlide')) { showSlide(state.slideIdx - 1); startSlider(); return; }
      if (t.closest('#nextSlide')) { showSlide(state.slideIdx + 1); startSlider(); return; }

      const close = t.closest('[data-close]');
      if (close) {
        const id = close.dataset.close;
        if (id === 'videoModal') closeVideo();
        else closeModal('#' + id);
        return;
      }

      // إغلاق بالضغط على الخلفية
      if (t.classList && t.classList.contains('modal')) {
        if (t.id === 'videoModal') closeVideo();
        else closeModal('#' + t.id);
      }
    });

    // الإغلاق بزر Escape + التنقل بالأسهم
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('#videoModal').hidden) closeVideo();
        else if (!$('#detailsModal').hidden) closeModal('#detailsModal');
        return;
      }
      const anyModal = $$('.modal').some(m => !m.hidden);
      if (anyModal || state.slides.length < 2) return;
      if (e.key === 'ArrowLeft') { showSlide(state.slideIdx + 1); startSlider(); }
      if (e.key === 'ArrowRight') { showSlide(state.slideIdx - 1); startSlider(); }
    });

    // البحث مع تأخير بسيط
    let searchTimer;
    $('#search').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = e.target.value;
        renderGrid();
      }, 150);
    });

    $('#sortSelect').addEventListener('change', e => {
      state.sort = e.target.value;
      renderGrid();
    });

    // إيقاف البانر مؤقتاً عند وقوف الماوس عليه
    const banner = $('#banner');
    banner.addEventListener('mouseenter', () => clearInterval(state.timer));
    banner.addEventListener('mouseleave', startSlider);

    // تأثير الهيدر عند التمرير + زر الصعود
    const topbar = $('.topbar');
    const toTop = $('#toTop');
    window.addEventListener('scroll', () => {
      topbar.classList.toggle('scrolled', window.scrollY > 10);
      toTop.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // قائمة الموبايل
    const nav = $('#mainNav');
    $('#menuToggle').addEventListener('click', () => nav.classList.toggle('open'));
    $$('a', nav).forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

    // نموذج الاشتراك (تجريبي)
    $('#newsletter').addEventListener('submit', e => {
      e.preventDefault();
      const email = $('#nlEmail').value.trim();
      const msg = $('#nlMsg');
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = 'تم الاشتراك بنجاح، شكراً لك!';
        msg.style.color = 'var(--green)';
        e.target.reset();
      } else {
        msg.textContent = 'اكتب بريد إلكتروني صحيح';
        msg.style.color = 'var(--red)';
      }
    });

    $('#year').textContent = new Date().getFullYear();
  }

  /* ---------- بدء التشغيل ---------- */
  async function init() {
    bindEvents();
    try {
      const res = await fetch('games.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.games = await res.json();
      if (!Array.isArray(state.games)) throw new Error('صيغة الملف غير صحيحة');
    } catch (err) {
      state.games = [];
      $('#empty').hidden = false;
      $('#empty').textContent = 'تعذر تحميل بيانات الألعاب: ' + err.message;
    }
    renderBanner();
    renderCategories();
    renderGrid();
    renderStats();
    observeReveal();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
