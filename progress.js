(function () {
  const bar = document.getElementById('progress-bar');

  function updateScrollProgress() {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
    if (bar) bar.style.width = pct + '%';
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);

  // تقدم تحميل الصور داخل الشبكة
  function trackImages() {
    const imgs = document.querySelectorAll('.grid img');
    if (!imgs.length) return;
    let loaded = 0;
    imgs.forEach(img => {
      const done = () => { loaded++; if (loaded === imgs.length) document.body.classList.add('images-ready'); };
      if (img.complete) done();
      else { img.addEventListener('load', done); img.addEventListener('error', done); }
    });
  }

  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    updateScrollProgress();
  });

  // إعادة تتبع الصور بعد كل رسم للبطاقات
  const grid = document.getElementById('games');
  if (grid) new MutationObserver(trackImages).observe(grid, { childList: true });

  updateScrollProgress();
})();
