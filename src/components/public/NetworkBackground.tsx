"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

/**
 * Network background: a drifting constellation of glowing nodes joined by fine links,
 * with data packets hopping from node to node. Light + dark, follows next-themes.
 *
 *   <NetworkBackground />                      // click/tap sends a shockwave through the network
 *   <NetworkBackground interactive={false} />  // no interaction at all
 *
 * Layers (back to front)
 *  1. A dot grid with a soft diagonal wave of light travelling across it
 *  2. Links between nearby nodes (fade with distance, hubs reach further)
 *  3. Hubs: bigger nodes wrapped in slowly rotating dashed rings
 *  4. Packets: little glowing dots that travel along links, hopping node to node
 *  5. Nodes: soft glow + core, drifting, wrapping around the screen
 *  6. Click: an expanding shockwave that pushes nearby nodes away and makes them flash
 */

const TAU = Math.PI * 2;
const DENSITY = 22000; // px² of screen per node
const WAVE_REACH = 420;
const WAVE_SECONDS = 3;
const ALLOW_CARD_RIPPLE = false;

type RGB = [number, number, number];

const LIGHT = {
  indigo: [79, 70, 229],
  blue: [37, 99, 235],
  sky: [14, 165, 233],
  cyan: [6, 182, 212],
  violet: [124, 58, 237],
  pink: [219, 39, 119],
  white: [255, 255, 255],
} satisfies Record<string, RGB>;
type Col = keyof typeof LIGHT;

const DARK: Record<Col, RGB> = {
  indigo: [129, 140, 248],
  blue: [96, 165, 250],
  sky: [56, 189, 248],
  cyan: [34, 211, 238],
  violet: [167, 139, 250],
  pink: [244, 114, 182],
  white: [255, 255, 255],
};

const COLS = Object.keys(LIGHT) as Col[];

// which colour each node gets (pink is the rare accent)
const NODE_COLS: Col[] = ["indigo", "blue", "sky", "cyan", "blue", "violet", "sky", "indigo", "cyan", "pink"];

// per-theme strengths: [light, dark]
const K = {
  dot: [0.3, 0.3],
  link: [0.42, 0.5],
  glow: [0.8, 1.25],
  ring: [0.4, 0.5],
};

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ix: number; // impulse from clicks, decays
  iy: number;
  r: number;
  c: Col;
  hub: boolean;
  ph: number;
  dir: number;
}
interface Packet {
  a: number;
  b: number;
  p: number;
  sp: number;
  c: Col;
}
interface Wave {
  x: number;
  y: number;
  t: number;
}

// page background is pure CSS, keyed off the theme attribute set by next-themes (no flash on load).
// A ::before layer holds the dark look and fades in over the light one.
const CSS = `
.net-bg{background:
radial-gradient(1200px 700px at 88% -10%,rgba(99,102,241,.13),transparent 60%),
radial-gradient(900px 600px at 0% 105%,rgba(14,165,233,.13),transparent 60%),
linear-gradient(180deg,#FBFCFF 0%,#F1F5FD 100%)}
.net-bg::before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .6s ease;background:
radial-gradient(1200px 700px at 88% -10%,rgba(99,102,241,.3),transparent 60%),
radial-gradient(900px 600px at 0% 105%,rgba(14,165,233,.2),transparent 60%),
linear-gradient(180deg,#060914 0%,#0A1022 100%)}
.dark .net-bg::before,[data-theme="dark"] .net-bg::before{opacity:1}
@media (prefers-reduced-motion:reduce){.net-bg::before{transition:none}}
`;

