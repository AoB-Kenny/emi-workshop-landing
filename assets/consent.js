/* ============================================================
   Mutterlinien · Einwilligung + Meta Pixel
   ------------------------------------------------------------
   Vertrag (übernommen aus cookie-consent-guide.md des
   Trainer-Projekts, angepasst an Emis Designsystem und an Meta
   statt GA4):

   1. Ohne gespeicherte Entscheidung: Banner zeigen, NICHTS laden.
   2. marketing:false gespeichert: kein Banner, nichts laden.
   3. marketing:true gespeichert: kein Banner, Pixel sofort laden.
   4. Ablehnen ist genau ein Klick, gleiche Zeile, gleiche Größe
      wie Akzeptieren. Keine vorangekreuzten Felder.
   5. Entscheidung älter als 12 Monate: neu fragen.
   6. Widerruf über den Fußzeilen-Link. Wird die Einwilligung
      zurückgezogen, werden _fbp und _fbc gelöscht und die Seite
      neu geladen, damit kein geladenes Skript weiterläuft.

   Rechtlicher Hintergrund: LG Leipzig 04.07.2025 und OLG München
   18.12.2025. Meta Business Tools, die Conversions API
   ausdrücklich eingeschlossen, brauchen vorherige Einwilligung.
   Ein Hinweis in der Datenschutzerklärung genügt nicht.
   ============================================================ */
(function () {
  'use strict';

  var PIXEL_ID = 'META_PIXEL_ID';        // TODO ersetzen, siehe TODO.md
  var KEY = 'emi-consent';
  var MAX_AGE_DAYS = 365;

  /* ---------- Speicher ---------- */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || v.v !== 1 || typeof v.marketing !== 'boolean') return null;
      var age = (Date.now() - new Date(v.ts).getTime()) / 86400000;
      if (!isFinite(age) || age > MAX_AGE_DAYS) return null;
      return v;
    } catch (e) { return null; }
  }

  function write(marketing) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 1, marketing: marketing, ts: new Date().toISOString()
      }));
    } catch (e) { /* privater Modus: Entscheidung gilt nur für diese Sitzung */ }
  }

  function dropMetaCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var parts = host.split('.');
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    ['_fbp', '_fbc'].forEach(function (name) {
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' +
          (d ? '; domain=' + d : '');
      });
    });
  }

  /* ---------- Pixel ---------- */
  function loadPixel() {
    if (window.__emiPixelLoaded) return;
    if (!PIXEL_ID || PIXEL_ID === 'META_PIXEL_ID') return;   // noch keine ID hinterlegt
    window.__emiPixelLoaded = true;

    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    flushQueue();
  }

  /* Events, die vor der Einwilligung passiert sind, werden NICHT
     nachgeschickt. Die Warteschlange existiert nur für Events, die
     im selben Klick nach dem Zustimmen ausgelöst werden. */
  var queue = [];
  function flushQueue() {
    while (queue.length) { var a = queue.shift(); track(a[0], a[1], a[2]); }
  }

  function track(name, params, eventID) {
    if (!granted()) return false;
    if (!window.fbq) { queue.push([name, params, eventID]); return false; }
    if (eventID) fbq('track', name, params || {}, { eventID: eventID });
    else fbq('track', name, params || {});
    return true;
  }

  function granted() { var c = read(); return !!(c && c.marketing); }

  /* ---------- Banner ---------- */
  var el = null;

  function build() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Einwilligung in Marketing-Cookies');
    el.innerHTML =
      '<div class="cc-card">' +
        '<p class="cc-title">Kurz gefragt</p>' +
        '<p class="cc-text">Diese Seite kann den Meta-Pixel laden, damit Emi sieht, ' +
        'welche Anzeige dich hergebracht hat. Das passiert nur, wenn du zustimmst. ' +
        'Deine Entscheidung wird in deinem Browser gespeichert und du kannst sie jederzeit ' +
        'unten über „Cookie-Einstellungen" ändern. Mehr dazu in der ' +
        '<a href="https://emi-atmet.de/datenschutz.html">Datenschutzerklärung</a>.</p>' +
        '<div class="cc-row">' +
          '<button type="button" class="btn btn-ghost cc-no">Ablehnen</button>' +
          '<button type="button" class="btn cc-yes">Akzeptieren</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    el.querySelector('.cc-yes').addEventListener('click', function () {
      write(true); hide(); loadPixel();
    });
    el.querySelector('.cc-no').addEventListener('click', function () {
      write(false); hide();
    });
    return el;
  }

  function show() { build().classList.add('cc-open'); }
  function hide() { if (el) el.classList.remove('cc-open'); }

  /* ---------- Öffentliche API ---------- */
  window.emiConsent = {
    track: track,
    granted: granted,
    reopen: function () {
      var was = granted();
      build();
      show();
      window.__emiConsentWasGranted = was;
    },
    /* Vom Fußzeilen-Link genutzt: Widerruf räumt auf und lädt neu. */
    revokeIfNeeded: function () {
      if (window.__emiConsentWasGranted && !granted()) {
        dropMetaCookies();
        location.reload();
      }
    }
  };

  /* ---------- Start ---------- */
  function init() {
    var c = read();
    if (c === null) { show(); return; }
    if (c.marketing) loadPixel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  /* Fußzeilen-Link auf jeder Seite */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-consent-reopen]') : null;
    if (!t) return;
    e.preventDefault();
    window.emiConsent.reopen();
  });

  /* InitiateCheckout auf den Kauf-Klick. Stripes Hosted Checkout
     lässt keine Fremdskripte zu, also ist der Klick auf unserer
     eigenen Domain die Stelle, an der dieses Event entstehen kann. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-checkout]') : null;
    if (!a) return;
    track('InitiateCheckout', { value: 130, currency: 'EUR', content_name: 'Mutterlinien 12.09.2026' });
  });
})();
