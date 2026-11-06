(function () {
  'use strict';

  const bar = document.getElementById('progress-bar');
  const splash = document.getElementById('splash');
  const grid = document.getElementById('gamesGrid');

  // 1) شريط تقدم التمرير أعلى الصفحة
  function updateScrollProgress() {
    if (!bar) return;
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    bar.style.width = (max > 0 ? (el.scrollTop / max) * 100 : 0) + '%';
  }

  // 2) تتبع تحميل صور البطاقات
  function trackImages() {
    if (!grid) return;
    const pending = Array.from(grid.querySelectorAll('img')).filter(img => !img.complete);
    let left = pending.length;
    document.body.classList.toggle('images-ready', left === 0);
    pending.forEach(img => {
      const done = () => {
        left--;
        if (left <= 0) document.body.classList.add('images-ready');
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  // 3) شاشة الافتتاح بالشعار المتحرك
  function hideSplash() {
    if (!splash) return;
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 700);
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);

  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    updateScrollProgress();
    trackImages();
    setTimeout(hideSplash, 1800);
  });

  if (grid) {
    new MutationObserver(trackImages).observe(grid, { childList: true });
  }

  updateScrollProgress();
})();
