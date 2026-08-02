/* ==========================================================================
   LUKE MORRISON — PORTFOLIO ENGINE
   Vanilla JS. Custom canvas 3D wireframe + point-cloud model viewers,
   oscilloscope, grid pulses, scroll reveals, tilt. No dependencies.
   ========================================================================== */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Accent colors come from the active theme's CSS variables, so every
  // canvas effect retints automatically on themed pages.
  const bodyStyle = getComputedStyle(document.body);
  const cssVar = (name, fallback) => (bodyStyle.getPropertyValue(name) || fallback).trim();
  const ACC1_RGB = cssVar("--acc1-rgb", "0, 255, 102");
  const ACC2_RGB = cssVar("--acc2-rgb", "182, 255, 69");
  const ACC1_HEX = cssVar("--acc1", "#00ff66");
  const PIN_RGB = "150, 200, 170"; // muted metallic for chip pins

  /* ---------------- Navbar ---------------- */
  const navbar = document.getElementById("navbar");
  if (navbar) {
    const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const navToggle = document.getElementById("nav-toggle");
  const navLinks = document.getElementById("nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    navLinks.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------------- Scroll spy ---------------- */
  const spyLinks = document.querySelectorAll(".nav-link[data-spy]");
  if (spyLinks.length) {
    const map = {};
    spyLinks.forEach((l) => (map[l.dataset.spy] = l));
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            spyLinks.forEach((l) => l.classList.remove("active"));
            if (map[e.target.id]) map[e.target.id].classList.add("active");
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && !reducedMotion && "IntersectionObserver" in window) {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const delay = (e.target.dataset.rvOrder || 0) * 70;
            setTimeout(() => e.target.classList.add("in"), delay);
            ro.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    const groups = new Map();
    reveals.forEach((el) => {
      const p = el.parentElement;
      const n = groups.get(p) || 0;
      el.dataset.rvOrder = n;
      groups.set(p, n + 1);
      ro.observe(el);
    });
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---------------- PCB trace dividers ---------------- */
  const traces = document.querySelectorAll(".trace-divider");
  if (traces.length && "IntersectionObserver" in window) {
    const to = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("drawn");
            to.unobserve(e.target);
          }
        }),
      { threshold: 0.4 }
    );
    traces.forEach((t) => to.observe(t));
  }

  /* ---------------- Typed hero kicker ---------------- */
  const typed = document.getElementById("typed");
  if (typed) {
    const text = typed.dataset.text || "";
    if (reducedMotion) {
      typed.textContent = text;
    } else {
      let i = 0;
      const tick = () => {
        typed.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(tick, 26 + Math.random() * 40);
      };
      setTimeout(tick, 400);
    }
  }

  /* ---------------- Copy email ---------------- */
  const copyBtn = document.getElementById("copy-email");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("koly1999@gmail.com");
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied ✓";
        setTimeout(() => (copyBtn.textContent = old), 1800);
      } catch {
        location.href = "mailto:koly1999@gmail.com";
      }
    });
  }

  /* ---------------- Project card glow + tilt ---------------- */
  if (finePointer && !reducedMotion) {
    document.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("pointermove", (ev) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${ev.clientX - r.left}px`);
        card.style.setProperty("--my", `${ev.clientY - r.top}px`);
      });
    });
  }

  /* ==========================================================================
     Canvas helpers
     ========================================================================== */
  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  function runWhenVisible(canvas, draw) {
    let visible = false;
    let raf = 0;
    const loop = (t) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible && !document.hidden ? start() : stop();
    }).observe(canvas);
    document.addEventListener("visibilitychange", () => {
      visible && !document.hidden ? start() : stop();
    });
  }

  // Shared drag-to-rotate + auto-spin state machine for 3D canvases
  function makeOrbit(canvas, opts = {}) {
    const o = {
      yaw: opts.yaw ?? 0.7,
      pitch: opts.pitch ?? 0.42,
      basePitch: opts.pitch ?? 0.42,
      vyaw: 0, vpitch: 0,
      dragging: false, autoSpin: true,
      _lx: 0, _ly: 0, _t: 0,
    };
    canvas.addEventListener("pointerdown", (e) => {
      o.dragging = true; o.autoSpin = false;
      o._lx = e.clientX; o._ly = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!o.dragging) return;
      const dx = e.clientX - o._lx, dy = e.clientY - o._ly;
      o._lx = e.clientX; o._ly = e.clientY;
      o.vyaw = dx * 0.005; o.vpitch = dy * 0.004;
      o.yaw += o.vyaw;
      o.pitch = Math.max(-1.2, Math.min(1.35, o.pitch + o.vpitch));
    });
    const end = () => {
      o.dragging = false;
      clearTimeout(o._t);
      o._t = setTimeout(() => (o.autoSpin = true), 3500);
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    o.step = (dt) => {
      if (o.dragging) return;
      if (o.autoSpin) {
        o.yaw += (opts.spinSpeed ?? 0.25) * dt;
        o.pitch += (o.basePitch - o.pitch) * 0.02;
      } else {
        o.yaw += o.vyaw;
        o.pitch = Math.max(-1.2, Math.min(1.35, o.pitch + o.vpitch));
        o.vyaw *= 0.94; o.vpitch *= 0.94;
      }
    };
    return o;
  }

  /* ==========================================================================
     Ambient background — signal pulses traveling the grid
     ========================================================================== */
  const bg = document.getElementById("bg-canvas");
  if (bg && !reducedMotion) {
    const ctx = bg.getContext("2d");
    const GRID = 56;
    let pulses = [];

    const spawn = (w, h) => ({
      horiz: Math.random() < 0.5,
      line: Math.floor((Math.random() * (Math.random() < 0.5 ? w : h)) / GRID) * GRID,
      pos: -100,
      speed: 60 + Math.random() * 120,
      len: 70 + Math.random() * 120,
      hue: Math.random() < 0.75 ? ACC1_RGB : ACC2_RGB,
      alpha: 0.10 + Math.random() * 0.14,
    });

    let last = 0;
    const draw = (t) => {
      const { w, h } = fitCanvas(bg);
      const dt = Math.min(0.05, (t - last) / 1000) || 0.016;
      last = t;
      ctx.clearRect(0, 0, w, h);

      while (pulses.length < 7) pulses.push(spawn(w, h));

      pulses.forEach((p) => {
        p.pos += p.speed * dt;
        const max = (p.horiz ? w : h) + p.len + 120;
        if (p.pos > max) Object.assign(p, spawn(w, h), { pos: -p.len });

        const grad = p.horiz
          ? ctx.createLinearGradient(p.pos - p.len, 0, p.pos, 0)
          : ctx.createLinearGradient(0, p.pos - p.len, 0, p.pos);
        grad.addColorStop(0, `rgba(${p.hue}, 0)`);
        grad.addColorStop(1, `rgba(${p.hue}, ${p.alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (p.horiz) {
          ctx.moveTo(p.pos - p.len, p.line);
          ctx.lineTo(p.pos, p.line);
        } else {
          ctx.moveTo(p.line, p.pos - p.len);
          ctx.lineTo(p.line, p.pos);
        }
        ctx.stroke();

        ctx.fillStyle = `rgba(${p.hue}, ${Math.min(0.5, p.alpha * 2.6)})`;
        ctx.beginPath();
        const hx = p.horiz ? p.pos : p.line;
        const hy = p.horiz ? p.line : p.pos;
        ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    runWhenVisible(bg, draw);
  }

  /* ==========================================================================
     HERO — 3D wireframe microchip
     ========================================================================== */
  const chipCanvas = document.getElementById("chip-canvas");
  if (chipCanvas) {
    const ctx = chipCanvas.getContext("2d");

    const segments = [];
    const pads = [];
    const seg = (a, b, kind) => segments.push({ a, b, kind });

    const W = 60, H = 9, D = 60;

    const c = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) c.push([sx * W, sy * H, sz * D]);
    const idx = (sx, sy, sz) => ((sx + 1) / 2) * 4 + ((sy + 1) / 2) * 2 + (sz + 1) / 2;
    const edge = (p, q) => seg(c[p], c[q], "body");
    edge(idx(-1,-1,-1), idx(1,-1,-1)); edge(idx(-1,1,-1), idx(1,1,-1));
    edge(idx(-1,-1,1), idx(1,-1,1));   edge(idx(-1,1,1), idx(1,1,1));
    edge(idx(-1,-1,-1), idx(-1,1,-1)); edge(idx(1,-1,-1), idx(1,1,-1));
    edge(idx(-1,-1,1), idx(-1,1,1));   edge(idx(1,-1,1), idx(1,1,1));
    edge(idx(-1,-1,-1), idx(-1,-1,1)); edge(idx(1,-1,-1), idx(1,-1,1));
    edge(idx(-1,1,-1), idx(-1,1,1));   edge(idx(1,1,-1), idx(1,1,1));

    const DY = H + 0.6, DS = 26;
    seg([-DS, DY, -DS], [DS, DY, -DS], "die");
    seg([DS, DY, -DS], [DS, DY, DS], "die");
    seg([DS, DY, DS], [-DS, DY, DS], "die");
    seg([-DS, DY, DS], [-DS, DY, -DS], "die");
    const DS2 = 15;
    seg([-DS2, DY, -DS2], [DS2, DY, -DS2], "die2");
    seg([DS2, DY, -DS2], [DS2, DY, DS2], "die2");
    seg([DS2, DY, DS2], [-DS2, DY, DS2], "die2");
    seg([-DS2, DY, DS2], [-DS2, DY, -DS2], "die2");
    const M = 20, MR = 3.2, steps = 10;
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * Math.PI * 2, a2 = ((i + 1) / steps) * Math.PI * 2;
      seg([-M + Math.cos(a1) * MR, DY, -M + Math.sin(a1) * MR],
          [-M + Math.cos(a2) * MR, DY, -M + Math.sin(a2) * MR], "die2");
    }

    for (const k of [-34, 0, 34]) {
      seg([DS, DY, k * 0.6], [W - 3, DY, k * 0.6], "trace");
      seg([-DS, DY, k * 0.6], [-(W - 3), DY, k * 0.6], "trace");
      seg([k * 0.6, DY, DS], [k * 0.6, DY, D - 3], "trace");
      seg([k * 0.6, DY, -DS], [k * 0.6, DY, -(D - 3)], "trace");
    }

    const PIN_Y = -2, TIP_Y = -H - 3, OUT1 = 14, OUT2 = 7;
    for (let i = 0; i < 7; i++) {
      const p = -45 + i * 15;
      seg([W, PIN_Y, p], [W + OUT1, PIN_Y, p], "pin");
      seg([W + OUT1, PIN_Y, p], [W + OUT1 + OUT2, TIP_Y, p], "pin");
      pads.push([W + OUT1 + OUT2, TIP_Y, p]);
      seg([-W, PIN_Y, p], [-W - OUT1, PIN_Y, p], "pin");
      seg([-W - OUT1, PIN_Y, p], [-W - OUT1 - OUT2, TIP_Y, p], "pin");
      pads.push([-W - OUT1 - OUT2, TIP_Y, p]);
      seg([p, PIN_Y, D], [p, PIN_Y, D + OUT1], "pin");
      seg([p, PIN_Y, D + OUT1], [p, TIP_Y, D + OUT1 + OUT2], "pin");
      pads.push([p, TIP_Y, D + OUT1 + OUT2]);
      seg([p, PIN_Y, -D], [p, PIN_Y, -D - OUT1], "pin");
      seg([p, PIN_Y, -D - OUT1], [p, TIP_Y, -D - OUT1 - OUT2], "pin");
      pads.push([p, TIP_Y, -D - OUT1 - OUT2]);
    }

    const orbits = [
      { r: 118, tilt: 0.5, speed: 0.9, phase: 0 },
      { r: 132, tilt: -0.35, speed: -0.6, phase: 2.1 },
      { r: 104, tilt: 0.15, speed: 1.3, phase: 4.2 },
    ];

    const orbit = makeOrbit(chipCanvas);

    const COLORS = {
      body:  (a) => `rgba(${ACC1_RGB}, ${0.55 * a})`,
      die:   (a) => `rgba(${ACC2_RGB}, ${0.75 * a})`,
      die2:  (a) => `rgba(${ACC2_RGB}, ${0.4 * a})`,
      trace: (a) => `rgba(${ACC1_RGB}, ${0.28 * a})`,
      pin:   (a) => `rgba(${PIN_RGB}, ${0.5 * a})`,
    };
    const F = 460;

    const project = (p, sy, cy, sp, cp, scale, cx2, cy2) => {
      const x1 = p[0] * cy + p[2] * sy;
      const z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cp - z1 * sp;
      const z2 = p[1] * sp + z1 * cp;
      const s = F / (F - z2 * 0.9);
      return [cx2 + x1 * s * scale, cy2 - y2 * s * scale, z2, s];
    };

    let lastT = 0;
    const drawChip = (t) => {
      const { w, h } = fitCanvas(chipCanvas);
      const dt = Math.min(0.05, (t - lastT) / 1000) || 0.016;
      lastT = t;
      ctx.clearRect(0, 0, w, h);

      orbit.step(dt);

      const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
      const sp = Math.sin(orbit.pitch), cp = Math.cos(orbit.pitch);
      const scale = Math.min(w, h) / 340;
      const cx2 = w / 2, cy2 = h / 2;

      const drawn = segments.map((s) => {
        const a = project(s.a, sy, cy, sp, cp, scale, cx2, cy2);
        const b = project(s.b, sy, cy, sp, cp, scale, cx2, cy2);
        return { a, b, kind: s.kind, z: (a[2] + b[2]) / 2 };
      });
      drawn.sort((p, q) => p.z - q.z);

      ctx.lineWidth = 1.4;
      for (const s of drawn) {
        const fog = 0.45 + 0.55 * ((s.z + 160) / 320);
        ctx.strokeStyle = COLORS[s.kind](Math.max(0.15, Math.min(1, fog)));
        ctx.beginPath();
        ctx.moveTo(s.a[0], s.a[1]);
        ctx.lineTo(s.b[0], s.b[1]);
        ctx.stroke();
      }

      for (const p of pads) {
        const q = project(p, sy, cy, sp, cp, scale, cx2, cy2);
        const fog = 0.45 + 0.55 * ((q[2] + 160) / 320);
        ctx.fillStyle = `rgba(${ACC2_RGB}, ${0.5 * fog})`;
        ctx.beginPath();
        ctx.arc(q[0], q[1], 1.7 * q[3], 0, Math.PI * 2);
        ctx.fill();
      }

      const core = project([0, DY, 0], sy, cy, sp, cp, scale, cx2, cy2);
      const pulse = 0.5 + 0.5 * Math.sin(t / 700);
      const g = ctx.createRadialGradient(core[0], core[1], 0, core[0], core[1], 34 * scale);
      g.addColorStop(0, `rgba(${ACC2_RGB}, ${0.16 + pulse * 0.12})`);
      g.addColorStop(1, `rgba(${ACC2_RGB}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(core[0], core[1], 34 * scale, 0, Math.PI * 2);
      ctx.fill();

      for (const o of orbits) {
        const ang = (reducedMotion ? 0 : t / 1000) * o.speed + o.phase;
        ctx.strokeStyle = `rgba(${ACC1_RGB}, 0.07)`;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a2 = (i / 40) * Math.PI * 2;
          const px = Math.cos(a2) * o.r;
          const pz = Math.sin(a2) * o.r;
          const py = Math.sin(a2 + o.tilt) * 16;
          const q = project([px, py, pz], sy, cy, sp, cp, scale, cx2, cy2);
          i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]);
        }
        ctx.closePath();
        ctx.stroke();

        const ex = Math.cos(ang) * o.r;
        const ez = Math.sin(ang) * o.r;
        const ey = Math.sin(ang + o.tilt) * 16;
        const e = project([ex, ey, ez], sy, cy, sp, cp, scale, cx2, cy2);
        ctx.save();
        ctx.shadowColor = ACC1_HEX;
        ctx.shadowBlur = 9;
        ctx.fillStyle = `rgba(${ACC1_RGB}, 0.9)`;
        ctx.beginPath();
        ctx.arc(e[0], e[1], 2.4 * e[3], 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    if (reducedMotion) {
      requestAnimationFrame((t) => drawChip(t));
      window.addEventListener("resize", () => requestAnimationFrame((t) => drawChip(t)));
    } else {
      runWhenVisible(chipCanvas, drawChip);
    }
  }

  /* ==========================================================================
     3D MODEL VIEWERS — point clouds from CAD exports (media/models/*.bin)
     Binary format: Float32 x,y,z triplets, model normalized to ~[-1,1].
     ========================================================================== */
  document.querySelectorAll("canvas.model-canvas[data-model]").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    let pts = null;      // Float32Array
    let failed = false;
    const orbit = makeOrbit(canvas, { yaw: 0.6, pitch: 0.5, spinSpeed: 0.3 });
    const F = 3.2;

    // Never leave a broken viewer: on any load failure, swap in the
    // pre-rendered static image next to the canvas.
    const stage = canvas.closest(".model-stage") || canvas.parentElement;
    const fallbackImg = stage ? stage.querySelector(".model-fallback") : null;
    const hintEl = stage ? stage.querySelector(".model-hint") : null;
    const fail = () => {
      failed = true;
      canvas.hidden = true;
      if (fallbackImg) fallbackImg.hidden = false;
      if (hintEl) hintEl.textContent = "INTERACTIVE MODEL UNAVAILABLE · STATIC RENDER";
      if (stage) stage.classList.add("model-failed");
    };

    const load = async () => {
      try {
        const res = await fetch(canvas.dataset.model);
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        if (!buf.byteLength || buf.byteLength % 12 !== 0) throw new Error("bad model data");
        pts = new Float32Array(buf);
      } catch {
        fail();
      }
    };

    let lastT = 0;
    const draw = (t) => {
      if (failed) return;
      const { w, h } = fitCanvas(canvas);
      const dt = Math.min(0.05, (t - lastT) / 1000) || 0.016;
      lastT = t;
      ctx.clearRect(0, 0, w, h);

      if (!pts) {
        ctx.fillStyle = `rgba(${ACC1_RGB}, 0.6)`;
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("LOADING POINT CLOUD…", w / 2, h / 2);
        return;
      }

      orbit.step(dt);
      const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
      const sp = Math.sin(orbit.pitch), cp = Math.cos(orbit.pitch);
      const scale = Math.min(w, h) * 0.62;
      const cx2 = w / 2, cy2 = h / 2;

      for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i], y = pts[i + 1], z = pts[i + 2];
        // yaw around Y, pitch around X
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const s = F / (F - z2);
        const px = cx2 + x1 * s * scale * 0.55;
        const py = cy2 - y2 * s * scale * 0.55;
        // depth cue: nearer points brighter & slightly larger
        const fog = Math.max(0.08, Math.min(0.85, 0.42 + z2 * 0.45));
        ctx.fillStyle = (i % 21 === 0)
          ? `rgba(${ACC2_RGB}, ${fog})`
          : `rgba(${ACC1_RGB}, ${fog})`;
        const size = s > 1.05 ? 1.7 : 1.2;
        ctx.fillRect(px, py, size, size);
      }
    };

    // Lazy: fetch the model only when the canvas first scrolls into view
    let started = false;
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting && !started) {
        started = true;
        load();
        obs.disconnect();
      }
    }, { rootMargin: "200px" }).observe(canvas);

    if (reducedMotion) {
      // Static frame once loaded, re-render on resize only
      const renderOnce = () => requestAnimationFrame((t) => draw(t));
      const poll = setInterval(() => { if (pts || failed) { renderOnce(); clearInterval(poll); } }, 300);
      window.addEventListener("resize", renderOnce);
      canvas.addEventListener("pointermove", () => { if (orbit.dragging) renderOnce(); });
    } else {
      runWhenVisible(canvas, draw);
    }
  });

  /* ==========================================================================
     MEDIEVAL PAGE — projectiles arc across the page as you scroll
     ========================================================================== */
  if (document.body.classList.contains("brand-medieval") && !reducedMotion) {
    const layer = document.createElement("div");
    layer.className = "flight-layer";
    layer.setAttribute("aria-hidden", "true");
    const rocks = [];
    for (let i = 0; i < 3; i++) {
      const r = document.createElement("span");
      r.className = "projectile";
      layer.appendChild(r);
      rocks.push(r);
    }
    document.body.appendChild(layer);
    let ticking = false;
    const fly = () => {
      ticking = false;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const p = window.scrollY / max;
      rocks.forEach((r, i) => {
        const t = (p * 1.6 + i * 0.34) % 1;
        const x = (t * 116 - 8) * innerWidth / 100;
        const arc = Math.sin(Math.PI * t);
        const y = (24 + i * 24 - arc * 17) * innerHeight / 100;
        const s = 0.7 + arc * 0.6 + i * 0.15;
        r.style.transform = `translate(${x}px, ${y}px) rotate(${t * 720}deg) scale(${s})`;
      });
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(fly); }
    }, { passive: true });
    fly();
  }
  /* ==========================================================================
     SLICER PAGE — print-progress bar tied to scroll position
     ========================================================================== */
  if (document.body.classList.contains("pg-phone")) {
    const bar = document.createElement("div");
    bar.className = "print-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = '<span>PRINTING: PHONE_HOLDER.GCODE</span><span class="pp-bar"><span class="pp-fill"></span></span><span class="pp-num">0% · L000/212</span>';
    document.body.appendChild(bar);
    const fill = bar.querySelector(".pp-fill");
    const num = bar.querySelector(".pp-num");
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const pct = Math.min(100, Math.round((window.scrollY / max) * 100));
      fill.style.width = pct + "%";
      num.textContent = pct + "% · L" + String(Math.round(pct * 2.12)).padStart(3, "0") + "/212";
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
  /* ==========================================================================
     CARD MODELS — one wireframe 3D object per project card.
     Same projection engine as the hero chip; shapes are the subjects.
     ========================================================================== */
  const cardShapes = (() => {
    // Each builder returns { segs: [[a,b,kind],...], dots: [[x,y,z],...], extra? }
    // kind: 0 = primary line, 1 = bright accent, 2 = dim structure
    const make = () => ({ segs: [], dots: [] });
    const L = (s, a, b, k = 0) => s.segs.push([a, b, k]);
    const box = (s, cx, cy, cz, w, h, d, k = 0) => {
      const x = w / 2, y = h / 2, z = d / 2;
      const c = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
        c.push([cx + sx * x, cy + sy * y, cz + sz * z]);
      const E = [[0,1],[0,2],[1,3],[2,3],[4,5],[4,6],[5,7],[6,7],[0,4],[1,5],[2,6],[3,7]];
      E.forEach(([i, j]) => L(s, c[i], c[j], k));
    };
    // ring in a plane: axis 'y' (XZ plane), 'x' (YZ), 'z' (XY)
    const ring = (s, cx, cy, cz, r, n, axis = "y", k = 0, span = 1) => {
      let prev = null;
      const steps = Math.round(n * span);
      for (let i = 0; i <= steps; i++) {
        const a = (i / n) * Math.PI * 2;
        const u = Math.cos(a) * r, v = Math.sin(a) * r;
        const p = axis === "y" ? [cx + u, cy, cz + v] : axis === "x" ? [cx, cy + u, cz + v] : [cx + u, cy + v, cz];
        if (prev) L(s, prev, p, k);
        prev = p;
      }
    };

    return {
      board() { // first PCB
        const s = make();
        box(s, 0, 0, 0, 130, 8, 86);
        box(s, -25, 9, -14, 30, 10, 22);
        box(s, 27, 8, 18, 22, 8, 16, 2);
        L(s, [-60, 4.5, 28], [-20, 4.5, 28], 2); L(s, [-20, 4.5, 28], [-20, 4.5, 6], 2);
        L(s, [58, 4.5, -28], [40, 4.5, -28], 2); L(s, [40, 4.5, -28], [40, 4.5, -8], 2);
        for (const z of [-30, -10, 10, 30]) s.dots.push([-62, 5, z], [62, 5, z]);
        return s;
      },
      car() {
        const s = make();
        box(s, 0, 18, 0, 116, 14, 52);
        box(s, -8, 32, 0, 46, 14, 44, 2);
        for (const x of [-36, 36]) for (const z of [-30, 30]) ring(s, x, 12, z, 13, 12, "z", 1);
        L(s, [-36, 12, -30], [-36, 12, 30], 2); L(s, [36, 12, -30], [36, 12, 30], 2);
        s.dots.push([58, 20, -16], [58, 20, 16]);
        return s;
      },
      guard() { // gimbal protector: guard ring + stick
        const s = make();
        ring(s, 0, -12, 0, 46, 16, "y");
        ring(s, 0, 14, 0, 46, 16, "y");
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          L(s, [Math.cos(a) * 46, -12, Math.sin(a) * 46], [Math.cos(a) * 46, 14, Math.sin(a) * 46], 2);
        }
        ring(s, 0, -18, 0, 62, 16, "y", 2);
        L(s, [0, 14, 0], [0, 52, 0], 1);
        s.dots.push([0, 56, 0]);
        return s;
      },
      phone() {
        const s = make();
        box(s, 0, 22, 0, 56, 88, 10);
        const z = 5.5;
        L(s, [-22, 58, z], [22, 58, z], 2); L(s, [22, 58, z], [22, -8, z], 2);
        L(s, [22, -8, z], [-22, -8, z], 2); L(s, [-22, -8, z], [-22, 58, z], 2);
        L(s, [0, -22, 0], [0, -32, 0], 1);
        ring(s, 0, -44, 0, 13, 12, "x", 1); ring(s, 0, -44, 0, 13, 12, "z", 1);
        s.dots.push([0, -44, 0]);
        return s;
      },
      web() { // this website
        const s = make();
        const rect = (zz, k) => {
          L(s, [-64, 42, zz], [64, 42, zz], k); L(s, [64, 42, zz], [64, -44, zz], k);
          L(s, [64, -44, zz], [-64, -44, zz], k); L(s, [-64, -44, zz], [-64, 42, zz], k);
        };
        rect(8, 0); rect(-8, 2);
        for (const [x, y] of [[-64, 42], [64, 42], [64, -44], [-64, -44]]) L(s, [x, y, 8], [x, y, -8], 2);
        L(s, [-64, 28, 8], [64, 28, 8]);
        s.dots.push([-54, 35, 8], [-45, 35, 8], [-36, 35, 8]);
        L(s, [-52, 12, 8], [8, 12, 8], 1); L(s, [-52, -2, 8], [30, -2, 8], 2);
        L(s, [-40, -16, 8], [20, -16, 8], 2); L(s, [-52, -30, 8], [-8, -30, 8], 1);
        return s;
      },
      theremin() {
        const s = make();
        box(s, 0, -22, 0, 96, 14, 42);
        L(s, [40, -15, 0], [40, 56, 0], 1);
        s.dots.push([40, 60, 0]);
        ring(s, -38, -6, 0, 15, 12, "x", 1);
        for (const r of [14, 24, 34]) ring(s, 40, 20, 0, r, 16, "z", 2, 0.45);
        return s;
      },
      treb() {
        const s = make();
        for (const z of [-16, 16]) {
          L(s, [-30, -30, z], [0, 34, z]); L(s, [30, -30, z], [0, 34, z]);
          L(s, [-30, -30, z], [30, -30, z], 2);
        }
        L(s, [0, 34, -16], [0, 34, 16], 2);
        L(s, [-38, 8, 0], [0, 34, 0], 1); L(s, [0, 34, 0], [46, 66, 0], 1);
        box(s, -42, 0, 0, 18, 18, 14, 2);
        L(s, [46, 66, 0], [55, 44, 0], 2);
        s.dots.push([56, 41, 0]);
        return s;
      },
      flask() { // hydrogen jar
        const s = make();
        ring(s, 0, -38, 0, 36, 14, "y");
        ring(s, 0, 18, 0, 36, 14, "y");
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          L(s, [Math.cos(a) * 36, -38, Math.sin(a) * 36], [Math.cos(a) * 36, 18, Math.sin(a) * 36], 2);
        }
        ring(s, 0, 32, 0, 18, 12, "y", 2);
        ring(s, 0, 48, 0, 18, 12, "y");
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          L(s, [Math.cos(a) * 18, 32, Math.sin(a) * 18], [Math.cos(a) * 18, 48, Math.sin(a) * 18], 2);
        }
        ring(s, 0, 4, 0, 34, 14, "y", 1);
        s.bubbles = [[-12, 0.0, 8], [10, 0.45, -6], [0, 0.75, 14]];
        return s;
      },
      mot() { // microwave transformer + arc
        const s = make();
        box(s, 0, -14, 0, 76, 58, 26);
        for (const y of [-32, -23, -14, -5]) ring(s, 0, y, 0, 27, 12, "y", 1);
        L(s, [-14, 15, 0], [-23, 52, 0]); L(s, [14, 15, 0], [23, 47, 0]);
        s.arc = [[-23, 52, 0], [-11, 45, 0], [1, 53, 0], [12, 44, 0], [23, 47, 0]];
        return s;
      },
      book() { // manifesto booklet
        const s = make();
        const pg = (dir) => {
          const c = [[0, 6, -42], [0, 6, 42], [dir * 58, -18, 46], [dir * 58, -18, -46]];
          L(s, c[0], c[1]); L(s, c[1], c[2]); L(s, c[2], c[3]); L(s, c[3], c[0]);
          for (const f of [0.35, 0.6, 0.85])
            L(s, [dir * 58 * f, 6 - 24 * f, -42 - 4 * f + 8], [dir * 58 * f, 6 - 24 * f, 42 + 4 * f - 8], 2);
        };
        pg(-1); pg(1);
        L(s, [0, 6, -42], [0, 6, 42], 1);
        return s;
      },
      poster() {
        const s = make();
        const rect = (dx, zz, k) => {
          L(s, [dx - 31, 44, zz], [dx + 31, 44, zz], k); L(s, [dx + 31, 44, zz], [dx + 31, -44, zz], k);
          L(s, [dx + 31, -44, zz], [dx - 31, -44, zz], k); L(s, [dx - 31, -44, zz], [dx - 31, 44, zz], k);
        };
        rect(16, -24, 2); rect(0, 0, 1); rect(-16, 24, 0);
        L(s, [-40, 20, 24], [0, 20, 24]); L(s, [-40, 4, 24], [-16, 4, 24], 2);
        s.dots.push([-42, 39, 24], [10, 39, 24]);
        return s;
      },
      film() { // clapperboard
        const s = make();
        box(s, 0, -12, 0, 96, 54, 8);
        const hinge = [-48, 15, 0];
        const far = [42, 44, 0];
        for (const zz of [-4, 4]) {
          L(s, [hinge[0], hinge[1], zz], [far[0], far[1], zz]);
          L(s, [far[0], far[1], zz], [far[0] + 2, far[1] - 14, zz], 2);
        }
        L(s, [hinge[0], hinge[1], -4], [hinge[0], hinge[1], 4], 2);
        L(s, [far[0], far[1], -4], [far[0], far[1], 4]);
        for (const f of [0.25, 0.5, 0.75]) {
          const x = hinge[0] + (far[0] - hinge[0]) * f, y = hinge[1] + (far[1] - hinge[1]) * f;
          L(s, [x, y, 4], [x + 7, y - 9, 4], 1);
        }
        s.dots.push([-38, -32, 4], [38, -32, 4]);
        return s;
      },
      crt() { // digital glitch: CRT monitor
        const s = make();
        const F = [[-52, 40, 26], [52, 40, 26], [52, -34, 26], [-52, -34, 26]];
        const B = [[-32, 26, -30], [32, 26, -30], [32, -22, -30], [-32, -22, -30]];
        for (let i = 0; i < 4; i++) { L(s, F[i], F[(i + 1) % 4]); L(s, B[i], B[(i + 1) % 4], 2); L(s, F[i], B[i], 2); }
        const sc = [[-42, 32, 26.5], [42, 32, 26.5], [42, -26, 26.5], [-42, -26, 26.5]];
        for (let i = 0; i < 4; i++) L(s, sc[i], sc[(i + 1) % 4], 1);
        box(s, 0, -44, 0, 40, 12, 30, 2);
        s.dots.push([46, -30, 26.5]);
        s.scan = { x1: -42, x2: 42, top: 30, bot: -24, z: 27 };
        return s;
      },
      plane() { // SEND IT! paper airplane
        const s = make();
        const nose = [62, 2, 0], tailT = [-48, 26, 0], keel = [-42, -22, 0];
        const wingL = [-38, 6, -42], wingR = [-38, 6, 42];
        L(s, nose, tailT); L(s, nose, keel, 2); L(s, tailT, keel, 2);
        L(s, nose, wingL, 1); L(s, nose, wingR, 1);
        L(s, wingL, [-46, 14, -10], 1); L(s, wingR, [-46, 14, 10], 1);
        L(s, [-58, 18, 0], [-72, 16, 0], 2); L(s, [-64, 6, 0], [-80, 4, 0], 2); L(s, [-58, -6, 0], [-70, -8, 0], 2);
        s.dots.push(nose);
        return s;
      },
      can() { // celsius
        const s = make();
        ring(s, 0, -40, 0, 30, 14, "y");
        ring(s, 0, 42, 0, 26, 14, "y");
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          L(s, [Math.cos(a) * 30, -40, Math.sin(a) * 30], [Math.cos(a) * 26, 42, Math.sin(a) * 26], 2);
        }
        ring(s, 0, 14, 0, 29, 14, "y", 1);
        ring(s, 0, 26, 0, 28, 14, "y", 1);
        s.orbit = true;
        return s;
      },
    };
  })();

  document.querySelectorAll("canvas.card-model[data-shape]").forEach((canvas, idx) => {
    const builder = cardShapes[canvas.dataset.shape];
    if (!builder) return;
    const shape = builder();
    const ctx = canvas.getContext("2d");
    const F = 420;
    const pitch = 0.48;
    const phase = idx * 0.9;
    const COL = [
      (a) => `rgba(${ACC1_RGB}, ${0.6 * a})`,
      (a) => `rgba(${ACC2_RGB}, ${0.8 * a})`,
      (a) => `rgba(${ACC1_RGB}, ${0.3 * a})`,
    ];

    const draw = (t) => {
      const { w, h } = fitCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const yaw = (reducedMotion ? 0.7 : t / 1000 * 0.35) + phase;
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const sp = Math.sin(pitch), cp = Math.cos(pitch);
      const scale = Math.min(w, h) / 200;
      const cx2 = w / 2, cy2 = h / 2;
      const proj = (p) => {
        const x1 = p[0] * cy + p[2] * sy;
        const z1 = -p[0] * sy + p[2] * cy;
        const y2 = p[1] * cp - z1 * sp;
        const z2 = p[1] * sp + z1 * cp;
        const s = F / (F - z2 * 0.9);
        return [cx2 + x1 * s * scale, cy2 - y2 * s * scale, z2, s];
      };

      const drawn = shape.segs.map(([a, b, k]) => {
        const pa = proj(a), pb = proj(b);
        return { pa, pb, k, z: (pa[2] + pb[2]) / 2 };
      });
      drawn.sort((p, q) => p.z - q.z);
      ctx.lineWidth = 1.3;
      for (const s of drawn) {
        const fog = Math.max(0.2, Math.min(1, 0.5 + 0.5 * (s.z / 100)));
        ctx.strokeStyle = COL[s.k](fog);
        ctx.beginPath(); ctx.moveTo(s.pa[0], s.pa[1]); ctx.lineTo(s.pb[0], s.pb[1]); ctx.stroke();
      }
      for (const d of shape.dots) {
        const q = proj(d);
        const fog = Math.max(0.25, Math.min(1, 0.5 + 0.5 * (q[2] / 100)));
        ctx.fillStyle = `rgba(${ACC2_RGB}, ${0.85 * fog})`;
        ctx.beginPath(); ctx.arc(q[0], q[1], 1.8 * q[3], 0, Math.PI * 2); ctx.fill();
      }
      // shape-specific life
      if (shape.scan) {
        const u = reducedMotion ? 0.4 : ((t / 2600) % 1);
        const yy = shape.scan.top - (shape.scan.top - shape.scan.bot) * u;
        const a = proj([shape.scan.x1, yy, shape.scan.z]);
        const b = proj([shape.scan.x2, yy, shape.scan.z]);
        ctx.strokeStyle = `rgba(${ACC2_RGB}, 0.75)`;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      if (shape.bubbles) {
        for (const [bx, ph, bz] of shape.bubbles) {
          const u = reducedMotion ? ph : ((t / 4000 + ph) % 1);
          const q = proj([bx, -34 + u * 48, bz]);
          ctx.fillStyle = `rgba(${ACC2_RGB}, ${0.7 * (1 - u * 0.5)})`;
          ctx.beginPath(); ctx.arc(q[0], q[1], 1.6 * q[3], 0, Math.PI * 2); ctx.fill();
        }
      }
      if (shape.arc) {
        const flick = reducedMotion ? 0.8 : (Math.sin(t / 90) > -0.2 ? 0.35 + 0.65 * Math.abs(Math.sin(t / 47)) : 0.1);
        ctx.strokeStyle = `rgba(${ACC2_RGB}, ${flick})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        shape.arc.forEach((p, i) => {
          const q = proj(p);
          i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]);
        });
        ctx.stroke();
        ctx.lineWidth = 1.3;
      }
      if (shape.orbit) {
        const ang = (reducedMotion ? 0.8 : t / 900) + phase;
        const q = proj([Math.cos(ang) * 52, 8 + Math.sin(ang * 2) * 10, Math.sin(ang) * 52]);
        ctx.fillStyle = `rgba(${ACC2_RGB}, 0.9)`;
        ctx.beginPath(); ctx.arc(q[0], q[1], 2.2 * q[3], 0, Math.PI * 2); ctx.fill();
      }
    };

    if (reducedMotion) {
      requestAnimationFrame((t) => draw(t));
      window.addEventListener("resize", () => requestAnimationFrame((t) => draw(t)));
    } else {
      runWhenVisible(canvas, draw);
    }
  });

  /* ==========================================================================
     FULL-DETAIL MODELS (model-viewer) — graceful failure note
     The component keeps its poster image when the glTF can't load;
     we just make the hint say so instead of leaving it ambiguous.
     ========================================================================== */
  document.querySelectorAll("model-viewer.pcb-model").forEach((mv) => {
    mv.addEventListener("error", () => {
      const stage = mv.closest(".model-stage");
      const hint = stage && stage.querySelector(".model-hint");
      if (hint) hint.textContent = "INTERACTIVE MODEL UNAVAILABLE · STATIC RENDER";
    });
  });

  /* ==========================================================================
     HERO — oscilloscope strip
     ========================================================================== */
  const scope = document.getElementById("scope-canvas");
  if (scope && !reducedMotion) {
    const ctx = scope.getContext("2d");
    const drawScope = (t) => {
      const { w, h } = fitCanvas(scope);
      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;

      ctx.strokeStyle = `rgba(${ACC1_RGB}, 0.06)`;
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${ACC1_RGB}, 0.12)`;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

      const tt = t / 1000;
      const wave = (x) => {
        const u = x / w;
        const sweep = tt * 1.4;
        let v = Math.sin((u * 18 + sweep) * Math.PI) * Math.exp(-Math.pow(((u + tt * 0.07) % 1) - 0.5, 2) * 26);
        v += 0.35 * Math.sin((u * 46 - sweep * 2.2) * Math.PI);
        const sq = Math.sin((u * 3 + sweep * 0.3) * Math.PI * 2);
        v += 0.28 * (sq > 0.6 ? 1 : sq < -0.6 ? -1 : 0);
        return v;
      };

      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(${ACC1_RGB}, 0.75)`;
      ctx.shadowColor = ACC1_HEX;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = mid + wave(x) * (h * 0.26);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      const hx = ((tt * 160) % (w + 60)) - 30;
      ctx.fillStyle = `rgba(${ACC1_RGB}, 0.9)`;
      ctx.beginPath();
      ctx.arc(hx, mid + wave(hx) * (h * 0.26), 2.4, 0, Math.PI * 2);
      ctx.fill();
    };
    runWhenVisible(scope, drawScope);
  } else if (scope) {
    const ctx = scope.getContext("2d");
    const { w, h } = fitCanvas(scope);
    ctx.strokeStyle = `rgba(${ACC1_RGB}, 0.6)`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const y = h / 2 + Math.sin((x / w) * 14 * Math.PI) * h * 0.2;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /* ==========================================================================
     LIGHTBOX — click-to-expand with scroll-zoom and drag-pan
     ========================================================================== */
  const zoomTargets = document.querySelectorAll(".case-media img, .lab-card img");
  if (zoomTargets.length) {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Image viewer");
    lb.innerHTML =
      '<button class="lightbox-close" aria-label="Close image viewer">✕</button>' +
      '<img alt="" draggable="false">' +
      '<p class="lightbox-caption"><span class="lb-title"></span> <span class="lb-hint">· scroll to zoom · drag to pan · esc to close</span></p>';
    document.body.appendChild(lb);
    const lbImg = lb.querySelector("img");
    const lbTitle = lb.querySelector(".lb-title");
    const closeBtn = lb.querySelector(".lightbox-close");

    let scale = 1, tx = 0, ty = 0, lastFocus = null;
    let panPointer = null, panX = 0, panY = 0, moved = 0;

    const apply = () => {
      lbImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      lb.classList.toggle("zoomed", scale > 1.01);
    };
    const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };

    const open = (img) => {
      lastFocus = document.activeElement;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || "";
      const fig = img.closest("figure");
      const head = fig ? fig.querySelector("h3") : null;
      lbTitle.textContent = head ? head.textContent : (img.alt || "");
      reset();
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    };
    const close = () => {
      lb.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    closeBtn.addEventListener("click", close);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.classList.contains("open")) close();
    });

    lb.addEventListener("wheel", (e) => {
      if (!lb.classList.contains("open")) return;
      e.preventDefault();
      const next = Math.min(6, Math.max(1, scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      scale = next;
      if (scale <= 1.01) { tx = 0; ty = 0; scale = 1; }
      apply();
    }, { passive: false });

    lbImg.addEventListener("pointerdown", (e) => {
      if (scale <= 1.01) return;
      panPointer = e.pointerId; panX = e.clientX; panY = e.clientY; moved = 0;
      lb.classList.add("panning");
      lbImg.setPointerCapture(e.pointerId);
    });
    lbImg.addEventListener("pointermove", (e) => {
      if (panPointer !== e.pointerId) return;
      const dx = e.clientX - panX, dy = e.clientY - panY;
      panX = e.clientX; panY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      tx += dx; ty += dy;
      apply();
    });
    const endPan = (e) => {
      if (panPointer === e.pointerId) { panPointer = null; lb.classList.remove("panning"); }
    };
    lbImg.addEventListener("pointerup", endPan);
    lbImg.addEventListener("pointercancel", endPan);

    // Click toggles fit <-> 2.5x (unless the click was really a pan)
    lbImg.addEventListener("click", () => {
      if (moved > 6) { moved = 0; return; }
      if (scale > 1.01) reset();
      else { scale = 2.5; apply(); }
    });

    zoomTargets.forEach((img) => {
      img.classList.add("zoomable");
      img.addEventListener("click", () => open(img));
    });
  }
})();