export function NetworkBackground({ interactive = true }: { interactive?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

  // theme -> shared refs (declared before the draw effect so the first frame already has the right mix)
  const targetRef = useRef(0); // 0 = light, 1 = dark
  const mixRef = useRef<number | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const resetScrollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Reset scroll tracking on route change to prevent sudden scroll jumps
    resetScrollRef.current?.();
  }, [pathname]);

  useEffect(() => {
    if (!resolvedTheme) return;
    const tg = resolvedTheme === "dark" ? 1 : 0;
    targetRef.current = tg;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (mixRef.current === null || reduce) {
      mixRef.current = tg; // first value, or no animation wanted: jump straight there
      redrawRef.current?.();
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv ? cv.getContext("2d") : null;
    if (!cv || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let nodes: Node[] = [];
    let packets: Packet[] = [];
    const waves: Wave[] = [];
    let timer = 0;
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let scrollDelta = 0;

    // live palette, blended between light and dark every frame
    const cur = {} as Record<Col, string>;
    const rg = (c: Col, a: number) => `rgba(${cur[c]},${a})`;

    let W = 0, H = 0;
    let sc = 1;
    let LINK = 140;

    const range = (a: Node, b: Node) => (a.hub || b.hub ? LINK * 1.5 : LINK);

    const neighbours = (i: number) => {
      const a = nodes[i];
      const out: number[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const b = nodes[j];
        const R = range(a, b);
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < R * R) out.push(j);
      }
      return out;
    };

    const hop = (pk: Packet) => {
      const list = neighbours(pk.a);
      if (!list.length) {
        pk.b = -1;
        return;
      }
      // prefer not to bounce straight back
      const pool = list.length > 1 ? list.filter((j) => j !== pk.b) : list;
      pk.b = pool[Math.floor(Math.random() * pool.length)];
      pk.p = 0;
    };

    const build = () => {
      sc = Math.max(0.7, Math.min(1.25, H / 900));
      LINK = Math.max(105, Math.min(165, Math.max(W, H) * 0.09));
      const count = Math.max(26, Math.min(76, Math.round((W * H) / DENSITY)));
      const hubs = Math.max(3, Math.round(count / 14));
      nodes = Array.from({ length: count }, (_, i) => {
        const hub = i < hubs;
        const sp = hub ? 4 + Math.random() * 5 : 6 + Math.random() * 12;
        const ang = Math.random() * TAU;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          ix: 0,
          iy: 0,
          r: (hub ? 4 + Math.random() * 1.5 : 1.6 + Math.random() * 1.4) * sc,
          c: hub ? (["indigo", "blue", "sky", "violet"] as Col[])[i % 4] : NODE_COLS[Math.floor(Math.random() * NODE_COLS.length)],
          hub,
          ph: Math.random() * TAU,
          dir: Math.random() < 0.5 ? 1 : -1,
        };
      });
      const np = Math.max(6, Math.round(count / 6));
      packets = Array.from({ length: np }, () => {
        const pk: Packet = {
          a: Math.floor(Math.random() * count),
          b: -1,
          p: Math.random(),
          sp: 0.35 + Math.random() * 0.5,
          c: (["sky", "cyan", "white", "indigo"] as Col[])[Math.floor(Math.random() * 4)],
        };
        hop(pk);
        return pk;
      });
    };

    const fit = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const GRID = 34;
    const M = 40; // wrap margin

    const draw = (t: number, dt: number) => {
      // theme mix: 0 = light, 1 = dark (eased)
      const raw = mixRef.current ?? 0;
      const mix = raw * raw * (3 - 2 * raw);
      const lp = (k: number[]) => k[0] + (k[1] - k[0]) * mix;
      for (const c of COLS) cur[c] = LIGHT[c].map((v, i) => Math.round(v + (DARK[c][i] - v) * mix)).join(",");

      ctx.clearRect(0, 0, W, H);

      // move nodes
      const decay = Math.exp(-dt * 1.8);
      // Cap scroll shift to prevent nodes from bunching up during rapid scroll or jumps
      const rawShift = scrollDelta * 0.55;
      const scrollShift = Math.max(-20, Math.min(20, rawShift));
      scrollDelta = 0;

      const spanX = W + 2 * M;
      const spanY = H + 2 * M;

      for (const n of nodes) {
        n.ix *= decay;
        n.iy *= decay;
        n.x += (n.vx + n.ix) * dt;
        n.y += (n.vy + n.iy) * dt - scrollShift;

        // Wrap around preserving relative spacing (never hard-clamp coordinates)
        if (spanX > 0 && (n.x < -M || n.x > W + M)) {
          n.x = ((((n.x + M) % spanX) + spanX) % spanX) - M;
        }
        if (spanY > 0 && (n.y < -M || n.y > H + M)) {
          n.y = ((((n.y + M) % spanY) + spanY) % spanY) - M;
        }
      }

      // 1) dot grid with a soft travelling wave of light
      const gridShiftY = (lastScrollY * 0.3) % GRID;
      ctx.beginPath();
      for (let y = (GRID / 2) - gridShiftY; y < H + GRID; y += GRID) {
        for (let x = GRID / 2; x < W; x += GRID) {
          const w = 0.5 + 0.5 * Math.sin((x + y + lastScrollY * 0.3) * 0.0055 - t * 0.5);
          const r = 0.8 + 1.5 * w * w * w;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
      }
      ctx.fillStyle = rg("blue", lp(K.dot));
      ctx.fill();

      // 2) links
      const la = lp(K.link);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const R = range(a, b);
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          const f = 1 - Math.sqrt(d2) / R;
          ctx.strokeStyle = rg(a.hub ? a.c : b.c, f ** 1.3 * la);
          ctx.lineWidth = a.hub || b.hub ? 1.2 : 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // 3) hub rings, slowly turning dashes
      const ra = lp(K.ring);
      ctx.lineWidth = 1.2;
      for (const n of nodes) {
        if (!n.hub) continue;
        const breathe = 1 + 0.05 * Math.sin(t * 0.7 + n.ph);
        ctx.setLineDash([3, 9]);
        ctx.lineDashOffset = -t * 9 * n.dir;
        ctx.strokeStyle = rg(n.c, ra);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 17 * sc * breathe, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([2, 14]);
        ctx.lineDashOffset = t * 6 * n.dir;
        ctx.strokeStyle = rg(n.c, ra * 0.7);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 28 * sc * breathe, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 4) packets hopping along links
      for (const pk of packets) {
        if (pk.b < 0) {
          if (dt > 0) hop(pk);
          continue;
        }
        const a = nodes[pk.a], b = nodes[pk.b];
        const R = range(a, b);
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy > R * R * 1.1) {
          // link broke while travelling: pick another route
          if (dt > 0) hop(pk);
          continue;
        }
        pk.p += dt * pk.sp;
        if (pk.p >= 1) {
          pk.a = pk.b;
          hop(pk);
          continue;
        }
        const x = a.x + (b.x - a.x) * pk.p;
        const y = a.y + (b.y - a.y) * pk.p;
        const edge = Math.sin(pk.p * Math.PI);
        ctx.fillStyle = rg(pk.c, 0.16 * edge);
        ctx.beginPath();
        ctx.arc(x, y, 7 * sc, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rg(pk.c, 0.5 * edge);
        ctx.beginPath();
        ctx.arc(x, y, 3.4 * sc, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rg("white", 0.95 * edge);
        ctx.beginPath();
        ctx.arc(x, y, 1.5 * sc, 0, TAU);
        ctx.fill();
      }

      // 5) nodes
      while (waves.length && t - waves[0].t > WAVE_SECONDS) waves.shift();
      const gm = lp(K.glow);
      for (const n of nodes) {
        let fl = 0;
        for (const w of waves) {
          const age = Math.min(1, Math.max(0, (t - w.t) / WAVE_SECONDS));
          const R = (1 - (1 - age) ** 3) * WAVE_REACH;
          const d = Math.hypot(n.x - w.x, n.y - w.y);
          fl = Math.max(fl, Math.exp(-(((d - R) / 38) ** 2)) * (1 - age));
        }
        const pulse = 0.85 + 0.15 * Math.sin(t * 1.2 + n.ph);
        const r = n.r * (1 + fl * 0.8);
        ctx.fillStyle = rg(n.c, Math.min(1, 0.1 * gm * pulse + fl * 0.25));
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rg(n.c, Math.min(1, 0.2 * gm * pulse + fl * 0.3));
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rg(n.c, 0.95);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, TAU);
        ctx.fill();
        if (n.hub || fl > 0.05) {
          ctx.fillStyle = rg("white", Math.min(1, (n.hub ? 0.8 : 0) + fl));
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 0.45, 0, TAU);
          ctx.fill();
        }
      }

      // 6) click shockwave rings
      for (const w of waves) {
        const age = Math.min(1, Math.max(0, (t - w.t) / WAVE_SECONDS));
        const e = 1 - (1 - age) ** 3;
        const fade = 1 - age;
        ctx.lineWidth = 2;
        ctx.strokeStyle = rg("blue", fade * 0.6);
        ctx.beginPath();
        ctx.arc(w.x, w.y, e * WAVE_REACH, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = rg("cyan", fade * 0.5);
        ctx.beginPath();
        ctx.arc(w.x, w.y, e * WAVE_REACH * 0.7, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rg("white", fade * 0.8);
        ctx.beginPath();
        ctx.arc(w.x, w.y, e * WAVE_REACH * 0.4, 0, TAU);
        ctx.stroke();
      }
    };

    fit();
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // glide the theme mix towards its target (~0.5 s)
      const tg = targetRef.current;
      const m = mixRef.current ?? tg;
      if (m !== tg) mixRef.current = m < tg ? Math.min(tg, m + dt * 2) : Math.max(tg, m - dt * 2);
      draw(now / 1000, dt);
      raf = requestAnimationFrame(frame);
    };
    if (reduce) {
      redrawRef.current = () => draw(0, 0);
      draw(0, 0);
    } else raf = requestAnimationFrame(frame);

    resetScrollRef.current = () => {
      lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
      scrollDelta = 0;
    };

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      // Filter out huge instantaneous jumps (e.g. route transitions, anchor jumps)
      if (Math.abs(diff) < 150) {
        scrollDelta += diff;
      } else {
        scrollDelta = 0;
      }
      if (reduce) redrawRef.current?.();
    };

    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        fit();
        if (reduce) draw(0, 0);
      }, 150);
    };
    const onDown = (e: PointerEvent) => {

      // Always ignore right clicks / middle clicks
      if (e.button !== 0) return;
      // If cards are NOT allowed to ripple, block clicks inside cards/interactive UI
      if (!ALLOW_CARD_RIPPLE) {
        // Do not trigger ripple when clicking inside cards, forms, buttons, or interactive UI
        const target = e.target as Element | null;
        if (
          target &&
          typeof target.closest === "function" &&
          target.closest(
            "button, input, textarea, select, a, label, summary, [role='button'], [role='link'], [role='tab'], [role='dialog'], [role='menu'], [role='listbox'], [role='option'], [role='checkbox'], [role='radio'], [data-no-ripple], form, nav, header, footer, dialog, [role='dialog'], [role='region'], .card, [class*='card'], [class*='backdrop-blur'], [class*='bg-card'], [data-card]"
          )
        ) {
          return;
        }
      }


      waves.push({ x: e.clientX, y: e.clientY, t: performance.now() / 1000 });
      if (waves.length > 3) waves.shift();
      // push nearby nodes away from the click point
      for (const n of nodes) {
        const dx = n.x - e.clientX, dy = n.y - e.clientY;
        const d = Math.hypot(dx, dy) || 1;
        if (d > WAVE_REACH) continue;
        const f = (1 - d / WAVE_REACH) * 300;
        n.ix += (dx / d) * f;
        n.iy += (dy / d) * f;
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (interactive && !reduce) window.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      redrawRef.current = null;
      resetScrollRef.current = null;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [interactive]);

  return (
    <>
      <style>{CSS}</style>
      <div
        aria-hidden="true"
        className="net-bg"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "none",
          contain: "strict",
        }}
      >
        <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>
    </>
  );
}
