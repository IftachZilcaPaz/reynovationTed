/* Intro engine: image treatments, the chosen combo, sound and sequencing.
   Shared by intro-options.html and prompter.html. Exposes window.IntroEngine. */
window.IntroEngine = (() => {
  'use strict';

  // ---------- constants & tiny helpers ----------
  const W = 960, H = 540, FPS = 24;
  const SEQ_DEFAULT = { cut: 9, end: 11, marks: [[0, 'חושך'], [1.5, 'התמונה עולה'], [9, 'חיתוך לשחור'], [11, 'עלייה לבמה']] };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const HEB = '"IBM Plex Sans Hebrew", "Heebo", sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const setDir = (x, d) => { if ('direction' in x) x.direction = d; };

  function rr(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  // ---------- source image + derived layers ----------
  let S = null; // the source set the current draw call reads from

  function makeSourceSet(paint) {
    const S = {};
    const base = mk(W, H), bx = base.getContext('2d', { willReadFrequently: true });
    bx.fillStyle = '#000'; bx.fillRect(0, 0, W, H);
    paint(bx);
    const d = bx.getImageData(0, 0, W, H).data;
    const layer = (fn) => {
      const c = mk(W, H), cx = c.getContext('2d'), o = cx.createImageData(W, H), od = o.data;
      for (let i = 0; i < d.length; i += 4) { fn(d, od, i); od[i + 3] = 255; }
      cx.putImageData(o, 0, 0);
      return c;
    };
    S.base = base;
    S.r = layer((s, o, i) => { o[i] = s[i]; });
    S.g = layer((s, o, i) => { o[i + 1] = s[i + 1]; });
    S.b = layer((s, o, i) => { o[i + 2] = s[i + 2]; });
    S.gray = layer((s, o, i) => { o[i] = o[i + 1] = o[i + 2] = 0.3 * s[i] + 0.59 * s[i + 1] + 0.11 * s[i + 2]; });
    return S;
  }

  const PHOTOS = [
    { id: 'p1', label: 'תמונה 1', url: 'assets/oct7-1.jpg' },
    { id: 'p2', label: 'תמונה 2', url: 'assets/oct7-2.jpg' },
    { id: 'p3', label: 'תמונה 3', url: 'assets/oct7-3.jpg' },
    { id: 'p4', label: 'תמונה 4', url: 'assets/oct7-4.jpg' },
  ];

  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });

  function coverDraw(x, img) {
    const s = Math.max(W / img.width, H / img.height);
    const dw = img.width * s, dh = img.height * s;
    x.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  // Placeholder: a drawn safe room — steel door, blast shutter leaking light, phone glowing on the floor.
  function drawPlaceholder(x) {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a3d40'); g.addColorStop(.72, '#2a2c2e');
    g.addColorStop(.72, '#1d1e1f'); g.addColorStop(1, '#121313');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    for (let i = 0; i < 9000; i++) {
      const v = rand(20, 80) | 0;
      x.fillStyle = `rgba(${v},${v},${v + 4},${rand(.18)})`;
      x.fillRect(rand(W), rand(H * .72), rand(1, 4), rand(1, 4));
    }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2;
    for (let y = 125; y < 390; y += 130) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }

    // steel door
    x.fillStyle = '#25282b'; x.fillRect(70, 60, 200, 330);
    x.strokeStyle = '#141619'; x.lineWidth = 6; x.strokeRect(70, 60, 200, 330);
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 2; x.strokeRect(92, 82, 156, 286);
    x.fillStyle = '#0e0f11'; x.fillRect(220, 212, 36, 10);
    x.beginPath(); x.arc(228, 217, 11, 0, Math.PI * 2); x.fill();

    // blast shutter
    const wx = 610, wy = 90, ww = 250, wh = 230;
    x.fillStyle = '#161719'; x.fillRect(wx - 14, wy - 14, ww + 28, wh + 28);
    x.fillStyle = '#2e3134'; x.fillRect(wx, wy, ww, wh);
    for (let y = wy + 12; y < wy + wh; y += 16) { x.fillStyle = '#222427'; x.fillRect(wx, y, ww, 3); }
    x.save(); x.globalCompositeOperation = 'lighter';
    [wy + 60, wy + 124, wy + 172].forEach((sy, i) => {
      x.fillStyle = 'rgba(255,214,150,.85)'; x.fillRect(wx + 10, sy, ww - 20, 2);
      const bg = x.createLinearGradient(wx + ww / 2, sy, wx - 260, sy + 300);
      bg.addColorStop(0, 'rgba(255,200,130,.2)'); bg.addColorStop(1, 'rgba(255,200,130,0)');
      x.fillStyle = bg; x.beginPath();
      x.moveTo(wx + ww - 10, sy); x.lineTo(wx + 10, sy);
      x.lineTo(wx - 380, sy + 300 + i * 20); x.lineTo(wx + ww - 200, sy + 320 + i * 20);
      x.closePath(); x.fill();
    });
    x.restore();

    // phone on the floor
    x.save(); x.translate(470, 462); x.rotate(-.18);
    const glow = x.createRadialGradient(0, 0, 10, 0, 0, 200);
    glow.addColorStop(0, 'rgba(255,80,60,.38)'); glow.addColorStop(1, 'rgba(255,80,60,0)');
    x.fillStyle = glow; x.fillRect(-210, -210, 420, 420);
    x.fillStyle = '#0b0b0c'; rr(x, -38, -70, 76, 140, 10); x.fill();
    x.fillStyle = '#d9dde1'; rr(x, -33, -64, 66, 128, 6); x.fill();
    x.fillStyle = '#d8322a'; rr(x, -29, -56, 58, 26, 4); x.fill();
    x.fillStyle = '#fff'; x.font = `600 11px ${HEB}`; x.textAlign = 'center'; setDir(x, 'rtl');
    x.fillText('צבע אדום', 0, -39);
    x.fillStyle = 'rgba(0,0,0,.3)';
    for (let k = 0; k < 3; k++) x.fillRect(-26, -20 + k * 14, 52, 6);
    x.restore();

    const v = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
  }

  // ---------- shared overlays (built once) ----------
  const NOISE = Array.from({ length: 4 }, () => {
    const c = mk(480, 270), cx = c.getContext('2d'), o = cx.createImageData(480, 270), d = o.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = rand(255) | 0; d[i + 3] = 255; }
    cx.putImageData(o, 0, 0);
    return c;
  });
  const SCAN = (() => {
    const c = mk(W, H), cx = c.getContext('2d');
    cx.fillStyle = 'rgba(0,0,0,.55)';
    for (let y = 0; y < H; y += 3) cx.fillRect(0, y, W, 1);
    return c;
  })();
  const VIG = (() => {
    const c = mk(W, H), cx = c.getContext('2d');
    const g = cx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.85)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    return c;
  })();

  const noiseTile = () => NOISE[(Math.random() * NOISE.length) | 0];

  function grain(x, w, h, a, mode = 'overlay') {
    x.save(); x.globalCompositeOperation = mode; x.globalAlpha = clamp(a, 0, 1);
    x.drawImage(noiseTile(), -rand(24), -rand(24), w + 24, h + 24);
    x.restore();
  }
  function scan(x, w, h, a) { x.save(); x.globalAlpha = a; x.drawImage(SCAN, 0, 0, w, h); x.restore(); }
  function vignette(x, w, h, a) { x.save(); x.globalAlpha = clamp(a, 0, 1); x.drawImage(VIG, 0, 0, w, h); x.restore(); }

  // Copy a horizontal band of the source to the same band on screen, shifted by `shift` px.
  function slice(x, img, y, hh, shift, w, h) {
    x.drawImage(img, 0, y * H / h, W, hh * H / h, shift, y, w, hh);
  }
  function rgbSplit(x, w, h, dx, dy = 0) {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter';
    x.drawImage(S.r, dx, dy, w, h);
    x.drawImage(S.g, 0, 0, w, h);
    x.drawImage(S.b, -dx, -dy, w, h);
    x.globalCompositeOperation = 'source-over';
  }

  // Glitch the frame already on screen (image + overlays together), not just the source photo.
  const BUFS = new Map();
  function buf(w, h, id) {
    const key = `${id}:${w}x${h}`;
    if (!BUFS.has(key)) { const c = mk(w, h); BUFS.set(key, { c, x: c.getContext('2d') }); }
    return BUFS.get(key);
  }
  function snapshot(x, w, h) {
    const B = buf(w, h, 'a');
    B.x.globalCompositeOperation = 'copy'; B.x.drawImage(x.canvas, 0, 0);
    B.x.globalCompositeOperation = 'source-over';
    return B.c;
  }
  function frameSplit(x, w, h, dx) {
    const src = snapshot(x, w, h), T = buf(w, h, 'b');
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    [['#ff0000', dx], ['#00ff00', 0], ['#0000ff', -dx]].forEach(([col, off]) => {
      T.x.globalCompositeOperation = 'copy'; T.x.drawImage(src, 0, 0);
      T.x.globalCompositeOperation = 'multiply'; T.x.fillStyle = col; T.x.fillRect(0, 0, w, h);
      T.x.globalCompositeOperation = 'source-over';
      x.globalCompositeOperation = 'lighter'; x.drawImage(T.c, off, 0);
    });
    x.globalCompositeOperation = 'source-over';
  }
  function frameTears(x, w, h, n, amp) {
    const src = snapshot(x, w, h), s = w / 960;
    for (let i = 0; i < n; i++) {
      const y = rand(h), hh = rand(2, 40) * s;
      x.drawImage(src, 0, y, w, hh, rand(-amp, amp), y, w, hh);
    }
  }
  function filmDamage(x, w, h, k) {
    x.strokeStyle = 'rgba(230,225,210,.35)'; x.lineWidth = 1;
    for (let i = 0, n = (Math.random() * 3 * k) | 0; i < n; i++) {
      const sx = rand(w); x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + rand(-3, 3), h); x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,.55)';
    for (let i = 0; i < 4 * k; i++) { x.beginPath(); x.arc(rand(w), rand(h), rand(.5, 2.2) * w / 960, 0, 7); x.fill(); }
  }

  // Stack of red-alert notifications, newest on top; the newest slides in over `since` seconds.
  function drawAlerts(x, w, h, n, since) {
    const s = w / 960;
    const cw = Math.min(w - 40 * s, 540 * s), ch = 80 * s, gap = 10 * s, cx = (w - cw) / 2;
    x.save(); setDir(x, 'rtl');
    for (let i = Math.max(0, n - 8); i < n; i++) {
      const age = n - 1 - i, y0 = 22 * s + age * (ch + gap);
      if (y0 > h) continue;
      const a = i === n - 1 ? clamp(since / .12, 0, 1) : 1;
      const y = y0 - (1 - a) * 30 * s;
      x.globalAlpha = a;
      x.fillStyle = 'rgba(30,30,32,.9)'; rr(x, cx, y, cw, ch, 16 * s); x.fill();
      x.fillStyle = '#e2362c'; rr(x, cx + cw - 60 * s, y + 18 * s, 44 * s, 44 * s, 10 * s); x.fill();
      x.fillStyle = '#fff'; x.textAlign = 'center';
      x.font = `600 ${Math.round(26 * s)}px ${HEB}`; x.fillText('!', cx + cw - 38 * s, y + 49 * s);
      x.textAlign = 'right';
      x.font = `600 ${Math.round(22 * s)}px ${HEB}`; x.fillText('צבע אדום · שדרות', cx + cw - 76 * s, y + 35 * s);
      x.fillStyle = 'rgba(255,255,255,.7)';
      x.font = `400 ${Math.round(17 * s)}px ${HEB}`; x.fillText('היכנסו למרחב המוגן', cx + cw - 76 * s, y + 61 * s);
      x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,.5)';
      x.font = `400 ${Math.round(15 * s)}px ${HEB}`; x.fillText('עכשיו', cx + 18 * s, y + 33 * s);
    }
    x.restore();
  }

  // ---------- sound (Web Audio, synthesized; starts only from a click) ----------
  let AC = null;
  const audio = { master: null };
  function stopAudio() {
    if (!audio.master) return;
    try { audio.master.gain.cancelScheduledValues(0); audio.master.gain.value = 0; audio.master.disconnect(); } catch (_) { /* already stopped */ }
    audio.master = null;
  }
  // Suspending the context freezes the audio clock, so scheduled sounds stay in sync with a paused picture.
  function pauseAudio() { if (AC && AC.state === 'running') AC.suspend(); }
  function resumeAudio() { if (AC && AC.state === 'suspended') AC.resume(); }
  function startAudio(fx, offset, k = 1) {
    stopAudio();
    if (!fx.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      AC.resume();
      const master = AC.createGain(); master.gain.value = .8; master.connect(AC.destination);
      audio.master = master;
      fx.sound(AC, master, AC.currentTime + offset, k);
    } catch (_) { /* audio unavailable: play silently */ }
  }
  let NOISE_BUF = null;
  function noiseBuffer(ac) {
    if (NOISE_BUF) return NOISE_BUF;
    const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (NOISE_BUF = b);
  }
  function ping(ac, out, at, vol) {
    [[1318.5, 1], [1975.5, .45]].forEach(([f, v], i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = at + i * .07;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + .006);
      g.gain.exponentialRampToValueAtTime(.0001, t + .45);
      o.connect(g).connect(out); o.start(t); o.stop(t + .5);
    });
  }
  function crackle(ac, out, at, dur, vol) {
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuffer(ac); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = .7;
    g.gain.setValueAtTime(0, at);
    for (let t = 0; t < dur; t += .016) g.gain.setValueAtTime(Math.random() < .6 ? vol * Math.random() : 0, at + t);
    g.gain.setValueAtTime(0, at + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(at, rand(.5)); src.stop(at + dur + .02);
  }
  function drone(ac, out, from, peakAt, cutAt) {
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(49, from); o.frequency.linearRampToValueAtTime(58, peakAt);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(140, from); lp.frequency.linearRampToValueAtTime(420, peakAt);
    g.gain.setValueAtTime(0, from); g.gain.linearRampToValueAtTime(.09, peakAt); g.gain.setValueAtTime(0, cutAt);
    o.connect(lp).connect(g).connect(out); o.start(from); o.stop(cutAt + .05);
  }

  // Combo timeline (seconds from the moment the image appears): quiet memory, sparse alerts, flood, collapse.
  const CT = { first: 14, collapse: 55.4, black: 56, loop: 58, blackHold: 30 };

  // Arrival times accelerate: each gap is ~87% of the previous, down to a 0.14s machine-gun floor.
  function arrivals(k) {
    const out = [], speed = .6 + .4 * k;
    for (let tm = CT.first, gap = 5; tm < CT.collapse - .2; tm += Math.max(.14, gap) / speed, gap *= .87) out.push(tm);
    return out;
  }

  // ו + ב + א: alerts stack over a flickering memory; every arrival tears the frame, harder each time.
  const COMBO = {
    key: 'combo', tag: 'ו+ב+א', name: 'מבול התראות בזיכרון שנשבר',
    seq: {
      cut: 1.5 + CT.black, end: 1.5 + CT.black + CT.blackHold,
      marks: [[0, 'חושך, התמונה עולה'], [1.5 + CT.first, 'התראה ראשונה'], [1.5 + CT.collapse, 'קריסה ושחור'], [1.5 + CT.black + CT.blackHold, 'עלייה לבמה']],
    },
    css: () => 'contrast(1.08)',
    draw(x, w, h, t, k) {
      const s = w / 960, u = t % CT.loop, arr = arrivals(k);
      const p = clamp((u - CT.first) / (CT.collapse - CT.first), 0, 1);
      if (u >= CT.black) { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); return; }
      let n = 0; while (n < arr.length && arr[n] <= u) n++;
      const since = n ? u - arr[n - 1] : Infinity;

      const jump = Math.random() < .05 * k ? rand(-1, 1) * h * .025 : 0;
      x.save(); x.translate(0, jump);
      x.fillStyle = '#000'; x.fillRect(0, -h, w, h * 3);
      const z = 1.03 + u * .0025, dw = w * z, dh = h * z, ox = (w - dw) / 2, oy = (h - dh) / 2;
      x.drawImage(S.base, ox, oy, dw, dh);
      x.globalAlpha = .6; x.drawImage(S.gray, ox, oy, dw, dh); x.globalAlpha = 1;
      x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgb(255,232,205)'; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
      x.fillStyle = `rgba(0,0,0,${.12 + .26 * p})`; x.fillRect(0, 0, w, h);
      drawAlerts(x, w, h, n, since);
      x.restore();

      const b = .12 * Math.sin(t * 21) * Math.sin(t * 5.3) + rand(-.1, .1) * k;
      x.fillStyle = b < 0 ? `rgba(0,0,0,${clamp(-b * 1.6, 0, 1)})` : `rgba(255,240,220,${clamp(b * .5, 0, 1)})`;
      x.fillRect(0, 0, w, h);
      if (Math.random() < .02 * k) { x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(0, 0, w, h); }

      const late = u > CT.collapse;
      const gdur = .08 + .17 * p;
      if ((n && since < gdur) || late || (p > .5 && Math.random() < .06 * k * p)) {
        const amp = late ? 3 : .5 + 1.7 * p;
        frameSplit(x, w, h, rand(6, 14) * amp * s * k);
        frameTears(x, w, h, (2 + amp * 4) | 0, 50 * amp * s * k);
        if (amp > 1.2) {
          x.globalCompositeOperation = 'difference';
          for (let i = 0; i < amp * k; i++) {
            x.fillStyle = Math.random() < .5 ? '#00e5ff' : '#ff2bd6';
            x.fillRect(rand(w), rand(h), rand(20, 180) * s, rand(4, 22) * s);
          }
          x.globalCompositeOperation = 'source-over';
        }
        if (late && Math.random() < .35) { x.fillStyle = `rgba(0,0,0,${rand(.4, .9)})`; x.fillRect(0, 0, w, h); }
      }

      grain(x, w, h, .34 * k);
      filmDamage(x, w, h, k);
      scan(x, w, h, .12);
      vignette(x, w, h, 1);
    },
    sound(ac, out, t0, k) {
      const arr = arrivals(k);
      drone(ac, out, t0, t0 + CT.collapse, t0 + CT.black);
      arr.forEach((a) => {
        const p = clamp((a - CT.first) / (CT.collapse - CT.first), 0, 1);
        ping(ac, out, t0 + a, .16);
        crackle(ac, out, t0 + a, .08 + .17 * p, .05 + .15 * p);
      });
      crackle(ac, out, t0 + CT.collapse, CT.black - CT.collapse, .28);
    },
  };

  // ---------- the six treatments ----------
  const FX = [
    {
      key: 'flicker', tag: 'א', name: 'זיכרון מהבהב',
      what: 'האור מרצד, גרעיניות של פילם, שריטות וקפיצות קטנות בפריים. הזיכרון עצמו לא יציב.',
      feel: 'אינטימי ושקט. הכי קרוב ל״פליקר״ שתיארת.',
      how: 'Exposure מהבהב, Film Grain ו-Vignette. ב-CapCut: Old Film או Flicker.',
      css: () => 'sepia(.35) saturate(.7) contrast(1.15)',
      draw(x, w, h, t, k) {
        x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
        const jump = Math.random() < .05 * k ? (Math.random() - .5) * h * .05 : 0;
        const b = .8 + .12 * Math.sin(t * 21) * Math.sin(t * 5.3) + (Math.random() - .5) * .24 * k;
        x.globalAlpha = clamp(b, .35, 1);
        const z = 1.03;
        x.drawImage(S.base, -w * (z - 1) / 2, jump - h * (z - 1) / 2, w * z, h * z);
        x.globalAlpha = 1;
        if (Math.random() < .025 * k) { x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(0, 0, w, h); }
        if (Math.random() < .02 * k) { x.fillStyle = 'rgba(255,240,220,.22)'; x.fillRect(0, 0, w, h); }
        grain(x, w, h, .38 * k);
        filmDamage(x, w, h, k);
        vignette(x, w, h, 1);
      },
    },
    {
      key: 'glitch', tag: 'ב', name: 'גליץ׳ דיגיטלי',
      what: 'ערוצי הצבע נפרדים, רצועות של התמונה נקרעות הצידה, ובלוקים של צבע מתפרצים בפרצים.',
      feel: 'חרדה ובלבול, משהו שנשבר. הכי אגרסיבי.',
      how: 'RGB Split ו-Slice/Displacement Glitch. ב-CapCut: Glitch או RGB Split.',
      css: () => 'contrast(1.1)',
      draw(x, w, h, t, k) {
        const s = w / 960;
        const burst = (Math.sin(t * 1.3) + Math.sin(t * 2.9 + 1)) > 1.25 || Math.random() < .04 * k;
        rgbSplit(x, w, h, (burst ? rand(14, 30) : 2) * k * s, burst ? rand(-3, 3) * s : 0);
        if (burst) {
          for (let i = 0, n = (4 + rand(10 * k)) | 0; i < n; i++) {
            slice(x, S.base, rand(h), rand(2, 42) * s, rand(-60, 60) * k * s, w, h);
          }
          x.globalCompositeOperation = 'difference';
          for (let i = 0; i < 3 * k; i++) {
            x.fillStyle = Math.random() < .5 ? '#00e5ff' : '#ff2bd6';
            x.fillRect(rand(w), rand(h), rand(20, 180) * s, rand(4, 22) * s);
          }
          x.globalCompositeOperation = 'source-over';
        }
        if (Math.random() < .08 * k) {
          const y = rand(h) | 0;
          x.drawImage(x.canvas, 0, y, w, 1, 0, y, w, rand(10, 70) * s);
        }
        scan(x, w, h, .35);
      },
    },
    {
      key: 'vhs', tag: 'ג', name: 'קלטת VHS',
      what: 'קו מעקב שזז לאורך התמונה, רעש, שוליים צבעוניים וכיתוב PLAY עם תאריך.',
      feel: 'תיעודי. ״זה באמת קרה״. פחות פסיכודלי, יותר מסמך.',
      how: 'אפקט VHS מוכן (CapCut, Premiere) וכיתוב OSD בפינה.',
      css: () => 'saturate(1.35) contrast(1.08) brightness(1.05)',
      draw(x, w, h, t, k) {
        const s = w / 960;
        rgbSplit(x, w, h, 3 * s * k);
        x.globalAlpha = .15; x.drawImage(S.base, 6 * s, 0, w, h); x.globalAlpha = 1;

        const by = ((t * .18) % 1.3 - .15) * h, bh = 40 * s;
        for (let y = by; y < by + bh; y += 3 * s) slice(x, S.base, y, 3 * s, rand(-12, 28) * k * s, w, h);
        x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = .45 * k;
        x.drawImage(noiseTile(), 0, rand(200), 480, 40, 0, by, w, bh); x.restore();
        for (let y = h - 14 * s; y < h; y += 2 * s) slice(x, S.base, y, 2 * s, rand(10, 40) * s, w, h);

        scan(x, w, h, .28);
        grain(x, w, h, .1, 'screen');

        x.save();
        setDir(x, 'ltr'); x.textAlign = 'left';
        x.font = `500 ${Math.round(26 * s)}px ${MONO}`;
        x.fillStyle = '#f4f4f4'; x.shadowColor = 'rgba(0,0,0,.85)'; x.shadowOffsetX = x.shadowOffsetY = 2 * s;
        if (t % 1.2 < .75) x.fillText('PLAY ▶', 40 * s, 56 * s);
        const sec = Math.floor(t) % 3600;
        x.fillText(`SP  0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`, 40 * s, h - 80 * s);
        x.fillText('OCT. 07 2023', 40 * s, h - 44 * s);
        x.restore();
      },
    },
    {
      key: 'psy', tag: 'ד', name: 'גל פסיכודלי',
      what: 'התמונה מתעוותת בגלים, הצבעים מסתובבים על כל הגלגל ומשאירים שובלים.',
      feel: 'חלום, ניתוק, זמן שמתנהג לא נורמלי. הכי חריג מהשש.',
      how: 'Wave Warp, Echo לשובלים ו-Hue/Saturation מונפש.',
      css: (t, k) => `hue-rotate(${Math.round((t * 70 * k) % 360)}deg) saturate(${(1.6 + .8 * k).toFixed(2)}) contrast(1.15)`,
      draw(x, w, h, t, k) {
        const s = w / 960, strip = Math.max(2, 4 * s), zoom = 1.06 + .04 * Math.sin(t * .9);
        x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, w, h);
        x.globalAlpha = .55;
        const dw = w * zoom;
        for (let y = 0; y < h; y += strip) {
          const off = (Math.sin(y / h * 9 + t * 2.4) * 26 + Math.sin(y / h * 23 - t * 3.7) * 8) * k * s;
          const sy = ((y - h / 2) / zoom + h / 2) * H / h;
          x.drawImage(S.base, 0, sy, W, strip / zoom * H / h, off - (dw - w) / 2, y, dw, strip);
        }
        x.globalAlpha = 1;
        x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = .16 + .12 * Math.sin(t * 1.3);
        x.translate(w, 0); x.scale(-1, 1); x.drawImage(S.r, 0, 0, w, h); x.restore();
        vignette(x, w, h, .6);
      },
    },
    {
      key: 'pulse', tag: 'ה', name: 'צבע אדום',
      what: 'התמונה בשחור-לבן, שכבה אדומה פועמת בקצב של דופק, והמצלמה מתקרבת לאט.',
      feel: 'מתח גופני, הלב של מי שיושב בממ״ד. מינימליסטי וחזק.',
      how: 'שחור-לבן, שכבת אדום ב-Multiply שפועמת, וזום איטי.',
      css: () => 'none',
      draw(x, w, h, t, k) {
        const ph = (t % 1.15) / 1.15;
        const beat = Math.exp(-(((ph - .04) / .045) ** 2)) + .65 * Math.exp(-(((ph - .22) / .05) ** 2));
        const z = 1.02 + ((t % 12) / 12) * .12 + beat * .008 * k;
        const dw = w * z, dh = h * z;
        x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
        x.drawImage(S.gray, (w - dw) / 2, (h - dh) / 2, dw, dh);
        x.globalCompositeOperation = 'multiply';
        const gb = Math.round(clamp(60 - 45 * beat * k, 0, 255));
        x.fillStyle = `rgb(255,${gb},${gb})`; x.globalAlpha = clamp(.55 + .4 * beat * k, 0, 1);
        x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'screen'; x.globalAlpha = clamp(.14 * beat * k, 0, 1);
        x.fillStyle = '#ff3b2f'; x.fillRect(0, 0, w, h);
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        vignette(x, w, h, .8 + .3 * beat);
        grain(x, w, h, .16);
      },
    },
    {
      key: 'alerts', tag: 'ו', name: 'מבול התראות',
      what: 'התראות ״צבע אדום · שדרות״ נערמות על התמונה, מהר ויותר מהר, עם גליץ׳ קצר בכל אחת.',
      feel: 'הצפה. מה שכל מי שהיה שם זוכר מהטלפון. מיידי לקהל ישראלי.',
      how: 'כרטיסי התראה כגרפיקה, אנימציית כניסה, וגליץ׳ קצר בכל כניסה.',
      css: () => 'none',
      draw(x, w, h, t, k) {
        const s = w / 960, loop = 9, u = t % loop, start = .6;
        const interval = .55 / (.6 + .4 * k);
        const n = u < start ? 0 : Math.floor((u - start) / interval) + 1;
        const since = u - start - (n - 1) * interval;
        if (n > 0 && since < .09) rgbSplit(x, w, h, 12 * s * k); else x.drawImage(S.base, 0, 0, w, h);
        x.fillStyle = `rgba(0,0,0,${.22 + Math.min(n, 12) * .035})`; x.fillRect(0, 0, w, h);
        drawAlerts(x, w, h, n, since);
        if (u > loop - 1.2) { x.fillStyle = `rgba(0,0,0,${(u - (loop - 1.2)) / 1.2})`; x.fillRect(0, 0, w, h); }
      },
    },
  ];

  function caption(x, w, h) {
    const s = w / 960, txt = 'שדרות · 07.10', px = w - 48 * s, py = h - 48 * s;
    const j = Math.random() < .15 ? rand(-5, 5) * s : 0;
    x.save(); setDir(x, 'rtl'); x.textAlign = 'right';
    x.font = `700 ${Math.round(96 * s)}px Karantina, ${HEB}`;
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = 'rgba(255,40,40,.75)'; x.fillText(txt, px + j + 3 * s, py);
    x.fillStyle = 'rgba(40,200,255,.75)'; x.fillText(txt, px - j - 3 * s, py);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#f2efe9'; x.fillText(txt, px, py);
    x.restore();
  }

  // ---------- public rendering API ----------
  function renderFrame(canvas, fx, t, set, { k = 1, caption: withCaption = false } = {}) {
    S = set;
    const x = canvas.getContext('2d');
    fx.draw(x, canvas.width, canvas.height, t, k);
    if (withCaption) caption(x, canvas.width, canvas.height);
    canvas.style.filter = fx.css(t, k);
  }

  // tt = seconds since the sequence started: 1.5s black, fade in, the effect, then black from `cut` on.
  function renderSequenceFrame(canvas, fx, tt, set, opts) {
    const x = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const cut = (fx.seq || SEQ_DEFAULT).cut;
    if (tt < 1.5 || tt > cut) { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); canvas.style.filter = 'none'; return; }
    renderFrame(canvas, fx, tt - 1.5, set, opts);
    if (tt < 3) { x.fillStyle = `rgba(0,0,0,${1 - (tt - 1.5) / 1.5})`; x.fillRect(0, 0, w, h); }
  }

  async function fontsReady() {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`600 22px ${HEB}`),
          document.fonts.load('700 96px Karantina'),
          document.fonts.load(`500 26px ${MONO}`),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (_) { /* fall back to system fonts */ }
  }

  // Each photo becomes a source set; a photo that fails to load falls back to the drawn placeholder.
  const loadPhotos = () => Promise.all(PHOTOS.map((ph) => loadImage(ph.url).then(
    (img) => ({ ...ph, set: makeSourceSet((x) => coverDraw(x, img)) }),
    () => ({ ...ph, label: `${ph.label} (לא נטענה)`, set: makeSourceSet(drawPlaceholder) }),
  )));

  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60), r = sec - m * 60, frac = Math.round((r % 1) * 10);
    return `${m}:${String(Math.floor(r)).padStart(2, '0')}${frac ? '.' + frac : ''}`;
  };

  return {
    FPS, SEQ_DEFAULT, CT, FX, COMBO, clamp,
    makeSourceSet, coverDraw, loadImage, loadPhotos, fontsReady, fmtTime,
    renderFrame, renderSequenceFrame, startAudio, stopAudio, pauseAudio, resumeAudio,
  };
})();
