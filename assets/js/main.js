/* ============================================================
   Interazioni del sito — vanilla JS, nessuna dipendenza
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. Preloader ---------- */
  (function preloader() {
    var el = document.getElementById('preloader');
    var bar = document.getElementById('preloaderBar');
    var num = document.getElementById('preloaderNum');
    if (!el) return;

    var pct = 0;
    var timer = setInterval(function () {
      pct = Math.min(pct + Math.random() * 18 + 6, 100);
      if (bar) bar.style.width = pct + '%';
      if (num) num.textContent = Math.round(pct);
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(done, 260);
      }
    }, reduce ? 30 : 130);

    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      el.classList.add('is-done');
      document.body.classList.remove('is-locked');
      startHero();
      setTimeout(function () { el.remove(); }, 900);
    }
    // rete di sicurezza: il sito non resta mai bloccato dietro al loader
    setTimeout(done, 3200);
    document.body.classList.add('is-locked');
  })();

  /* ---------- 2. Titolo hero: split per carattere ---------- */
  var heroSplits = [];
  (function splitText() {
    var nodes = document.querySelectorAll('[data-split]');
    Array.prototype.forEach.call(nodes, function (node, ni) {
      var text = node.textContent;
      node.textContent = '';
      node.setAttribute('aria-label', text);
      node.style.setProperty('--base', ni * 90 + 'ms');
      for (var i = 0; i < text.length; i++) {
        var ch = document.createElement('span');
        ch.className = 'ch';
        ch.setAttribute('aria-hidden', 'true');
        ch.style.setProperty('--i', i);
        ch.textContent = text[i] === ' ' ? ' ' : text[i];
        node.appendChild(ch);
      }
      heroSplits.push(node);
    });
  })();

  function startHero() {
    heroSplits.forEach(function (n) { n.classList.add('is-in'); });
    Array.prototype.forEach.call(document.querySelectorAll('.line-up'), function (n) {
      n.classList.add('is-in');
    });
    var firstRow = document.querySelectorAll('.hero .reveal');
    Array.prototype.forEach.call(firstRow, function (el) { show(el); });
  }

  /* ---------- 3. Reveal allo scroll ---------- */
  function show(el) {
    if (el.classList.contains('is-in')) return;
    el.style.setProperty('--d', (el.dataset.delay || 0) + 'ms');
    el.classList.add('is-in');
  }

  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    : null;

  var revealables = document.querySelectorAll('.reveal, .card, .plan');
  Array.prototype.forEach.call(revealables, function (el) {
    if (io) { io.observe(el); } else { show(el); }
  });

  /* ---------- 4. Contatori animati ---------- */
  (function counters() {
    var nodes = document.querySelectorAll('[data-count]');
    if (!nodes.length) return;

    function run(el) {
      var target = parseFloat(el.dataset.count) || 0;
      var suffix = el.dataset.suffix || '';
      var dur = 1500;
      var t0 = performance.now();
      function step(now) {
        var k = Math.min((now - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (k < 1) requestAnimationFrame(step);
      }
      if (reduce) { el.textContent = target + suffix; return; }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, run);
      return;
    }
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(nodes, function (n) { cio.observe(n); });
  })();

  /* ---------- 5. Nav sticky + progress bar ---------- */
  (function scrollUi() {
    var nav = document.getElementById('nav');
    var prog = document.getElementById('scrollProgress');
    var queued = false;

    function update() {
      queued = false;
      var y = window.scrollY || document.documentElement.scrollTop;
      if (nav) nav.classList.toggle('is-stuck', y > 40);
      if (prog) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      }
    }
    window.addEventListener('scroll', function () {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ---------- 6. Menu mobile ---------- */
  (function mobileNav() {
    var burger = document.getElementById('navBurger');
    var menu = document.getElementById('mobileMenu');
    if (!burger || !menu) return;

    function setOpen(open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('is-locked', open);
    }
    burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  })();

  /* ---------- 7. Cursore custom + magnetismo ---------- */
  if (fine && !reduce) {
    var cur = document.getElementById('cursor');
    if (cur) {
      var dot = cur.querySelector('.cursor__dot');
      var ring = cur.querySelector('.cursor__ring');
      var px = window.innerWidth / 2, py = window.innerHeight / 2;
      var rx = px, ry = py;

      window.addEventListener('pointermove', function (e) {
        px = e.clientX; py = e.clientY;
        if (dot) dot.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
      }, { passive: true });

      (function loop() {
        rx += (px - rx) * 0.16;
        ry += (py - ry) * 0.16;
        if (ring) ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        requestAnimationFrame(loop);
      })();

      var hoverables = 'a, button, summary, input, select, textarea, [data-magnetic], .card, .plan, .work';
      document.addEventListener('pointerover', function (e) {
        if (e.target.closest(hoverables)) cur.classList.add('is-hover');
      });
      document.addEventListener('pointerout', function (e) {
        if (e.target.closest(hoverables)) cur.classList.remove('is-hover');
      });
    }

    /* attrazione magnetica dei pulsanti */
    Array.prototype.forEach.call(document.querySelectorAll('[data-magnetic]'), function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = 'translate(' + dx * 9 + 'px,' + dy * 9 + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- 8. Spotlight + tilt 3D sulle card ---------- */
  if (fine && !reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.spot'), function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-tilt]'), function (el) {
      var target = el.classList.contains('work') ? el.querySelector('.work__frame') : el;
      if (!target) return;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        target.style.transform =
          'perspective(1100px) rotateY(' + dx * 4.5 + 'deg) rotateX(' + -dy * 4.5 + 'deg) translateZ(0)';
      });
      el.addEventListener('pointerleave', function () { target.style.transform = ''; });
    });
  }

  /* ---------- 9. FAQ: una risposta aperta alla volta ---------- */
  (function faq() {
    var items = document.querySelectorAll('.faq__item');
    Array.prototype.forEach.call(items, function (it) {
      it.addEventListener('toggle', function () {
        if (!it.open) return;
        Array.prototype.forEach.call(items, function (other) {
          if (other !== it) other.open = false;
        });
      });
    });
  })();

  /* ---------- 10. Form contatti -> email precompilata ---------- */
  (function contactForm() {
    var form = document.getElementById('contactForm');
    var hint = document.getElementById('formHint');
    if (!form) return;

    var EMAIL = 'cavannacarlo22@gmail.com';

    function markField(input, bad) {
      var wrap = input.closest('.field') || input.closest('.check');
      if (wrap) wrap.classList.toggle('is-bad', bad);
    }

    form.addEventListener('input', function (e) {
      if (e.target.matches('input, select, textarea')) markField(e.target, !e.target.checkValidity());
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var required = form.querySelectorAll('[required]');
      var firstBad = null;
      Array.prototype.forEach.call(required, function (input) {
        var bad = !input.checkValidity();
        markField(input, bad);
        if (bad && !firstBad) firstBad = input;
      });

      if (firstBad) {
        firstBad.focus();
        if (hint) { hint.textContent = 'Controlla i campi evidenziati in rosso.'; hint.classList.remove('is-ok'); }
        return;
      }

      var d = new FormData(form);
      var nome = (d.get('nome') || '').toString().trim();
      var subject = 'Richiesta preventivo sito web — ' + nome;
      var body = [
        'Ciao Carlo,',
        '',
        'Nome: ' + nome,
        'Email: ' + (d.get('email') || ''),
        'Tipo di progetto: ' + (d.get('tipo') || ''),
        'Budget indicativo: ' + (d.get('budget') || 'da definire'),
        '',
        'Il progetto:',
        (d.get('messaggio') || ''),
        '',
        '— Inviato dal sito carlocavanna'
      ].join('\n');

      window.location.href = 'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      if (hint) {
        hint.textContent = 'Ho aperto il tuo programma di posta: controlla e premi invia. Non si apre? Scrivimi a ' + EMAIL;
        hint.classList.add('is-ok');
      }
    });
  })();

  /* ---------- 11. Scroll morbido con offset per la nav fissa ---------- */
  (function smoothAnchors() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 68;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  })();

  /* ---------- 12. Anno nel footer ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
