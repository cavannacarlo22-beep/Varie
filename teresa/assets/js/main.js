/* =========================================================================
   Teresa Sardanelli — logica del sito
   Nessuna libreria esterna: vanilla JS, ~15 kB.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     CONFIGURAZIONE — Teresa, modifica QUI i tuoi contatti.
     Il numero WhatsApp va scritto con il prefisso internazionale e
     senza spazi, "+" o zeri iniziali. Esempio: 393401234567
     Se lasci whatsapp vuoto, gli ordini partono via email.
     --------------------------------------------------------------------- */
  var SHOP = {
    whatsapp: '',
    email: 'ciao@teresasardanelli.it',
    shipping: 7,          // costo spedizione in euro
    freeFrom: 150,        // spedizione gratuita da questa cifra in su
    storeKey: 'ts-cart-v1'
  };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var euro = function (n) { return '€' + n.toFixed(2).replace('.00', '').replace('.', ','); };

  /* ============================================================ preloader */
  (function preloader() {
    var el = $('#preloader'); if (!el) return;
    var bar = $('#plBar'), num = $('#plNum'), p = 0;
    document.body.classList.add('is-locked');
    var t = setInterval(function () {
      p = Math.min(100, p + Math.random() * 18 + 6);
      if (bar) bar.style.width = p + '%';
      if (num) num.textContent = Math.round(p);
      if (p >= 100) {
        clearInterval(t);
        setTimeout(function () {
          el.classList.add('done');
          document.body.classList.remove('is-locked');
          document.body.classList.add('loaded');
          kick();
        }, 260);
      }
    }, reduced ? 40 : 130);
  })();

  /* ====================================================== reveal + split */
  var io = null;
  function observe() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal,.split').forEach(function (e) { e.classList.add('in'); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    $$('.reveal,.split').forEach(function (e) { io.observe(e); });
  }

  // Spezza i titoli in parole per farle salire una dopo l'altra.
  function splitWords() {
    $$('.split').forEach(function (el) {
      if (el.dataset.done) return;
      var html = el.innerHTML.split(/(<[^>]+>)/);
      var out = '', i = 0, inTag = false;
      html.forEach(function (chunk) {
        if (/^<[^>]+>$/.test(chunk)) { out += chunk; return; }
        chunk.split(/(\s+)/).forEach(function (w) {
          if (!w.trim()) { out += w; return; }
          out += '<span class="w"><span style="--wd:' + (i * 0.055).toFixed(3) + 's">' + w + '</span></span>';
          i++;
        });
      });
      el.innerHTML = out;
      el.dataset.done = '1';
      void inTag;
    });
  }

  function kick() {
    $$('.reveal,.split').forEach(function (e) {
      var r = e.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92) e.classList.add('in');
    });
  }

  /* =============================================================== header */
  (function header() {
    var h = $('#header'), nav = $('#nav'), burger = $('#burger');
    var onScroll = function () { h.classList.toggle('stuck', window.scrollY > 24); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    if (burger) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        burger.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', nav).forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('open'); burger.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }
  })();

  /* ======================================================= cursore custom */
  (function cursor() {
    if (reduced || window.matchMedia('(pointer:coarse)').matches) return;
    var ring = $('#cursor'), dot = $('#cursorDot');
    if (!ring) return;
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    document.addEventListener('mousemove', function (e) {
      if (!document.body.classList.contains('has-cursor')) document.body.classList.add('has-cursor');
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + (mx - 2.5) + 'px,' + (my - 2.5) + 'px,0)';
    }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = 'translate3d(' + (rx - 19) + 'px,' + (ry - 19) + 'px,0)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', function (e) {
      var hit = e.target.closest('a,button,.card,input,textarea,select,.sw');
      ring.classList.toggle('is-big', !!hit);
    });
  })();

  /* ====================================================== bottoni magnetici */
  (function magnetic() {
    if (reduced || window.matchMedia('(pointer:coarse)').matches) return;
    $$('[data-magnet]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  })();

  /* ============================================================= parallasse */
  (function parallax() {
    if (reduced) return;
    var stage = $('#heroStage'); if (!stage) return;
    var items = $$('[data-depth]', stage);
    var raf = null, tx = 0, ty = 0;
    window.addEventListener('mousemove', function (e) {
      tx = (e.clientX / innerWidth - 0.5); ty = (e.clientY / innerHeight - 0.5);
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    function apply() {
      raf = null;
      items.forEach(function (it) {
        var d = parseFloat(it.dataset.depth) || 10;
        it.style.translate = (tx * d) + 'px ' + (ty * d) + 'px';
      });
    }
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y < innerHeight) stage.style.transform = 'translateY(' + (y * 0.08) + 'px)';
    }, { passive: true });
  })();

  /* ================================================================ filtri */
  (function filters() {
    var chips = $$('[data-filter]'), cards = $$('.card');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', 'true');
        var f = c.dataset.filter;
        cards.forEach(function (card) {
          var ok = f === 'tutte' || card.dataset.cat === f;
          card.classList.toggle('hide', !ok);
          if (ok) { card.classList.remove('in'); requestAnimationFrame(function () { card.classList.add('in'); }); }
        });
      });
    });
  })();

  /* =============================================== pastiglie colore (card) */
  function paint(el, sw) {
    el.style.setProperty('--bag-lt', sw.dataset.lt);
    el.style.setProperty('--bag', sw.dataset.base);
    el.style.setProperty('--bag-dk', sw.dataset.dk);
  }
  $$('.card').forEach(function (card) {
    $$('.sw', card).forEach(function (sw) {
      var go = function (e) {
        e.preventDefault(); e.stopPropagation();
        $$('.sw', card).forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        sw.setAttribute('aria-pressed', 'true');
        card.dataset.color = sw.dataset.key;
        paint(card, sw);
      };
      sw.addEventListener('click', go);
    });
  });

  // Gli SVG delle borse usano id interni (gradienti, pattern, clip) che finiscono
  // con lo slug del prodotto. Clonando la stessa borsa in piu' punti della pagina
  // gli id si duplicherebbero e il browser userebbe sempre il primo: il colore
  // non seguirebbe. Qui li rendiamo univoci per ogni copia.
  var uid = 0;
  function bagFor(slug, tag) {
    var card = $('.card[data-slug="' + slug + '"]');
    if (!card) return '';
    var el = $('.bag__svg', card);
    if (!el || el.tagName === 'IMG') return el ? el.outerHTML : '';
    var suffix = (tag || 'c') + (++uid);
    return el.outerHTML.replace(
      new RegExp('-' + slug + '(?=[")])', 'g'), '-' + slug + suffix);
  }

  /* ============================================================ quick view */
  var PV = { slug: null, size: null, color: null, qty: 1 };
  var pv = $('#pv');

  function product(slug) {
    for (var i = 0; i < window.PRODUCTS.items.length; i++) {
      if (window.PRODUCTS.items[i].slug === slug) return window.PRODUCTS.items[i];
    }
    return null;
  }
  function colorOf(key) { return window.PRODUCTS.palette[key]; }
  function sizeOf(p, id) {
    for (var i = 0; i < p.sizes.length; i++) if (p.sizes[i].id === id) return p.sizes[i];
    return p.sizes[0];
  }

  function openPV(slug, color) {
    var p = product(slug); if (!p) return;
    PV = { slug: slug, size: p.sizes[0].id, color: color || p.colors[0], qty: 1 };
    $('#pvMedia').innerHTML = bagFor(slug, 'pv');
    $('#pvName').textContent = p.name;
    $('#pvTag').textContent = p.tagline;
    $('#pvStory').textContent = p.story;
    $('#pvMat').textContent = p.material;

    $('#pvSizes').innerHTML = p.sizes.map(function (s) {
      return '<button class="optbtn" type="button" role="button" aria-pressed="' +
        (s.id === PV.size) + '" data-size="' + s.id + '">' + s.name +
        '<small>' + s.dim + '</small></button>';
    }).join('');

    $('#pvColors').innerHTML = p.colors.map(function (k) {
      var c = colorOf(k);
      return '<button class="sw sw--lg" type="button" aria-pressed="' + (k === PV.color) +
        '" data-key="' + k + '" data-lt="' + c.lt + '" data-base="' + c.hex + '" data-dk="' + c.dk +
        '" style="background:' + c.hex + '" title="' + c.name + '" aria-label="Colore ' + c.name + '"></button>';
    }).join('');

    syncPV();
    show(pv);
  }

  function syncPV() {
    var p = product(PV.slug), s = sizeOf(p, PV.size), c = colorOf(PV.color);
    $('#pvPrice').textContent = euro(s.price * PV.qty);
    $('#pvDim').textContent = s.dim;
    $('#pvColorName').textContent = c.name;
    $('#pvSizeName').textContent = s.name;
    $('#pvQty').textContent = PV.qty;
    var media = $('#pvMedia');
    media.style.setProperty('--bag-lt', c.lt);
    media.style.setProperty('--bag', c.hex);
    media.style.setProperty('--bag-dk', c.dk);
    $$('#pvSizes .optbtn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.size === PV.size);
    });
    $$('#pvColors .sw').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.key === PV.color);
    });
  }

  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); openPV(open.dataset.open, open.dataset.color || null); return; }
    var sz = e.target.closest('#pvSizes .optbtn');
    if (sz) { PV.size = sz.dataset.size; syncPV(); return; }
    var cl = e.target.closest('#pvColors .sw');
    if (cl) { PV.color = cl.dataset.key; syncPV(); return; }
  });

  $('#pvMinus').addEventListener('click', function () { PV.qty = Math.max(1, PV.qty - 1); syncPV(); });
  $('#pvPlus').addEventListener('click', function () { PV.qty = Math.min(9, PV.qty + 1); syncPV(); });
  $('#pvAdd').addEventListener('click', function () {
    add(PV.slug, PV.size, PV.color, PV.qty);
    hide(pv);
    setTimeout(function () { show($('#cart')); }, 380);
  });

  /* ============================================================= carrello */
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem(SHOP.storeKey)) || []; } catch (err) { cart = []; }

  function save() { try { localStorage.setItem(SHOP.storeKey, JSON.stringify(cart)); } catch (err) {} }
  function count() { return cart.reduce(function (n, i) { return n + i.qty; }, 0); }
  function subtotal() {
    return cart.reduce(function (n, i) {
      var p = product(i.slug); if (!p) return n;
      return n + sizeOf(p, i.size).price * i.qty;
    }, 0);
  }

  function add(slug, size, color, qty) {
    var found = null;
    cart.forEach(function (i) { if (i.slug === slug && i.size === size && i.color === color) found = i; });
    if (found) found.qty = Math.min(9, found.qty + qty);
    else cart.push({ slug: slug, size: size, color: color, qty: qty });
    save(); renderCart(); bump();
    var p = product(slug);
    toast(p.name + ' · ' + sizeOf(p, size).name + ' aggiunta al carrello');
  }
  function remove(idx) { cart.splice(idx, 1); save(); renderCart(); }
  function setQty(idx, d) {
    cart[idx].qty += d;
    if (cart[idx].qty < 1) cart.splice(idx, 1);
    else cart[idx].qty = Math.min(9, cart[idx].qty);
    save(); renderCart();
  }

  function bump() {
    var n = $('#cartN'); n.classList.add('bump');
    setTimeout(function () { n.classList.remove('bump'); }, 380);
  }

  function renderCart() {
    var n = count();
    $('#cartN').textContent = n;
    $('#cartBtn').setAttribute('aria-label', 'Carrello, ' + n + ' articoli');
    var box = $('#cartItems');
    if (!cart.length) {
      box.innerHTML = '<div class="cart__empty"><p>Il carrello è vuoto.</p>' +
        '<button class="btn btn--ghost" type="button" data-close><span>Vedi la collezione</span></button></div>';
      $('#cartFoot').hidden = true;
      return;
    }
    $('#cartFoot').hidden = false;
    box.innerHTML = cart.map(function (i, idx) {
      var p = product(i.slug); if (!p) return '';
      var s = sizeOf(p, i.size), c = colorOf(i.color);
      return '<div class="ci"><div class="ci__img" style="--bag-lt:' + c.lt + ';--bag:' + c.hex +
        ';--bag-dk:' + c.dk + '">' + bagFor(i.slug) + '</div>' +
        '<div><h3>' + p.name + '</h3><p>' + s.name + ' · ' + s.dim + ' · ' + c.name + '</p>' +
        '<div class="qty"><button type="button" data-q="-1" data-i="' + idx + '" aria-label="Riduci quantità">−</button>' +
        '<span>' + i.qty + '</span>' +
        '<button type="button" data-q="1" data-i="' + idx + '" aria-label="Aumenta quantità">+</button></div></div>' +
        '<div style="text-align:right"><div class="ci__price">' + euro(s.price * i.qty) + '</div>' +
        '<button class="ci__rm" type="button" data-rm="' + idx + '">Rimuovi</button></div></div>';
    }).join('');

    var sub = subtotal();
    var ship = sub >= SHOP.freeFrom || sub === 0 ? 0 : SHOP.shipping;
    $('#cartSub').textContent = euro(sub);
    $('#cartShip').textContent = ship ? euro(ship) : 'Gratuita';
    $('#cartTot').textContent = euro(sub + ship);
    $('#cartHint').textContent = ship
      ? 'Aggiungi ' + euro(SHOP.freeFrom - sub) + ' per la spedizione gratuita.'
      : 'Spedizione gratuita inclusa. Realizzazione 7–10 giorni lavorativi.';
  }

  $('#cartItems').addEventListener('click', function (e) {
    var rm = e.target.closest('[data-rm]');
    if (rm) { remove(+rm.dataset.rm); return; }
    var q = e.target.closest('[data-q]');
    if (q) { setQty(+q.dataset.i, +q.dataset.q); }
  });

  /* --------------------------------------------------- invio dell'ordine */
  $('#checkout').addEventListener('click', function () {
    if (!cart.length) return;
    var lines = cart.map(function (i) {
      var p = product(i.slug), s = sizeOf(p, i.size), c = colorOf(i.color);
      return '• ' + p.name + ' — ' + s.name + ' (' + s.dim + ') — colore ' + c.name +
        ' — q.tà ' + i.qty + ' — ' + euro(s.price * i.qty);
    });
    var sub = subtotal();
    var ship = sub >= SHOP.freeFrom ? 0 : SHOP.shipping;
    var txt = 'Ciao Teresa! Vorrei ordinare:\n\n' + lines.join('\n') +
      '\n\nSubtotale: ' + euro(sub) +
      '\nSpedizione: ' + (ship ? euro(ship) : 'gratuita') +
      '\nTotale: ' + euro(sub + ship) +
      '\n\nNome e cognome:\nIndirizzo di spedizione:\nTelefono:';
    if (SHOP.whatsapp) {
      window.open('https://wa.me/' + SHOP.whatsapp + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    } else {
      window.location.href = 'mailto:' + SHOP.email +
        '?subject=' + encodeURIComponent('Nuovo ordine dal sito') +
        '&body=' + encodeURIComponent(txt);
    }
  });

  /* ================================================= apertura/chiusura sheet */
  var lastFocus = null;
  function show(el) {
    lastFocus = document.activeElement;
    el.classList.add('open');
    document.body.classList.add('is-locked');
    var f = el.querySelector('button,[href],input,select,textarea');
    if (f) setTimeout(function () { f.focus(); }, 120);
  }
  function hide(el) {
    el.classList.remove('open');
    if (!$('.sheet.open')) document.body.classList.remove('is-locked');
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target.classList.contains('sheet__bg')) {
      var s = e.target.closest('.sheet'); if (s) hide(s);
    }
    if (e.target.closest('#cartBtn')) { renderCart(); show($('#cart')); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var s = $('.sheet.open'); if (s) hide(s); }
  });
  // trap del focus dentro il pannello aperto
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var s = $('.sheet.open'); if (!s) return;
    var f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', s)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ============================================================= accordion */
  $$('.acc__b').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', !open);
      $('#' + b.getAttribute('aria-controls')).dataset.open = !open;
    });
  });

  /* ================================================================= toast */
  var tTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ========================================================= form contatti */
  var form = $('#contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var body = 'Nome: ' + d.get('nome') + '\nEmail: ' + d.get('email') +
        '\nModello di interesse: ' + d.get('modello') + '\n\n' + d.get('messaggio');
      window.location.href = 'mailto:' + SHOP.email +
        '?subject=' + encodeURIComponent('Richiesta dal sito — ' + d.get('nome')) +
        '&body=' + encodeURIComponent(body);
      toast('Grazie! Si apre il tuo programma di posta per inviare il messaggio.');
    });
  }

  /* ================================================================= anno */
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ================================================================= start */
  splitWords();
  observe();
  renderCart();
  window.addEventListener('load', kick);
})();
