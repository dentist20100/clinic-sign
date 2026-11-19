// يعمل داخل صفحة الإقرار عند الضغط على إشارة «توقيع المريض» في المتصفح
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

  // ---------- 1) تحديد خانة التوقيع ----------
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width >= 60 && r.height >= 30 && st.visibility !== 'hidden' && st.display !== 'none' && !el.closest('#' + UI_ID);
  }
  function visibleCanvases() { return [...document.querySelectorAll('canvas')].filter(isVisible); }

  function selectorFor(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let part = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      const sameTag = [...el.parentElement.children].filter(c => c.tagName === el.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  async function findTarget() {
    const saved = await store.get(TARGET_KEY);
    if (saved) {
      try {
        const el = document.querySelector(saved);
        if (el && el.tagName === 'CANVAS' && isVisible(el)) return el;
      } catch (_) {}
    }
    const list = visibleCanvases();
    return list.length === 1 ? list[0] : null;
  }

  // وضع الاختيار: الموظف يضغط على خانة التوقيع مرة واحدة
  function pickTarget() {
    return new Promise(resolve => {
      const banner = document.createElement('div');
      banner.id = UI_ID + '-pick';
      banner.textContent = 'اضغط على خانة التوقيع في الإقرار (أو Esc للإلغاء)';
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
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKey, true);
      };
      const onClick = (e) => {
        const el = e.target.closest ? (e.target.tagName === 'CANVAS' ? e.target : e.target.closest('canvas')) : null;
        e.preventDefault(); e.stopPropagation();
        if (!el) { banner.textContent = 'هذه ليست خانة توقيع — اضغط داخل المربع المحدد بالأخضر'; return; }
        cleanup();
        store.set(TARGET_KEY, selectorFor(el));
        resolve(el);
      };
      const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
    });
  }

  // ---------- 2) رسم التوقيع داخل الخانة بماوس وهمي ----------
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
    const minDist = Math.max(3, Math.hypot(r.width, r.height) / 150); // تقليل النقاط مع الحفاظ على الشكل
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
        await sleep(17); // بعض مكتبات التوقيع تتجاهل الحركات الأسرع من 16ms
      }
      if (kept.length === 1) { fire(canvas, 'move', kept[0].x + 0.5, kept[0].y, true); await sleep(17); }
      const last = kept[kept.length - 1];
      fire(canvas, 'up', last.x, last.y, false);
      await sleep(30);
      done += s.length;
      onProgress && onProgress(done / total);
    }
  }

  // ---------- 3) نافذة رمز QR ----------
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
          <b>توقيع المريض من الجوال</b>
          <button data-act="close" style="border:0;background:none;font-size:22px;cursor:pointer;line-height:1">×</button>
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

  // ربط جوال العيادة: مرة واحدة فقط
  async function setupPhone() {
    const code = newCode();
    const ui = panel(`
      <iframe src="${SITE}/desk.html?setup=${code}" style="width:100%;height:440px;border:0;display:block"></iframe>
      <div style="padding:12px 14px;background:#f8fafb">
        <button data-act="paired" style="width:100%;padding:11px;border:0;border-radius:8px;background:#1a7f4b;color:#fff;font-size:16px;cursor:pointer">تم فتح الصفحة على الجوال ✓ متابعة</button>
      </div>`);
    ui.querySelector('[data-act=paired]').onclick = async () => { await store.set('pairCode', code); open(); };
  }

  async function open(opts) {
    opts = opts || {};
    closeUI();
    if (!SITE) { toast('تعذّر تحديد رابط موقع التوقيع', 5000); return; }
    const pairCode = await store.get('pairCode');
    if (!pairCode && !opts.qr) return setupPhone();

    let canvas = await findTarget();
    if (!canvas) {
      if (!visibleCanvases().length) {
        toast('لم أجد خانة توقيع في هذه الصفحة. افتح الإقرار أولاً ثم اضغط «توقيع المريض».', 5000);
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
        <a href="#" data-act="repick" style="color:#5b6b78">تغيير خانة التوقيع</a>
        <a href="#" data-act="qr" style="color:#5b6b78">${opts.qr ? '' : 'التوقيع بجوال المريض (QR)'}</a>
        <a href="#" data-act="repair" style="color:#5b6b78">إعادة ربط جوال العيادة</a>
      </div>`);
    ui.querySelector('[data-act=repick]').onclick = async (e) => { e.preventDefault(); await store.del(TARGET_KEY); closeUI(); const c = await pickTarget(); if (c) open(opts); };
    ui.querySelector('[data-act=qr]').onclick = (e) => { e.preventDefault(); if (!opts.qr) open({ qr: true }); };
    ui.querySelector('[data-act=repair]').onclick = async (e) => { e.preventDefault(); await store.del('pairCode'); setupPhone(); };

    const siteOrigin = new URL(SITE).origin;
    messageHandler = async (e) => {
      if (e.origin !== siteOrigin || !e.data || e.data.source !== 'clinic-sign') return;
      if (e.data.type !== 'strokes' || !Array.isArray(e.data.strokes)) return;
      closeUI();
      const t = toast('جارٍ رسم التوقيع في الإقرار… لا تحرّك الماوس');
      try {
        await replay(canvas, e.data.strokes, p => t.textContent = `جارٍ رسم التوقيع في الإقرار… ${Math.round(p * 100)}%`);
        t.remove();
        toast('✓ تم وضع التوقيع. راجعه ثم احفظ الإقرار.', 4000);
      } catch (err) {
        t.remove();
        toast('تعذّر رسم التوقيع: ' + err.message, 6000);
      }
    };
    window.addEventListener('message', messageHandler);
  }

  window.__clinicSign = { open, replay, findTarget };
  open();
})();
