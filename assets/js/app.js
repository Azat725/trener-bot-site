/* ==========================================================================
   Дарья — trener-bot-site
   Vanilla interaction layer. No dependencies, no build step.
   --------------------------------------------------------------------------
   Modules: config, utils, theme, media-slots, reveal, parallax, magnetic,
   nav, burger, progress, reviews, faq, modal+form, sticky bar,
   back-to-top, misc.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- CONFIG */
  var CONFIG = {
    telegram: 'iamddasha1',
    themeKey: 'theme',
    themeColor: { light: '#ECEEF2', dark: '#0B0E17' },
    revealThreshold: 0.16,
    breakpoints: { navSolid: 40, stickyBar: 520, backToTop: 900 }
  };

  /* -------------------------------------------------------------- UTILS */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function on(el, type, handler, opts) {
    if (!el) return;
    el.addEventListener(type, handler, opts || false);
  }

  /* rAF-throttled scroll subscriber bus */
  var scrollSubs = [];
  var scrollQueued = false;
  function onScroll(fn) {
    scrollSubs.push(fn);
    fn(window.scrollY || window.pageYOffset || 0);
  }
  function flushScroll() {
    var y = window.scrollY || window.pageYOffset || 0;
    for (var i = 0; i < scrollSubs.length; i++) {
      try { scrollSubs[i](y); } catch (e) { /* keep the loop alive */ }
    }
    scrollQueued = false;
  }
  on(window, 'scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(flushScroll);
  }, { passive: true });
  on(window, 'resize', function () { if (!scrollQueued) { scrollQueued = true; window.requestAnimationFrame(flushScroll); } }, { passive: true });

  function clamped(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  /* -------------------------------------------------------------- THEME */
  /* System theme by default; an explicit choice is saved and applied
     before first paint by the inline script in <head>. */
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function readStoredTheme() {
    try {
      var t = window.localStorage.getItem(CONFIG.themeKey);
      return t === 'dark' || t === 'light' ? t : null;
    } catch (e) { return null; }
  }

  function storeTheme(theme) {
    try { window.localStorage.setItem(CONFIG.themeKey, theme); } catch (e) { /* storage blocked */ }
  }

  function explicitTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' || attr === 'light' ? attr : readStoredTheme();
  }

  function currentTheme() {
    return explicitTheme() || (darkQuery.matches ? 'dark' : 'light');
  }

  function initTheme() {
    var root = document.documentElement;
    var toggles = $$('[data-theme-toggle]');
    var metas = $$('meta[data-theme-color]');

    function paint() {
      var stored = explicitTheme();
      var theme = currentTheme();
      var dark = theme === 'dark';

      toggles.forEach(function (btn) { btn.setAttribute('aria-pressed', String(dark)); });

      /* an explicit choice must win over the media-matched meta tags */
      metas.forEach(function (m) {
        var key = stored || m.getAttribute('data-theme-color');
        m.setAttribute('content', CONFIG.themeColor[key]);
      });
    }

    toggles.forEach(function (btn) {
      on(btn, 'click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        storeTheme(next);
        paint();
      });
    });

    var onSystemChange = function () { if (!explicitTheme()) paint(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemChange);
    else if (darkQuery.addListener) darkQuery.addListener(onSystemChange);
    paint();
  }

  /* -------------------------------------------------------- MEDIA SLOTS */
  function initMediaSlots() {
    $$('[data-avatar]').forEach(function (img) {
      var host = img.closest('.contact__ava');
      var ready = function () { host.classList.add('is-ready'); };
      if (img.complete) {
        if (img.naturalWidth > 0) ready();
      } else {
        on(img, 'load', ready, { once: true });
      }
    });
  }

  /* ------------------------------------------------------------- REVEAL */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduced.matches) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: CONFIG.revealThreshold, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------- PARALLAX */
  function initParallax() {
    var nodes = $$('[data-parallax]');
    if (!nodes.length || reduced.matches) return;

    var items = nodes.map(function (el) {
      return { el: el, speed: parseFloat(el.getAttribute('data-parallax')) || 0.08 };
    });

    function frame() {
      var vh = window.innerHeight;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var rect = it.el.getBoundingClientRect();
        if (rect.bottom < -220 || rect.top > vh + 220) continue;
        var centre = rect.top + rect.height / 2 - vh / 2;
        it.el.style.setProperty('--py', (-centre * it.speed).toFixed(2) + 'px');
      }
    }

    onScroll(frame);
    window.requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------- MAGNETIC */
  function initMagnetic() {
    if (!finePointer.matches || reduced.matches) return;

    $$('[data-magnetic]').forEach(function (el) {
      var raf = null, mx = 0, my = 0, strength = 0.22;

      function apply() {
        el.style.setProperty('--mx', mx.toFixed(2) + 'px');
        el.style.setProperty('--my', my.toFixed(2) + 'px');
        raf = null;
      }

      on(el, 'pointermove', function (e) {
        var r = el.getBoundingClientRect();
        mx = clamped((e.clientX - (r.left + r.width / 2)) * strength, -14, 14);
        my = clamped((e.clientY - (r.top + r.height / 2)) * strength, -10, 10);
        if (!raf) raf = window.requestAnimationFrame(apply);
      });

      on(el, 'pointerleave', function () {
        mx = 0; my = 0;
        if (!raf) raf = window.requestAnimationFrame(apply);
      });
    });
  }

  /* ---------------------------------------------------------------- NAV */
  function initNav() {
    var nav = $('[data-nav]');
    var burger = $('[data-burger]');
    var panel = $('[data-nav-panel]');
    var modal = $('[data-modal]');
    if (!nav) return;

    onScroll(function (y) {
      nav.classList.toggle('nav--solid', y > CONFIG.breakpoints.navSolid);
    });

    if (!burger || !panel) return;

    var open = false;
    function setMenu(next) {
      open = next;
      burger.setAttribute('aria-expanded', String(open));
      if (open) {
        panel.hidden = false;
        burger.querySelector('use').setAttribute('href', '#i-close');
      } else {
        panel.hidden = true;
        burger.querySelector('use').setAttribute('href', '#i-menu');
      }
    }

    on(burger, 'click', function () { setMenu(!open); });
    $$('a', panel).forEach(function (a) { on(a, 'click', function () { setMenu(false); }); });
    on(document, 'keydown', function (e) {
      if (e.key !== 'Escape' || !open || (modal && !modal.hidden)) return;
      setMenu(false);
      burger.focus();
    });
    on(window, 'resize', function () {
      if (open && window.innerWidth >= 1024) setMenu(false);
    }, { passive: true });
  }

  /* ----------------------------------------------------------- PROGRESS */
  function initProgress() {
    var bar = $('[data-progress]');
    if (!bar) return;
    onScroll(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamped(window.scrollY / max, 0, 1) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    });
  }

  /* ------------------------------------------------------------ REVIEWS */
  function initReviews() {
    var root = $('[data-reviews]');
    if (!root) return;

    var track = $('[data-rev-track]', root);
    if (!track) return;
    var dotsBox = $('[data-rev-dots]', root);
    var prev = $('[data-rev-prev]');
    var next = $('[data-rev-next]');
    var cards = $$('.review', track);
    if (!cards.length) return;

    /* dots */
    var dots = [];
    if (dotsBox) {
      cards.forEach(function (card, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Отзыв ' + (i + 1) + ' из ' + cards.length);
        on(b, 'click', function () { scrollToCard(i); });
        dotsBox.appendChild(b);
        dots.push(b);
      });
    }

    function cardPosition(card) {
      return card.offsetLeft - cards[0].offsetLeft;
    }

    function activeIndex() {
      var best = 0, bestDist = Infinity;
      cards.forEach(function (card, i) {
        var d = Math.abs(cardPosition(card) - track.scrollLeft);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    function scrollToCard(i, behavior) {
      var card = cards[clamped(i, 0, cards.length - 1)];
      track.scrollTo({
        left: cardPosition(card),
        behavior: behavior || (reduced.matches ? 'auto' : 'smooth')
      });
    }

    var current = 0;
    function sync() {
      current = activeIndex();
      dots.forEach(function (d, di) {
        d.classList.toggle('is-active', di === current);
        if (di === current) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (prev) prev.setAttribute('aria-disabled', String(current === 0));
      if (next) next.setAttribute('aria-disabled', String(current === cards.length - 1));
    }

    var syncTimer = null;
    on(track, 'scroll', function () {
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(sync, 60);
    }, { passive: true });

    on(window, 'resize', function () { scrollToCard(current, 'instant'); sync(); }, { passive: true });

    on(prev, 'click', function () { if (current > 0) scrollToCard(current - 1); });
    on(next, 'click', function () { if (current < cards.length - 1) scrollToCard(current + 1); });

    on(track, 'keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollToCard(activeIndex() + 1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); scrollToCard(activeIndex() - 1); }
    });

    /* drag to pan (mouse only — touch already scrolls natively) */
    var down = false, startX = 0, startScroll = 0, moved = false;
    on(track, 'pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
    });
    on(window, 'pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) <= 4) return;
      if (!moved) {
        moved = true;
        track.classList.add('is-dragging');
      }
      track.scrollLeft = startScroll - dx;
      e.preventDefault();
    });
    function endDrag() {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
      if (moved) {
        scrollToCard(activeIndex());
        window.setTimeout(function () { moved = false; }, 0);
      }
    }
    on(window, 'pointerup', endDrag);
    on(window, 'pointercancel', endDrag);
    /* swallow only the click that ends a drag, then let clicks through again */
    on(track, 'click', function (e) {
      if (!moved) return;
      moved = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    sync();
    window.requestAnimationFrame(sync);
  }

  /* ---------------------------------------------------------------- FAQ */
  function initFaq() {
    $$('[data-faq] .faq__item').forEach(function (item) {
      var btn = $('.faq__q', item);
      var answer = $('.faq__a', item);
      if (!btn) return;
      on(btn, 'click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
        answer.toggleAttribute('inert', !open);
        answer.setAttribute('aria-hidden', String(!open));
      });
    });
  }

  /* ------------------------------------------------------- MODAL + FORM */
  function initModal() {
    var modal = $('[data-modal]');
    if (!modal) return;

    var box = $('[data-modal-box]', modal);
    var stepForm = $('[data-step="form"]', modal);
    var stepDone = $('[data-step="done"]', modal);
    var form = $('[data-form]', modal);
    var title = $('#modal-title', modal);
    var material = form.elements.namedItem('material');
    var materialField = $('[data-material-field]', form);
    var materialPicker = $('#material-picker', form);
    var pickers = $$('.form-picker', form);
    var trainingFields = $$('[data-training-field]', form);
    var preview = $('[data-preview]', modal);
    var tgOpen = $('[data-tg-open]', modal);
    var copyBtn = $('[data-copy]', modal);
    var copyLabel = $('[data-copy-label]', modal);
    var lastFocus = null;
    var lastMessage = '';
    var isTrial = false;
    var closeTimer;

    /* --- open / close --- */
    function showFormStep() {
      copyLabel.textContent = 'Скопировать текст';
      box.setAttribute('aria-labelledby', 'modal-title');
      stepDone.hidden = true;
      stepForm.hidden = false;
    }

    function openModal(trigger) {
      window.clearTimeout(closeTimer);
      lastFocus = trigger;
      if (!stepDone.hidden) {
        form.reset();
        pickers.forEach(updatePickerLabel);
        $$('#f-name, #f-contact', modal).forEach(function (input) { setError(input, false); });
        showFormStep();
      }

      var selectedMaterial = trigger.getAttribute('data-material');
      var isMaterialOrder = Boolean(selectedMaterial);
      isTrial = trigger.hasAttribute('data-trial');
      if (isMaterialOrder) {
        material.value = selectedMaterial;
        updatePickerLabel(materialPicker);
      }
      title.textContent = isMaterialOrder ? 'Заказать материал' : 'Запись на тренировку';
      if (isTrial) title.textContent = 'Запись на пробную тренировку';
      materialField.hidden = !isMaterialOrder;
      trainingFields.forEach(function (field) { field.hidden = isMaterialOrder; });

      modal.hidden = false;
      box.scrollTop = 0;
      document.body.classList.add('is-locked');

      window.requestAnimationFrame(function () {
        modal.classList.add('is-open');
        $('[data-modal-close]', box).focus({ preventScroll: true });
      });
    }

    function closeModal() {
      pickers.forEach(function (picker) { picker.open = false; });
      modal.classList.remove('is-open');
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function () {
        modal.hidden = true;
        document.body.classList.remove('is-locked');
        if (lastFocus && lastFocus.offsetParent !== null) lastFocus.focus();
        else if (lastFocus && lastFocus.closest('[data-nav-panel]')) $('[data-burger]').focus();
      }, reduced.matches ? 0 : 320);
    }

    $$('[data-open-modal]').forEach(function (btn) {
      on(btn, 'click', function () { openModal(btn); });
    });
    $$('[data-modal-close]').forEach(function (btn) { on(btn, 'click', closeModal); });
    on($('[data-edit-draft]', modal), 'click', function () {
      showFormStep();
      box.scrollTop = 0;
      title.focus({ preventScroll: true });
    });

    function updatePickerLabel(picker) {
      $('summary span', picker).textContent = $('input:checked', picker).nextElementSibling.textContent;
    }

    function closePicker(picker) {
      picker.open = false;
      $('summary', picker).focus({ preventScroll: true });
    }

    pickers.forEach(function (picker) {
      on(picker, 'toggle', function () {
        if (picker.open) $('.form-picker__options', picker).scrollIntoView({ block: 'nearest' });
      });
      on(picker, 'change', function () { updatePickerLabel(picker); });
      on(picker, 'click', function (e) {
        if (e.target.type === 'radio' && e.detail > 0) closePicker(picker);
      });
      on(picker, 'keydown', function (e) {
        if (e.target.type !== 'radio' || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        e.target.checked = true;
        updatePickerLabel(picker);
        closePicker(picker);
      });
      on(picker, 'focusout', function (e) {
        if (e.relatedTarget && !picker.contains(e.relatedTarget)) picker.open = false;
      });
      on(box, 'click', function (e) {
        if (!picker.contains(e.target)) picker.open = false;
      });
    });

    on(document, 'keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') {
        var openPicker = $('.form-picker[open]', form);
        if (openPicker) closePicker(openPicker);
        else closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = $$('a[href], button:not([disabled]), input, summary, textarea', box)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* --- validation --- */
    function fieldOf(input) { return input.closest('.field'); }

    function setError(input, on_) {
      var field = fieldOf(input);
      if (!field) return;
      field.classList.toggle('has-error', on_);
      var msg = $('[data-error-for="' + input.name + '"]', field);
      if (msg) {
        msg.hidden = !on_;
        if (on_) input.setAttribute('aria-describedby', msg.id);
        else input.removeAttribute('aria-describedby');
      }
      input.setAttribute('aria-invalid', String(on_));
    }

    function isValid(input) {
      var value = input.value.trim();
      if (input.name === 'name') return value.length >= 2;
      if (/^@[a-z0-9_]{4,32}$/i.test(value)) return true;
      var digits = value.replace(/\D/g, '');
      return /^\+?[\d\s().-]+$/.test(value) && /^\d{7,15}$/.test(digits) && /[1-9]/.test(digits);
    }

    function validate() {
      return $$('#f-name, #f-contact', modal).filter(function (input) {
        var invalid = !isValid(input);
        setError(input, invalid);
        return invalid;
      });
    }

    $$('#f-name, #f-contact', modal).forEach(function (input) {
      on(input, 'input', function () { if (fieldOf(input).classList.contains('has-error')) setError(input, false); });
      on(input, 'blur', function () {
        if (input.value.trim()) setError(input, !isValid(input));
      });
    });

    /* --- message --- */
    function buildMessage() {
      var name = $('#f-name', modal).value.trim();
      var contact = $('#f-contact', modal).value.trim();
      if (!materialField.hidden) {
        return ['Хочу заказать: ' + material.value, '', 'Имя: ' + name, 'Связь: ' + contact].join('\n');
      }

      var format = ($('input[name="format"]:checked', modal) || {}).value || 'Персональная тренировка';
      var when = form.elements.namedItem('when').value;
      var goal = $('#f-goal', modal).value.trim();

      var lines = [
        isTrial ? 'Заявка на пробную тренировку' : 'Заявка на тренировку',
        '',
        'Формат: ' + format,
        'Имя: ' + name,
        'Связь: ' + contact,
        'Удобное время: ' + when
      ];
      if (goal) lines.push('Цель: ' + goal);
      lines.push('', 'Отправлено с сайта trener-bot-site');
      return lines.join('\n');
    }

    on(form, 'submit', function (e) {
      e.preventDefault();
      var bad = validate();
      if (bad.length) {
        bad[0].focus();
        return;
      }

      lastMessage = buildMessage();
      preview.textContent = lastMessage;
      tgOpen.href = 'https://t.me/' + CONFIG.telegram + '?text=' + encodeURIComponent(lastMessage);
      stepForm.hidden = true;
      stepDone.hidden = false;
      box.setAttribute('aria-labelledby', 'modal-done-title');
      box.scrollTop = 0;
      tgOpen.focus();
    });

    on(copyBtn, 'click', function () {
      copyText(lastMessage).then(function () {
        copyLabel.textContent = 'Скопировано';
        window.setTimeout(function () { copyLabel.textContent = 'Скопировать текст'; }, 1800);
      }).catch(function () {
        copyLabel.textContent = 'Выделите текст вручную';
        if (preview && window.getSelection) {
          var range = document.createRange();
          range.selectNodeContents(preview);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    });
  }

  /* --------------------------------------------- STICKY BAR / BACK TO TOP */
  function initFloaters() {
    var bar = $('[data-stickybar]');
    var top = $('[data-totop]');
    var hero = $('#hero');
    var nutrition = $('#nutrition');

    /* keep the back-to-top button clear of the sticky bar, whatever its height */
    function measureBar() {
      if (!bar) return;
      document.documentElement.style.setProperty('--stickybar-h', bar.offsetHeight + 'px');
    }
    measureBar();
    var mt;
    on(window, 'resize', function () {
      window.clearTimeout(mt);
      mt = window.setTimeout(measureBar, 150);
    }, { passive: true });

    function paint(y) {
      var heroBottom = hero ? hero.offsetTop + hero.offsetHeight - 260 : CONFIG.breakpoints.stickyBar;
      var section = nutrition && nutrition.getBoundingClientRect();
      var middle = window.innerHeight / 2;
      var browsingNutrition = section && section.top < middle && section.bottom > middle;

      if (bar) {
        var showBar = y > heroBottom && !browsingNutrition;
        if (bar.hidden === showBar) { bar.hidden = !showBar; measureBar(); }
        bar.classList.toggle('is-shown', showBar);
      }
      if (top) {
        var showTop = y > Math.max(CONFIG.breakpoints.backToTop, heroBottom) && !browsingNutrition;
        if (showTop && top.hidden) top.hidden = false;
        if (!showTop && !top.hidden) top.hidden = true;
        top.classList.toggle('is-shown', showTop);
      }
    }

    onScroll(paint);

    on(top, 'click', function () {
      window.scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------- BOOT */
  function boot() {
    initTheme();
    initMediaSlots();
    initReveal();
    initParallax();
    initMagnetic();
    initNav();
    initProgress();
    initReviews();
    initFaq();
    initModal();
    initFloaters();
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
