/* 灯下 · 阅读进度、设置、键盘翻章。所有数据只存在本机浏览器 localStorage。 */
(function () {
  'use strict';
  var SK = 'dengxia.settings', PK = 'dengxia.progress', RK = 'dengxia.read', POSK = 'dengxia.pos';
  var DEF = { theme: 'luhuo', size: 19, lh: 1.95, font: 'serif' };
  var body = document.body, root = body.dataset.root || '', html = document.documentElement;

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function settings() { var s = load(SK, {}), o = {}; for (var k in DEF) o[k] = s[k] != null ? s[k] : DEF[k]; return o; }
  function applySettings(s) {
    html.dataset.theme = s.theme; html.dataset.font = s.font;
    html.style.setProperty('--fs', s.size + 'px'); html.style.setProperty('--lh', s.lh);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(html).getPropertyValue('--bg').trim() || '#1e1a16';
  }
  applySettings(settings());
  var progress = load(PK, { books: {}, last: null });
  if (!progress.books) progress.books = {};
  var readMap = load(RK, {});
  function pctText(p) { return Math.round((p || 0) * 100) + '%'; }

  // ---------- 书架 ----------
  if (body.classList.contains('page-home')) {
    var last = progress.last && progress.books[progress.last];
    if (last) {
      var box = document.getElementById('resume');
      box.innerHTML = '<div class="r-text"><div class="r-label">继续阅读</div><div class="r-book"></div><div class="r-ch"></div><div class="r-bar"><i></i></div></div><a class="btn primary" href="#">继续</a>';
      box.querySelector('.r-book').textContent = '《' + last.bookTitle + '》';
      box.querySelector('.r-ch').textContent = last.chTitle + ' · 读到 ' + pctText(last.pct);
      box.querySelector('.r-bar i').style.width = pctText(last.pct);
      box.querySelector('a').href = root + last.url;
      box.hidden = false;
    }
    [].forEach.call(document.querySelectorAll('.book-card'), function (card) {
      var p = progress.books[card.dataset.book];
      if (!p) return;
      var btn = card.querySelector('.js-continue');
      btn.textContent = '继续阅读'; btn.href = root + p.url;
      var line = card.querySelector('.progress-line');
      line.textContent = '读到 ' + p.chTitle + ' · ' + pctText(p.pct); line.hidden = false;
      var reads = readMap[card.dataset.book] || [];
      var maxRead = Math.max.apply(null, reads.concat([p.ch]));
      if (+card.dataset.latest > maxRead) card.querySelector('.new-badge').hidden = false;
    });
  }

  // ---------- 目录页 ----------
  if (body.classList.contains('page-book')) {
    var bp = progress.books[body.dataset.book], reads = readMap[body.dataset.book] || [];
    [].forEach.call(document.querySelectorAll('.toc li'), function (li) {
      var n = +li.dataset.ch;
      if (reads.indexOf(n) >= 0) li.classList.add('read');
      if (bp && bp.ch === n) li.classList.add('current');
    });
    if (bp) {
      var c = document.querySelector('.js-continue');
      c.textContent = '继续阅读 · ' + bp.chTitle; c.href = root + bp.url;
      document.querySelector('.js-first').hidden = false;
    }
  }

  // ---------- 阅读页 ----------
  if (body.classList.contains('page-chapter')) {
    var d = body.dataset, ch = +d.ch, bookId = d.book;
    var url = 'b/' + bookId + '/' + location.pathname.split('/').pop();
    var bar = document.querySelector('.progress-bar'), topbar = document.querySelector('.topbar');
    var toast = document.querySelector('.toast'), toastTimer;
    function showToast(t) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200); }

    function pct() {
      var max = document.documentElement.scrollHeight - innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
    }
    function record() {
      var p = pct();
      bar.style.width = (p * 100).toFixed(2) + '%';
      progress.books[bookId] = { ch: ch, url: url, pct: p, bookTitle: d.booktitle, chTitle: d.chtitle, t: Date.now() };
      progress.last = bookId;
      save(PK, progress);
      var pos = load(POSK, {}); (pos[bookId] || (pos[bookId] = {}))[ch] = Math.round(p * 1000) / 1000; save(POSK, pos);
      if (p > 0.85) {
        var r = readMap[bookId] || (readMap[bookId] = []);
        if (r.indexOf(ch) < 0) { r.push(ch); save(RK, readMap); }
      }
    }
    // 恢复这一章上次读到的位置（每章单独记）
    var savedPos = (load(POSK, {})[bookId] || {})[ch], ready = false;
    if (savedPos > 0.02 && savedPos < 0.99) {
      var restore = function () { scrollTo(0, savedPos * (document.documentElement.scrollHeight - innerHeight)); };
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
        restore(); setTimeout(function () { restore(); ready = true; record(); }, 150); showToast('已回到上次读到的地方');
      });
    } else { ready = true; }
    var lastY = scrollY, ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = scrollY;
        if (y > lastY + 6 && y > 120) topbar.classList.add('hide');
        else if (y < lastY - 6 || y < 120) topbar.classList.remove('hide');
        lastY = y; if (ready) record(); else bar.style.width = (pct() * 100).toFixed(2) + '%'; ticking = false;
      });
    }, { passive: true });
    if (ready) record();

    // 点正文中间：显示/隐藏顶栏（手机上方便）
    document.querySelector('.ch-body').addEventListener('click', function () {
      if (!getSelection().toString()) topbar.classList.toggle('hide');
    });

    // 键盘：← → 翻章，空格照常翻页
    addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && d.prev) location.href = d.prev;
      else if (e.key === 'ArrowRight' && d.next) location.href = d.next;
      else if (e.key === 'Escape') closeSheet();
    });

    // 设置面板
    var sheet = document.querySelector('.sheet');
    function openSheet() { body.classList.add('sheet-open'); sheet.setAttribute('aria-hidden', 'false'); syncUI(); }
    function closeSheet() { body.classList.remove('sheet-open'); sheet.setAttribute('aria-hidden', 'true'); }
    document.querySelector('.js-settings').addEventListener('click', openSheet);
    document.querySelector('.sheet-mask').addEventListener('click', closeSheet);
    function syncUI() {
      var s = settings();
      sheet.querySelector('.js-fs').textContent = s.size;
      sheet.querySelector('.js-lh').textContent = (+s.lh).toFixed(2);
      [].forEach.call(sheet.querySelectorAll('[data-theme]'), function (b) { b.classList.toggle('on', b.dataset.theme === s.theme); });
      [].forEach.call(sheet.querySelectorAll('[data-font]'), function (b) { b.classList.toggle('on', b.dataset.font === s.font); });
    }
    function update(fn) {
      var keep = pct(), s = settings(); fn(s); save(SK, s); applySettings(s); syncUI();
      scrollTo(0, keep * (document.documentElement.scrollHeight - innerHeight));
    }
    sheet.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.theme) update(function (s) { s.theme = b.dataset.theme; });
      else if (b.dataset.font) update(function (s) { s.font = b.dataset.font; });
      else switch (b.dataset.act) {
        case 'fs-': update(function (s) { s.size = Math.max(14, s.size - 1); }); break;
        case 'fs+': update(function (s) { s.size = Math.min(28, s.size + 1); }); break;
        case 'lh-': update(function (s) { s.lh = Math.max(1.5, Math.round((s.lh - 0.1) * 100) / 100); }); break;
        case 'lh+': update(function (s) { s.lh = Math.min(2.6, Math.round((s.lh + 0.1) * 100) / 100); }); break;
        case 'reset': update(function (s) { for (var k in DEF) s[k] = DEF[k]; }); break;
      }
    });
    // 预取下一章，翻页更快
    if (d.next) { var l = document.createElement('link'); l.rel = 'prefetch'; l.href = d.next; document.head.appendChild(l); }
  }
})();
