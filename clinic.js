// \u064a\u0639\u0645\u0644 \u062f\u0627\u062e\u0644 \u0635\u0641\u062d\u0629 \u0627\u0644\u0625\u0642\u0631\u0627\u0631 \u0639\u0646\u062f \u0627\u0644\u0636\u063a\u0637 \u0639\u0644\u0649 \u0625\u0634\u0627\u0631\u0629 \u00ab\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0631\u064a\u0636\u00bb \u0641\u064a \u0627\u0644\u0645\u062a\u0635\u0641\u062d
(() => {
  if (window.__clinicSign) { window.__clinicSign.open(); return; }

  const SCRIPT = document.currentScript || [...document.scripts].reverse().find(x => /clinic\.js/.test(x.src));
  const SITE = SCRIPT ? new URL('.', SCRIPT.src.split('?')[0]).href.replace(/\/$/, '') : '';
  const UI_ID = 'clinic-sign-ui';
  const TARGET_KEY = 'target:' + location.origin + location.pathname;
  const store = {
    get: async (k) => { try { return localStorage.getItem('clinicSign:' + k); } catch (_) { return null; } },
    set: async (k, v) => { try { localStorage.setItem('clinicSign:' + k, v); } catch (_) {} },
    del: async (k) => { try { localStorage.removeItem('clinicSign:' + k); } catch (_) {} },
  };

  // ---------- 1) \u062a\u062d\u062f\u064a\u062f \u062e\u0627\u0646\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 (\u0641\u064a \u0627\u0644\u0635\u0641\u062d\u0629 \u0648\u062f\u0627\u062e\u0644 \u0627\u0644\u0625\u0637\u0627\u0631\u0627\u062a iframe) ----------
  function allDocs() {
    const out = [], blocked = [];
    (function walk(doc) {
      out.push(doc);
      for (const f of doc.querySelectorAll('iframe,frame')) {
        try { const d = f.contentDocument; if (d && d.documentElement) walk(d); else blocked.push(f); }
        catch (_) { blocked.push(f); }
      }
    })(document);
    allDocs.blocked = blocked.length;
    return out;
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const st = el.ownerDocument.defaultView.getComputedStyle(el);
    return r.width >= 60 && r.height >= 30 && st.visibility !== 'hidden' && st.display !== 'none' && !el.closest('#' + UI_ID);
  }
  function visibleCanvases() {
    return allDocs().flatMap(d => [...d.querySelectorAll('canvas')]).filter(isVisible);
  }

  function selectorFor(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== el.ownerDocument.body) {
      let part = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      const sameTag = [...el.parentElement.children].filter(c => c.tagName === el.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
  function saveTarget(el) {
    const i = allDocs().indexOf(el.ownerDocument);
    return store.set(TARGET_KEY, i + '|' + selectorFor(el));
  }

  async function findTarget() {
    const saved = await store.get(TARGET_KEY);
    if (saved && saved.includes('|')) {
      try {
        const [i, sel] = [saved.slice(0, saved.indexOf('|')), saved.slice(saved.indexOf('|') + 1)];
        const doc = allDocs()[+i];
        const el = doc && doc.querySelector(sel);
        if (el && el.tagName === 'CANVAS' && isVisible(el)) return el;
      } catch (_) {}
    }
    const list = visibleCanvases();
    return list.length === 1 ? list[0] : null;
  }

  // \u0648\u0636\u0639 \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631: \u0627\u0644\u0645\u0648\u0638\u0641 \u064a\u0636\u063a\u0637 \u0639\u0644\u0649 \u062e\u0627\u0646\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629
  function pickTarget() {
    return new Promise(resolve => {
      const banner = document.createElement('div');
      banner.id = UI_ID + '-pick';
      banner.textContent = '\u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u062e\u0627\u0646\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0641\u064a \u0627\u0644\u0625\u0642\u0631\u0627\u0631 (\u0623\u0648 Esc \u0644\u0644\u0625\u0644\u063a\u0627\u0621)';
      Object.assign(banner.style, {
        position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 2147483647,
        background: '#1a7f4b', color: '#fff', padding: '12px 20px', borderRadius: '10px',
        font: '16px system-ui, Tahoma, sans-serif', direction: 'rtl', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
      });
      document.body.appendChild(banner);
      const outlines = new Map();
      for (const c of visibleCanvases()) { outlines.set(c, c.style.outline); c.style.outline = '3px dashed #1a7f4b'; }

      const cleanup = () => {
        banner.remove();
        outlines.forEach((v, c) => c.style.outline = v);
        docs.forEach(d => { d.removeEventListener('click', onClick, true); d.removeEventListener('keydown', onKey, true); });
      };
      const onClick = (e) => {
        const el = e.target.closest ? (e.target.tagName === 'CANVAS' ? e.target : e.target.closest('canvas')) : null;
        e.preventDefault(); e.stopPropagation();
        if (!el) { banner.textContent = '\u0647\u0630\u0647 \u0644\u064a\u0633\u062a \u062e\u0627\u0646\u0629 \u062a\u0648\u0642\u064a\u0639 \u2014 \u0627\u0636\u063a\u0637 \u062f\u0627\u062e\u0644 \u0627\u0644\u0645\u0631\u0628\u0639 \u0627\u0644\u0645\u062d\u062f\u062f \u0628\u0627\u0644\u0623\u062e\u0636\u0631'; return; }
        cleanup();
        saveTarget(el);
        resolve(el);
      };
      const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
      const docs = allDocs();
      docs.forEach(d => { d.addEventListener('click', onClick, true); d.addEventListener('keydown', onKey, true); });
    });
  }

  // ---------- 2) \u0631\u0633\u0645 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u062f\u0627\u062e\u0644 \u0627\u0644\u062e\u0627\u0646\u0629 \u0628\u0645\u0627\u0648\u0633 \u0648\u0647\u0645\u064a ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function fire(target, kind, x, y, pressed) {
    const base = {
      bubbles: true, cancelable: true, composed: true,
      clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: pressed ? 1 : 0,
    };
    const pType = { down: 'pointerdown', move: 'pointermove', up: 'pointerup' }[kind];
    const mType = { down: 'mousedown', move: 'mousemove', up: 'mouseup' }[kind];
    if (typeof PointerEvent === 'function') {
      target.dispatchEvent(new PointerEvent(pType, Object.assign({
        pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: pressed ? 0.5 : 0,
      }, base)));
    }
    target.dispatchEvent(new MouseEvent(mType, base));
  }

  async function replay(canvas, strokes, onProgress) {
    canvas.scrollIntoView({ block: 'center', inline: 'center' });
    await sleep(150);
    const r = canvas.getBoundingClientRect();
    const minDist = Math.max(3, Math.hypot(r.width, r.height) / 150); // \u062a\u0642\u0644\u064a\u0644 \u0627\u0644\u0646\u0642\u0627\u0637 \u0645\u0639 \u0627\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0634\u0643\u0644
    const total = strokes.reduce((n, s) => n + s.length, 0);
    let done = 0;

    for (const s of strokes) {
      if (!s.length) continue;
      const pts = s.map(p => ({ x: r.left + p.x * r.width, y: r.top + p.y * r.height }));
      const kept = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const last = kept[kept.length - 1];
        if (Math.hypot(pts[i].x - last.x, pts[i].y - last.y) >= minDist || i === pts.length - 1) kept.push(pts[i]);
      }
      fire(canvas, 'down', kept[0].x, kept[0].y, true);
      await sleep(17);
      for (let i = 1; i < kept.length; i++) {
        fire(canvas, 'move', kept[i].x, kept[i].y, true);
        await sleep(17); // \u0628\u0639\u0636 \u0645\u0643\u062a\u0628\u0627\u062a \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u062a\u062a\u062c\u0627\u0647\u0644 \u0627\u0644\u062d\u0631\u0643\u0627\u062a \u0627\u0644\u0623\u0633\u0631\u0639 \u0645\u0646 16ms
      }
      if (kept.length === 1) { fire(canvas, 'move', kept[0].x + 0.5, kept[0].y, true); await sleep(17); }
      const last = kept[kept.length - 1];
      fire(canvas, 'up', last.x, last.y, false);
      await sleep(30);
      done += s.length;
      onProgress && onProgress(done / total);
    }
  }

  // ---------- 3) \u0646\u0627\u0641\u0630\u0629 \u0631\u0645\u0632 QR ----------
  let messageHandler = null;

  function closeUI() {
    const ui = document.getElementById(UI_ID);
    if (ui) ui.remove();
    if (messageHandler) { window.removeEventListener('message', messageHandler); messageHandler = null; }
  }

  function panel(html) {
    closeUI();
    const ui = document.createElement('div');
    ui.id = UI_ID;
    ui.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,25,35,.45);z-index:2147483646"></div>
      <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#fff;
        border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.3);width:440px;max-width:95vw;direction:rtl;
        font:15px system-ui,Tahoma,sans-serif;color:#1d2b36;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f3f5f7">
          <b>\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0631\u064a\u0636 \u0645\u0646 \u0627\u0644\u062c\u0648\u0627\u0644</b>
          <button data-act="close" style="border:0;background:none;font-size:22px;cursor:pointer;line-height:1">\u00d7</button>
        </div>
        <div data-body>${html}</div>
      </div>`;
    document.body.appendChild(ui);
    ui.querySelector('[data-act=close]').onclick = closeUI;
    return ui;
  }

  function toast(text, ms) {
    const t = document.createElement('div');
    t.textContent = text;
    Object.assign(t.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2147483647,
      background: '#1d2b36', color: '#fff', padding: '10px 18px', borderRadius: '10px',
      font: '15px system-ui, Tahoma, sans-serif', direction: 'rtl',
    });
    document.body.appendChild(t);
    if (ms) setTimeout(() => t.remove(), ms);
    return t;
  }

  function newCode() {
    const r = new Uint8Array(12); crypto.getRandomValues(r);
    return Array.from(r, b => b.toString(16).padStart(2, '0')).join('');
  }

  // \u0631\u0628\u0637 \u062c\u0648\u0627\u0644 \u0627\u0644\u0639\u064a\u0627\u062f\u0629: \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0641\u0642\u0637
  async function setupPhone() {
    const code = newCode();
    const ui = panel(`
      <iframe src="${SITE}/desk.html?setup=${code}" style="width:100%;height:440px;border:0;display:block"></iframe>
      <div style="padding:12px 14px;background:#f8fafb">
        <button data-act="paired" style="width:100%;padding:11px;border:0;border-radius:8px;background:#1a7f4b;color:#fff;font-size:16px;cursor:pointer">\u062a\u0645 \u0641\u062a\u062d \u0627\u0644\u0635\u0641\u062d\u0629 \u0639\u0644\u0649 \u0627\u0644\u062c\u0648\u0627\u0644 \u2713 \u0645\u062a\u0627\u0628\u0639\u0629</button>
      </div>`);
    ui.querySelector('[data-act=paired]').onclick = async () => { await store.set('pairCode', code); open(); };
  }

  async function open(opts) {
    opts = opts || {};
    closeUI();
    if (!SITE) { toast('\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u062f\u064a\u062f \u0631\u0627\u0628\u0637 \u0645\u0648\u0642\u0639 \u0627\u0644\u062a\u0648\u0642\u064a\u0639', 5000); return; }
    const pairCode = await store.get('pairCode');
    if (!pairCode && !opts.qr) return setupPhone();

    let canvas = await findTarget();
    if (!canvas) {
      if (!visibleCanvases().length) {
        const docs = allDocs();
        const count = q => docs.reduce((n, d) => n + d.querySelectorAll(q).length, 0);
        panel(`<div style="padding:18px;line-height:1.8">
          <b style="color:#b42318">\u0644\u0645 \u0623\u062c\u062f \u062e\u0627\u0646\u0629 \u062a\u0648\u0642\u064a\u0639 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629</b><br>
          \u062a\u0623\u0643\u062f \u0623\u0646 \u0627\u0644\u0625\u0642\u0631\u0627\u0631 \u0645\u0641\u062a\u0648\u062d \u0648\u062e\u0627\u0646\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0638\u0627\u0647\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u0627\u0634\u0629\u060c \u062b\u0645 \u0627\u0636\u063a\u0637 \u00ab\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0631\u064a\u0636\u00bb \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.<br>
          <span style="color:#7a8a97;font-size:13px">\u0631\u0645\u0632 \u0644\u0644\u062f\u0639\u0645: C${count('canvas')}-S${count('svg')}-F${docs.length - 1}-B${allDocs.blocked}-P${location.pathname.length}</span>
        </div>`);
        return;
      }
      canvas = await pickTarget();
      if (!canvas) return;
    }

    const r = canvas.getBoundingClientRect();
    const aspect = (r.width / r.height).toFixed(3);
    const mode = opts.qr ? '' : `&pair=${encodeURIComponent(pairCode)}`;
    const src = `${SITE}/desk.html?aspect=${aspect}&origin=${encodeURIComponent(location.origin)}${mode}`;
    const ui = panel(`
      <iframe src="${src}" style="width:100%;height:${opts.qr ? 440 : 360}px;border:0;display:block"></iframe>
      <div style="display:flex;justify-content:space-between;gap:8px;padding:8px 14px;font-size:13px;background:#f8fafb">
        <a href="#" data-act="repick" style="color:#5b6b78">\u062a\u063a\u064a\u064a\u0631 \u062e\u0627\u0646\u0629 \u0627\u0644\u062a\u0648\u0642\u064a\u0639</a>
        <a href="#" data-act="qr" style="color:#5b6b78">${opts.qr ? '' : '\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0628\u062c\u0648\u0627\u0644 \u0627\u0644\u0645\u0631\u064a\u0636 (QR)'}</a>
        <a href="#" data-act="repair" style="color:#5b6b78">\u0625\u0639\u0627\u062f\u0629 \u0631\u0628\u0637 \u062c\u0648\u0627\u0644 \u0627\u0644\u0639\u064a\u0627\u062f\u0629</a>
      </div>`);
    ui.querySelector('[data-act=repick]').onclick = async (e) => { e.preventDefault(); await store.del(TARGET_KEY); closeUI(); const c = await pickTarget(); if (c) open(opts); };
    ui.querySelector('[data-act=qr]').onclick = (e) => { e.preventDefault(); if (!opts.qr) open({ qr: true }); };
    ui.querySelector('[data-act=repair]').onclick = async (e) => { e.preventDefault(); await store.del('pairCode'); setupPhone(); };

    const siteOrigin = new URL(SITE).origin;
    messageHandler = async (e) => {
      if (e.origin !== siteOrigin || !e.data || e.data.source !== 'clinic-sign') return;
      if (e.data.type !== 'strokes' || !Array.isArray(e.data.strokes)) return;
      closeUI();
      const t = toast('\u062c\u0627\u0631\u064d \u0631\u0633\u0645 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0641\u064a \u0627\u0644\u0625\u0642\u0631\u0627\u0631\u2026 \u0644\u0627 \u062a\u062d\u0631\u0651\u0643 \u0627\u0644\u0645\u0627\u0648\u0633');
      try {
        await replay(canvas, e.data.strokes, p => t.textContent = `\u062c\u0627\u0631\u064d \u0631\u0633\u0645 \u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0641\u064a \u0627\u0644\u0625\u0642\u0631\u0627\u0631\u2026 ${Math.round(p * 100)}%`);
        t.remove();
        toast('\u2713 \u062a\u0645 \u0648\u0636\u0639 \u0627\u0644\u062a\u0648\u0642\u064a\u0639. \u0631\u0627\u062c\u0639\u0647 \u062b\u0645 \u0627\u062d\u0641\u0638 \u0627\u0644\u0625\u0642\u0631\u0627\u0631.', 4000);
      } catch (err) {
        t.remove();
        toast('\u062a\u0639\u0630\u0651\u0631 \u0631\u0633\u0645 \u0627\u0644\u062a\u0648\u0642\u064a\u0639: ' + err.message, 6000);
      }
    };
    window.addEventListener('message', messageHandler);
  }

  window.__clinicSign = { open, replay, findTarget };
  open();
})();
