import React, { useEffect, useRef } from 'react';

/**
 * VortexBackground
 * Canvas recreation of the Qronos hero animation: helical white streamlines
 * spiralling through a trumpet-shaped funnel into a flat disc of rings.
 * 3D-projected (tilted camera + perspective), additive blending for the soft
 * glow, slight mouse parallax. Pauses when the tab is hidden and respects
 * prefers-reduced-motion. Fixed behind your content (pointer-events: none).
 *
 * Usage: <VortexBackground />
 */

function startVortex(canvas, opts) {
  opts = opts || {};
  const ctx = canvas.getContext('2d');
  const reduceMotion = !!opts.reduceMotion;
  const LINES = opts.lines || 900;
  const RINGS = opts.rings || 420;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(11);
  const R = (a, b) => a + rnd() * (b - a);

  // ---- world constants (in reference pixels @ 1518x784) ----
  const H = 700;      // funnel height above disc
  const NECK = 82;    // neck radius
  const D = 3000;     // camera distance (perspective)
  const TILT = 0.1;  // camera tilt (radians) - looking slightly down

  const radius = (h) => {
    const q = h / H;
    return NECK * (1 + 0.4 * q) + 470 * Math.pow(q, 3.1) + 250 * Math.exp(-h / 15);
  };

  // helical streamlines wrapped on the funnel surface
  const lines = Array.from({ length: LINES }, () => {
    const us = rnd() < 0.55 ? R(0, 0.25) : R(0, 0.6);
    return {
      th0: R(0, Math.PI * 2),
      dir: rnd() < 0.72 ? 1 : -1,          // most swirl one way, some cross (mesh at the neck)
      k: R(5, 12),
      us,
      ue: rnd() < 0.55 ? R(Math.max(us + 0.3, 0.72), 0.93) : R(0.96, 1.1),
      om: R(0.7, 1.3),
      a: R(0.2, 0.8),
      thick: rnd() < 0.22,
      rr: R(0.94, 1.06),
    };
  });

  // disc rings (arcs of circles in the h=0 plane), geometric spacing
  const rMin = NECK * 0.45, rMax = 1900;
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const f = i / (RINGS - 1);
    const r = rMin * Math.pow(rMax / rMin, f);
    const n = rnd() < 0.4 ? 1 : 3;
    for (let j = 0; j < n; j++) {
      rings.push({
        r: r * R(0.99, 1.01),
        th0: R(0, Math.PI * 2),
        len: R(0.6, 3.6),
        om: (1 / Math.sqrt(r / NECK)) * R(0.8, 1.2),
        a: R(0.25, 0.8) * (1 - 0.45 * f),
      });
    }
  }

  const dust = Array.from({ length: 170 }, () => ({
    q: R(0.02, 1.05),
    th0: R(0, 6.283),
    dir: rnd() < 0.5 ? -1 : 1,
    om: R(0.6, 1.4),
    off: R(0.9, 1.15),
    size: R(0.6, 1.7),
    a: R(0.3, 0.95),
  }));

  let w = 0, h = 0, dpr = 1, s = 1, raf = 0, t = opts.t0 || 0, last = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s = Math.max(0.45, Math.min(h / 784, w / 700, 1.6));
  }
  function onMove(e) {
    mouse.tx = (e.clientX / w - 0.5) * 2;
    mouse.ty = (e.clientY / h - 0.5) * 2;
  }

  let cosF = Math.cos(TILT), sinF = Math.sin(TILT), cx = 0, baseY = 0;
  function proj(X, Y, Z, out) {
    const up = Y * cosF + Z * sinF;
    const depth = -Y * sinF + Z * cosF;
    const p = D / (D + depth);
    out[0] = cx + X * p * s;
    out[1] = baseY - up * p * s;
    return p;
  }

  const P = [0, 0];
  const A_BUCKETS = 4;

  function frame(now) {
    const dt = Math.min(now - last, 50); last = now;
    if (!reduceMotion) t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    const F = TILT + mouse.y * 0.02;
    cosF = Math.cos(F); sinF = Math.sin(F);
    cx = w * 0.507 + mouse.x * 18;
    baseY = h * 0.83;

    const time = t * 0.00022;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';

    // ---------- funnel: 2 widths x 4 brightness buckets ----------
    const paths = [];
    for (let i = 0; i < 2 * A_BUCKETS; i++) paths.push(new Path2D());

    for (let li = 0; li < lines.length; li++) {
      const L = lines[li];
      const steps = 46;
      let prevB = -1, px = 0, py = 0;
      for (let i = 0; i <= steps; i++) {
        const u = L.us + (L.ue - L.us) * (i / steps);
        const hh = H * Math.pow(u, 1.5);
        const q = hh / H;
        const th = L.th0 + L.dir * L.k * Math.pow(q, 1.0) + time * L.om * (1.15 - 0.6 * q);
        const r = radius(hh) * L.rr;
        const X = r * Math.cos(th), Z = r * Math.sin(th);
        proj(X, hh, Z, P);
        // near side (Z<0 -> toward camera) brighter
        const front = 0.5 - 0.5 * (Z / r);
        const f = (0.3 + 0.7 * front) * L.a;
        const b = Math.min(A_BUCKETS - 1, Math.floor(f * A_BUCKETS * 1.15));
        const path = paths[(L.thick ? A_BUCKETS : 0) + b];
        if (i === 0 || b !== prevB) {
          if (i > 0) { path.moveTo(px, py); path.lineTo(P[0], P[1]); }
          else path.moveTo(P[0], P[1]);
        } else {
          path.lineTo(P[0], P[1]);
        }
        prevB = b; px = P[0]; py = P[1];
      }
    }
    for (let i = 0; i < paths.length; i++) {
      const b = i % A_BUCKETS, thick = i >= A_BUCKETS;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.04 + b * 0.058).toFixed(3) + ')';
      ctx.lineWidth = (thick ? 1.0 : 0.55) * Math.max(s, 0.7);
      ctx.stroke(paths[i]);
    }

    // ---------- disc rings ----------
    const dp = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < rings.length; i++) {
      const Rg = rings[i];
      const a0 = Rg.th0 + time * Rg.om * 2.2;
      const n = Math.max(10, Math.min(80, Math.ceil(Rg.len * Math.sqrt(Rg.r) * 0.9)));
      const bi = Rg.a > 0.45 ? 2 : Rg.a > 0.28 ? 1 : 0;
      const path = dp[bi];
      for (let k = 0; k <= n; k++) {
        const th = a0 + Rg.len * (k / n);
        proj(Rg.r * Math.cos(th), 0, Rg.r * Math.sin(th), P);
        k === 0 ? path.moveTo(P[0], P[1]) : path.lineTo(P[0], P[1]);
      }
    }
    const da = [0.07, 0.12, 0.2];
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + da[i] + ')';
      ctx.lineWidth = 0.6 * Math.max(s, 0.7);
      ctx.stroke(dp[i]);
    }

    // ---------- dust ----------
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i];
      ctx.globalCompositeOperation = 'source-over';
      const hh = H * d.q;
      const th = d.th0 + time * d.om * d.dir * 1.1 + 3 * d.q;
      const r = radius(hh) * d.off;
      proj(r * Math.cos(th), hh, r * Math.sin(th), P);
      ctx.fillStyle = 'rgba(255,255,255,' + d.a + ')';
      const sz = d.size * Math.max(s, 0.7);
      ctx.fillRect(P[0], P[1], sz, sz);
    }

    raf = requestAnimationFrame(frame);
  }

  function onVis() {
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onMove);
  document.addEventListener('visibilitychange', onVis);
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMove);
    document.removeEventListener('visibilitychange', onVis);
  };
}

const VortexBackground = ({ className = '' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.innerWidth < 768;
    // fewer lines on phones to keep 60fps
    const stop = startVortex(canvas, {
      reduceMotion,
      lines: small ? 450 : 900,
      rings: small ? 220 : 420,
    });
    return stop;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 h-full w-full pointer-events-none z-0 ${className}`}
    />
  );
};

export default VortexBackground;