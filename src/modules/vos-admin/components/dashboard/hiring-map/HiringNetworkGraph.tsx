// src/modules/vos-admin/components/dashboard/hiring-map/HiringNetworkGraph.tsx
'use client';

import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { animate, motion } from 'framer-motion';
import { LocateFixed, Minus, Plus, RotateCcw } from 'lucide-react';
import type {
  CompanyNode,
  FreelancerNode,
  GraphSelection,
  HiringGraph,
  ViewBox,
} from '../../../types/hiring-map.types';
import { COMPANY_R } from '../../../lib/hiring-map/hiring-graph';
import { computeFocus } from '../../../lib/hiring-map/hiring-focus';
import { clamp } from '../../../lib/hiring-map/hiring-format';
import type { Arrival } from '../../../hooks/useHiringStream';

interface Pos {
  x: number;
  y: number;
}

const ACCENT = '#38bdf8';
const INTRO_MS = 2_500;
const MIN_VIEW_W = 140; // world units: closest zoom
const MAX_ZOOM_OUT = 8; // x the auto-fit width
const DRAG_THRESHOLD_PX = 4;
/** Dots are drawn a bit larger than their layout slot so they stay readable on a TV. */
const DOT_SCALE = 1.35;

export const hubRadius = (c: CompanyNode) => COMPANY_R + Math.min(10, Math.sqrt(c.hireCount) * 1.6);

// ───────────────────────── camera maths ─────────────────────────

const lerpBox = (a: ViewBox, b: ViewBox, t: number): ViewBox => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

/** Same centre, widened/heightened (never cropped) so width/height == aspect exactly. */
function fitToAspect(box: ViewBox, aspect: number): ViewBox {
  const cx = box[0] + box[2] / 2;
  const cy = box[1] + box[3] / 2;
  let w = box[2];
  let h = box[3];
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return [cx - w / 2, cy - h / 2, w, h];
}

// ───────────────────────── smooth hub movement ─────────────────────────
// Slots never change for existing freelancers, but when a new company joins the
// hubs are re-balanced. We tween every node from where it is to where it should
// be, in one pass, so lines stay glued to their dots.

function targetPositions(graph: HiringGraph): Map<string, Pos> {
  const map = new Map<string, Pos>();
  for (const c of graph.companies) map.set(c.id, { x: c.x, y: c.y });
  for (const f of graph.freelancers) map.set(f.id, { x: f.x, y: f.y });
  return map;
}

function useAnimatedPositions(graph: HiringGraph) {
  const target = useMemo(() => targetPositions(graph), [graph]);
  const [pos, setPos] = useState<Map<string, Pos>>(target);
  const current = useRef<Map<string, Pos>>(target);

  useEffect(() => {
    const from = current.current;
    let moved = false;
    for (const [id, to] of target) {
      const f = from.get(id);
      if (f && (Math.abs(f.x - to.x) > 0.5 || Math.abs(f.y - to.y) > 0.5)) {
        moved = true;
        break;
      }
    }
    if (!moved) {
      current.current = target;
      setPos(target);
      return;
    }
    const controls = animate(0, 1, {
      duration: 0.9,
      ease: 'easeInOut',
      onUpdate: (t: number) => {
        const next = new Map<string, Pos>();
        for (const [id, to] of target) {
          const f = from.get(id) ?? to; // brand-new nodes appear in place
          next.set(id, { x: f.x + (to.x - f.x) * t, y: f.y + (to.y - f.y) * t });
        }
        current.current = next;
        setPos(next);
      },
      onComplete: () => {
        current.current = target;
        setPos(target);
      },
    });
    return () => controls.stop();
  }, [target]);

  return { pos, target };
}

// ───────────────────────── pieces ─────────────────────────

const Edge = memo(function Edge(props: {
  id: string;
  color: string;
  weight: number;
  freelancerId: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  curved: boolean;
  today: boolean;
  fresh: boolean;
  dim: boolean;
  emph: boolean;
  pw: number;
}) {
  const { id, color, weight, freelancerId, ax, ay, bx, by, curved, today, fresh, dim, emph, pw } = props;
  let d = `M${ax},${ay} L${bx},${by}`;
  if (curved) {
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const sign = freelancerId % 2 === 0 ? 1 : -1;
    d = `M${ax},${ay} Q${mx - dy * 0.16 * sign},${my + dx * 0.16 * sign} ${bx},${by}`;
  }
  const opacity = dim ? 0.06 : fresh ? 1 : emph ? 0.95 : today ? 0.88 : curved ? 0.68 : 0.58;
  const strokeW = (emph ? 3 : today ? 2.4 : 1.9) * pw * (1 + 0.5 * (weight - 1));
  const showFlow = !dim && (today || emph || fresh);
  return (
    <g>
      <path
        data-edge-id={id}
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(12 * pw, strokeW * 4)}
        strokeLinecap="round"
      />
      {showFlow && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeOpacity={emph ? 0.24 : 0.16}
          strokeWidth={strokeW * 3.2}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeOpacity={opacity}
        strokeWidth={strokeW}
        initial={fresh ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        pointerEvents="none"
      />
      {!dim && (
        <motion.path
          d={d}
          fill="none"
          stroke="#f8fafc"
          strokeLinecap="round"
          strokeOpacity={emph ? 0.72 : today ? 0.58 : 0.32}
          strokeWidth={Math.max(1, strokeW * 0.55)}
          strokeDasharray={`${4 * pw} ${12 * pw}`}
          animate={{ strokeDashoffset: [0, -32 * pw] }}
          transition={{ duration: emph || today ? 1.8 : 3.2, ease: 'linear', repeat: Infinity }}
          pointerEvents="none"
        />
      )}
    </g>
  );
});

const Dot = memo(function Dot(props: {
  node: FreelancerNode;
  x: number;
  y: number;
  today: boolean;
  appear: boolean;
  delay: number;
  dim: boolean;
  selected: boolean;
  hovered: boolean;
  pw: number;
}) {
  const { node, x, y, today, appear, delay, dim, selected, hovered, pw } = props;
  const r = node.r * DOT_SCALE;
  const active = selected || hovered;
  const floatDx = ((node.entityId % 3) - 1) * 1.4 || 1.2;
  const floatDy = (((node.entityId >> 1) % 3) - 1) * 1.4 || -1.2;
  const floatDur = 4.5 + (node.entityId % 4) * 0.8;
  return (
    <g
      data-node-id={node.id}
      transform={`translate(${x},${y})`}
      opacity={dim ? 0.14 : today || active ? 1 : 0.72}
      style={{ transition: 'opacity 200ms' }}
    >
      <motion.g
        animate={!dim && !active ? { x: [0, floatDx, 0, -floatDx, 0], y: [0, floatDy, 0, -floatDy, 0] } : { x: 0, y: 0 }}
        transition={!dim && !active ? { duration: floatDur, ease: 'easeInOut', repeat: Infinity } : { duration: 0.2 }}
      >
        {/* generous invisible hit area so a small dot is easy to point at */}
        <circle r={Math.max(r * 2.2, 11 * pw)} fill="transparent" />
        {today && !dim ? (
          <motion.circle
            r={r * 2.1}
            fill={node.color}
            pointerEvents="none"
            animate={{ scale: [1, 1.3, 1], opacity: [0.26, 0.08, 0.26] }}
            transition={{ duration: 2.8, ease: 'easeInOut', repeat: Infinity }}
          />
        ) : (
          !dim && <circle r={r * 1.5} fill={node.color} opacity={0.14} pointerEvents="none" />
        )}
        {active && (
          <circle
            r={r + 5 * pw}
            fill="none"
            stroke={selected ? '#f8fafc' : node.color}
            strokeWidth={2 * pw}
            strokeOpacity={0.9}
            pointerEvents="none"
          />
        )}
        <motion.circle
          fill={node.color}
          stroke="#020617"
          strokeWidth={1.4 * pw}
          initial={appear ? { r: 0 } : false}
          animate={{ r: active ? r * 1.2 : r }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay }}
          pointerEvents="none"
        />
      </motion.g>
    </g>
  );
});

/** Name tag, drawn on the top layer so a hub can never cover it. */
const DotLabel = memo(function DotLabel(props: { node: FreelancerNode; x: number; y: number; pw: number }) {
  const { node, x, y, pw } = props;
  return (
    <text
      x={x}
      y={y - (node.r * DOT_SCALE + 8 * pw)}
      textAnchor="middle"
      fontSize={14 * pw}
      fontWeight={700}
      fill="#f8fafc"
      stroke="#020617"
      strokeWidth={4 * pw}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {node.label}
    </text>
  );
});

const Hub = memo(function Hub(props: {
  node: CompanyNode;
  x: number;
  y: number;
  today: boolean;
  appear: boolean;
  delay: number;
  showLabel: boolean;
  hasClusterRing: boolean;
  labelAbove?: boolean;
  dim: boolean;
  selected: boolean;
  hovered: boolean;
  pw: number;
  clipId: string;
  gradId: string;
}) {
  const { node, x, y, today, appear, delay, showLabel, hasClusterRing, labelAbove = false, dim, selected, hovered, pw, clipId, gradId } = props;
  const r = hubRadius(node);
  const [logoOk, setLogoOk] = useState(true);
  const hasLogo = !!node.logoUrl && logoOk;
  const active = selected || hovered;
  const labelY = labelAbove ? -(r + 20 * pw) : (hasClusterRing ? node.clusterRadius - 4 : r + 4) + 16 * pw;
  const labelText = `${node.label} · ${node.hireCount}`;
  const pillW = Math.max(72 * pw, (labelText.length * 6.6 + 20) * pw);
  const pillH = 24 * pw;

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${x},${y})`}
      opacity={dim ? 0.22 : 1}
      style={{ transition: 'opacity 200ms' }}
    >
      <circle r={r + 14 * pw} fill="transparent" />

      {/* subtle rotating cluster orbit ring (only when the cluster actually holds freelancers) */}
      {hasClusterRing && node.clusterRadius > r + 10 && (
        <motion.circle
          r={node.clusterRadius}
          fill="none"
          stroke={active ? ACCENT : '#94a3b8'}
          strokeOpacity={dim ? 0.03 : active ? 0.24 : 0.09}
          strokeWidth={1.2 * pw}
          strokeDasharray={`${4 * pw} ${8 * pw}`}
          pointerEvents="none"
          animate={{ rotate: 360 }}
          transition={{ duration: 64, ease: 'linear', repeat: Infinity }}
        />
      )}

      {/* ambient breathing halo */}
      {(today || active) && !dim && (
        <motion.circle
          r={r + 14}
          fill={active ? ACCENT : '#38bdf8'}
          pointerEvents="none"
          animate={{ scale: [1, 1.18, 1], opacity: [0.18, 0.06, 0.18] }}
          transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
        />
      )}

      {/* rotating segmented orbital ring */}
      <motion.circle
        r={r + 5.5}
        fill="none"
        stroke={selected ? '#f8fafc' : today || hovered ? ACCENT : '#475569'}
        strokeOpacity={selected || today || hovered ? 0.85 : 0.45}
        strokeWidth={(active ? 2.4 : 1.5) * pw}
        strokeDasharray={today || active ? `${12 * pw} ${5 * pw} ${4 * pw} ${5 * pw}` : undefined}
        pointerEvents="none"
        animate={today || active ? { rotate: 360 } : undefined}
        transition={today || active ? { duration: 18, ease: 'linear', repeat: Infinity } : undefined}
      />

      <motion.circle
        fill={`url(#${gradId})`}
        stroke={today || active ? ACCENT : '#64748b'}
        strokeWidth={(active ? 2.4 : 2) * pw}
        initial={appear ? { r: 0 } : false}
        animate={{ r: active ? r * 1.06 : r }}
        transition={{ type: 'spring', stiffness: 160, damping: 16, delay }}
        pointerEvents="none"
      />
      {hasLogo ? (
        <g pointerEvents="none">
          <clipPath id={clipId}>
            <circle r={r - 2.5} />
          </clipPath>
          <circle r={r - 2.5} fill="#ffffff" />
          <image
            href={node.logoUrl ?? undefined}
            x={-r + 2.5}
            y={-r + 2.5}
            width={(r - 2.5) * 2}
            height={(r - 2.5) * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            onError={() => setLogoOk(false)}
          />
        </g>
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 0.8}
          fontWeight={700}
          fill="#f1f5f9"
          style={{ letterSpacing: '0.03em' }}
          pointerEvents="none"
        >
          {node.initials}
        </text>
      )}
      {showLabel && (
        <g transform={`translate(0, ${labelY})`} pointerEvents="none">
          <rect
            x={-pillW / 2}
            y={-pillH / 2}
            width={pillW}
            height={pillH}
            rx={pillH / 2}
            fill="#020617"
            fillOpacity={0.86}
            stroke={active ? ACCENT : '#334155'}
            strokeOpacity={active ? 0.8 : 0.7}
            strokeWidth={1.2 * pw}
          />
          <text
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={13 * pw}
            fontWeight={600}
            fill="#f8fafc"
          >
            {node.label}
            <tspan fill={today || active ? ACCENT : '#94a3b8'} fontWeight={700}>{` · ${node.hireCount}`}</tspan>
          </text>
        </g>
      )}
    </g>
  );
});

function Pulse({ x, y, r, color, pw, maxGrow }: { x: number; y: number; r: number; color: string; pw: number; maxGrow: number }) {
  return (
    <motion.circle
      cx={x}
      cy={y}
      fill="none"
      stroke={color}
      strokeWidth={3 * pw}
      initial={{ r, opacity: 0.9 }}
      animate={{ r: r + maxGrow, opacity: 0 }}
      transition={{ duration: 1.8, ease: 'easeOut', repeat: 2 }}
      pointerEvents="none"
    />
  );
}

const toolBtn =
  'flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200 backdrop-blur ' +
  'transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

// ───────────────────────── graph ─────────────────────────

export interface HiringNetworkGraphHandle {
  zoomBy: (factor: number) => void;
  /** back to "fit everything" (and follow the layout again) */
  recenter: () => void;
  /** fly the camera to a node id ("c42" / "f17") */
  focusNode: (nodeId: string) => void;
  /** put dragged companies back where the layout placed them */
  resetLayout: () => void;
}

export interface HiringNetworkGraphProps {
  graph: HiringGraph;
  /** pixel size of the pane, used to keep text a constant size on screen */
  width: number;
  height: number;
  /** epoch ms of local midnight; hires on/after it are drawn bright */
  todayStart: number;
  arrival?: Arrival | null;
  /** freelancers (entity ids) that get a name tag */
  labelledFreelancers?: ReadonlySet<number>;
  /** small preview: no company labels */
  compact?: boolean;
  selection: GraphSelection | null;
  onSelectionChange: (selection: GraphSelection | null) => void;
  /** legend filter: only this category (and its companies) stays bright */
  categoryFilter?: string | null;
  /** external node id to highlight (e.g. from hovering a row in the feed) */
  externalHoverId?: string | null;
  /** inside a scrolling page: the wheel only zooms with Ctrl/⌘ and touch still scrolls */
  scrollSafe?: boolean;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  nodeId: string | null;
}

export const HiringNetworkGraph = forwardRef<HiringNetworkGraphHandle, HiringNetworkGraphProps>(
  function HiringNetworkGraph(
    {
      graph,
      width,
      height,
      todayStart,
      arrival = null,
      labelledFreelancers,
      compact = false,
      selection,
      onSelectionChange,
      categoryFilter = null,
      externalHoverId = null,
      scrollSafe = false,
    },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const { pos, target } = useAnimatedPositions(graph);

    // ── camera ──
    const [box, setBox] = useState<ViewBox>(graph.fit.box);
    const boxRef = useRef<ViewBox>(graph.fit.box);
    const [mode, setMode] = useState<'auto' | 'manual'>('auto');
    const modeRef = useRef<'auto' | 'manual'>('auto');
    const flight = useRef<{ stop: () => void } | null>(null);
    const fitWidth = useRef(graph.fit.box[2]);
    useEffect(() => {
      fitWidth.current = graph.fit.box[2];
    }, [graph.fit.box]);

    const commitBox = useCallback((b: ViewBox) => {
      boxRef.current = b;
      setBox(b);
    }, []);

    const flyTo = useCallback(
      (to: ViewBox, duration: number) => {
        flight.current?.stop();
        const from = boxRef.current;
        flight.current = animate(0, 1, {
          duration,
          ease: [0.4, 0, 0.2, 1],
          onUpdate: (t: number) => commitBox(lerpBox(from, to, t)),
        });
      },
      [commitBox],
    );

    const setCameraMode = useCallback((m: 'auto' | 'manual') => {
      modeRef.current = m;
      setMode(m);
    }, []);

    /** Called on the first user gesture: stop auto-framing, make the box match the pane exactly. */
    const beginManual = useCallback(() => {
      flight.current?.stop();
      flight.current = null;
      if (modeRef.current === 'auto') {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) commitBox(fitToAspect(boxRef.current, rect.width / rect.height));
        setCameraMode('manual');
      }
    }, [commitBox, setCameraMode]);

    // Auto mode: follow the layout whenever the framing changes (new company, resize…).
    const mounted = useRef(false);
    useEffect(() => {
      if (!mounted.current) {
        mounted.current = true;
        return;
      }
      if (modeRef.current !== 'auto') return;
      flyTo(graph.fit.box, 1.4);
    }, [graph.fit.key]); // eslint-disable-line react-hooks/exhaustive-deps

    // Manual mode: when the pane changes size (feed panel toggled…) keep the centre and the zoom level.
    const prevSize = useRef({ width, height });
    useEffect(() => {
      const prev = prevSize.current;
      prevSize.current = { width, height };
      if (modeRef.current !== 'manual' || !prev.width || !prev.height || !width || !height) return;
      const b = boxRef.current;
      const scale = b[2] / prev.width;
      const cx = b[0] + b[2] / 2;
      const cy = b[1] + b[3] / 2;
      const w = scale * width;
      const h = scale * height;
      commitBox([cx - w / 2, cy - h / 2, w, h]);
    }, [width, height, commitBox]);

    const zoomAt = useCallback(
      (clientX: number, clientY: number, factor: number, base?: ViewBox) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        beginManual();
        const b = base ?? boxRef.current;
        const fx = (clientX - rect.left) / rect.width;
        const fy = (clientY - rect.top) / rect.height;
        const w = clamp(b[2] * factor, MIN_VIEW_W, fitWidth.current * MAX_ZOOM_OUT);
        const h = (w * b[3]) / b[2];
        const next: ViewBox = [b[0] + fx * b[2] - fx * w, b[1] + fy * b[3] - fy * h, w, h];
        if (base) commitBox(next);
        else flyTo(next, 0.14);
      },
      [beginManual, commitBox, flyTo],
    );

    // ── dragged company positions (session only) ──
    const [offsets, setOffsets] = useState<Map<string, Pos>>(() => new Map());

    // ── lookups ──
    const nodeIndex = useMemo(() => {
      const m = new Map<string, CompanyNode | FreelancerNode>();
      graph.companies.forEach((c) => m.set(c.id, c));
      graph.freelancers.forEach((f) => m.set(f.id, f));
      return m;
    }, [graph]);

    const at = (id: string): Pos => {
      const base = pos.get(id) ?? target.get(id) ?? { x: 0, y: 0 };
      const node = nodeIndex.get(id);
      const owner = node?.kind === 'freelancer' ? node.companyNodeId : id;
      const off = offsets.get(owner);
      return off ? { x: base.x + off.x, y: base.y + off.y } : base;
    };

    // ── imperative API ──
    const zoomBy = useCallback(
      (factor: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        beginManual();
        const b = boxRef.current;
        const w = clamp(b[2] * factor, MIN_VIEW_W, fitWidth.current * MAX_ZOOM_OUT);
        const h = (w * b[3]) / b[2];
        const cx = b[0] + b[2] / 2;
        const cy = b[1] + b[3] / 2;
        flyTo([cx - w / 2, cy - h / 2, w, h], 0.25);
      },
      [beginManual, flyTo],
    );

    const recenter = useCallback(() => {
      setCameraMode('auto');
      flyTo(graph.fit.box, 0.9);
    }, [flyTo, graph.fit.box, setCameraMode]);

    const focusNode = (nodeId: string) => {
      const node = nodeIndex.get(nodeId);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!node || !rect || rect.width === 0) return;
      beginManual();
      const p = at(nodeId);
      const w = node.kind === 'company' ? Math.max(MIN_VIEW_W, node.clusterRadius * 3.2) : 240;
      const h = (w * rect.height) / rect.width;
      flyTo([p.x - w / 2, p.y - h / 2, w, h], 0.9);
    };

    useImperativeHandle(ref, () => ({
      zoomBy,
      recenter,
      resetLayout: () => setOffsets(new Map()),
      focusNode,
    }));

    // ── wheel / trackpad zoom (needs a non-passive listener to stop the page scrolling) ──
    const [touched, setTouched] = useState(false);
    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const onWheel = (e: WheelEvent) => {
        if (scrollSafe && !(e.ctrlKey || e.metaKey)) return; // let the page scroll
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
        setTouched(true);
      };
      svg.addEventListener('wheel', onWheel, { passive: false });
      return () => svg.removeEventListener('wheel', onWheel);
    }, [scrollSafe, zoomAt]);

    // ── pointer: pan, drag a company, click, pinch ──
    const drag = useRef<DragState | null>(null);
    const pointers = useRef(new Map<number, Pos>());
    const pinch = useRef<{ dist: number; box: ViewBox } | null>(null);
    const [dragging, setDragging] = useState(false);
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);
    const hoverRef = useRef<string | null>(null);
    const hoverEdgeRef = useRef<string | null>(null);
    const lastPointer = useRef<Pos>({ x: 0, y: 0 });
    /** the node under the last pointer-down; a captured pointer reports the <svg> as the click target */
    const lastDownNode = useRef<string | null>(null);
    const lastDownEdge = useRef<string | null>(null);

    const nodeIdFrom = (target: EventTarget | null): string | null => {
      const el = (target as Element | null)?.closest?.('[data-node-id]');
      return el ? el.getAttribute('data-node-id') : null;
    };

    const edgeIdFrom = (target: EventTarget | null): string | null => {
      const el = (target as Element | null)?.closest?.('[data-edge-id]');
      return el ? el.getAttribute('data-edge-id') : null;
    };

    const placeTip = useCallback(() => {
      const tip = tipRef.current;
      const root = rootRef.current;
      if (!tip || !root) return;
      const rect = root.getBoundingClientRect();
      let x = lastPointer.current.x - rect.left + 16;
      const y = lastPointer.current.y - rect.top + 16;
      if (x + tip.offsetWidth + 8 > rect.width) x = lastPointer.current.x - rect.left - tip.offsetWidth - 16;
      tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.min(y, rect.height - tip.offsetHeight - 8)}px)`;
    }, []);

    const setHover = useCallback((id: string | null) => {
      if (hoverRef.current === id) return;
      hoverRef.current = id;
      setHoverId(id);
    }, []);

    const setHoverEdge = useCallback((id: string | null) => {
      if (hoverEdgeRef.current === id) return;
      hoverEdgeRef.current = id;
      setHoverEdgeId(id);
    }, []);

    useEffect(() => {
      if (hoverId || hoverEdgeId) placeTip();
    }, [hoverId, hoverEdgeId, placeTip]);

    const scaleNow = () => {
      const rect = svgRef.current?.getBoundingClientRect();
      return rect && rect.width > 0 ? boxRef.current[2] / rect.width : 1;
    };

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      svgRef.current?.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setHover(null);
      setHoverEdge(null);

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        beginManual();
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, box: boxRef.current };
        drag.current = null;
        setDragging(true);
        return;
      }
      lastDownNode.current = nodeIdFrom(e.target);
      lastDownEdge.current = lastDownNode.current ? null : edgeIdFrom(e.target);
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        nodeId: nodeIdFrom(e.target),
      };
    };

    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinch.current && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.current.dist / dist, pinch.current.box);
        return;
      }

      const d = drag.current;
      if (d && d.pointerId === e.pointerId) {
        if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
        if (!d.moved) {
          d.moved = true;
          setDragging(true);
          setTouched(true);
        }
        const dx = e.clientX - d.lastX;
        const dy = e.clientY - d.lastY;
        d.lastX = e.clientX;
        d.lastY = e.clientY;

        const draggedHub = d.nodeId && nodeIndex.get(d.nodeId)?.kind === 'company' ? d.nodeId : null;
        if (draggedHub) {
          const s = scaleNow();
          setOffsets((prev) => {
            const next = new Map(prev);
            const o = next.get(draggedHub) ?? { x: 0, y: 0 };
            next.set(draggedHub, { x: o.x + dx * s, y: o.y + dy * s });
            return next;
          });
        } else {
          beginManual();
          const s = scaleNow();
          const b = boxRef.current;
          commitBox([b[0] - dx * s, b[1] - dy * s, b[2], b[3]]);
        }
        return;
      }

      // plain hover (mouse only)
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        const nid = nodeIdFrom(e.target);
        setHover(nid);
        setHoverEdge(nid ? null : edgeIdFrom(e.target));
        placeTip();
      }
    };

    const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);

      const d = drag.current;
      if (d && d.pointerId === e.pointerId) {
        drag.current = null;
        if (!d.moved && e.type === 'pointerup') {
          const node = d.nodeId ? nodeIndex.get(d.nodeId) : null;
          if (node) {
            const same = selection?.id === node.id;
            onSelectionChange(same ? null : { kind: node.kind, id: node.id });
          } else if (lastDownEdge.current) {
            const edge = graph.edges.find((ed) => ed.id === lastDownEdge.current);
            if (edge) {
              const same = selection?.id === edge.from;
              onSelectionChange(same ? null : { kind: 'freelancer', id: edge.from });
            } else {
              onSelectionChange(null);
            }
          } else {
            onSelectionChange(null);
          }
        }
      }
      if (pointers.current.size === 0) setDragging(false);
    };

    const onDoubleClick = () => {
      const id = lastDownNode.current;
      const node = id ? nodeIndex.get(id) : undefined;
      if (!node) {
        recenter();
        return;
      }
      onSelectionChange({ kind: node.kind, id: node.id }); // the two clicks of a double-click toggled it off
      focusNode(node.id);
    };

    // ── focus / dimming ──
    const selectedId = selection && nodeIndex.has(selection.id) ? selection.id : null;
    const effectiveHoverId = hoverId ?? (externalHoverId && nodeIndex.has(externalHoverId) ? externalHoverId : null);
    const hoverNode = effectiveHoverId && !dragging ? nodeIndex.get(effectiveHoverId) : undefined;
    const hoverEdge = !hoverNode && hoverEdgeId && !dragging ? graph.edges.find((e) => e.id === hoverEdgeId) : undefined;
    const focusKind = selectedId ? selection!.kind : hoverNode?.kind ?? null;
    const focusId = selectedId ?? hoverNode?.id ?? null;
    const focus = useMemo(() => {
      if (hoverEdge && !selectedId) {
        return {
          nodes: new Set([hoverEdge.from, hoverEdge.to]),
          edges: new Set([hoverEdge.id]),
        };
      }
      return computeFocus(graph, focusKind && focusId ? { kind: focusKind, id: focusId } : null, categoryFilter);
    }, [graph, focusKind, focusId, categoryFilter, hoverEdge, selectedId]);

    // ── first paint builds itself up; later arrivals pop in on their own ──
    const introTriggeredRef = useRef(false);
    const [intro, setIntro] = useState(false);
    useEffect(() => {
      if (graph.companies.length === 0 || introTriggeredRef.current) return;
      introTriggeredRef.current = true;
      const frameId = requestAnimationFrame(() => setIntro(true));
      const timerId = setTimeout(() => setIntro(false), INTRO_MS);
      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timerId);
      };
    }, [graph.companies.length]);

    // world units per screen pixel -> constant on-screen text size at any zoom
    const pw = width > 0 ? box[2] / width : 1;

    const arrivalFreelancerId = arrival ? `f${arrival.hire.freelancer.id}` : null;
    const arrivalCompanyId = arrival ? `c${arrival.hire.company.id}` : null;
    const arrivalEdgeId = arrival ? `f${arrival.hire.freelancer.id}>c${arrival.hire.company.id}` : null;
    const arrivalFreelancer = arrivalFreelancerId ? (nodeIndex.get(arrivalFreelancerId) as FreelancerNode | undefined) : undefined;
    const arrivalCompany = arrivalCompanyId ? (nodeIndex.get(arrivalCompanyId) as CompanyNode | undefined) : undefined;

    const tipLines = useMemo(() => {
      if (hoverEdge && !hoverNode) {
        const from = nodeIndex.get(hoverEdge.from);
        const to = nodeIndex.get(hoverEdge.to);
        if (from && to) {
          return {
            title: `${from.label} → ${to.label}`,
            color: hoverEdge.color,
            sub: `${hoverEdge.weight} ${hoverEdge.weight === 1 ? 'hire' : 'hires'}`,
            hint: 'Click to inspect freelancer',
          };
        }
      }
      if (!hoverNode || !hoverId) return null;
      if (hoverNode.kind === 'company') {
        return {
          title: hoverNode.label,
          color: ACCENT,
          sub: `${hoverNode.hireCount} ${hoverNode.hireCount === 1 ? 'hire' : 'hires'} · ${hoverNode.memberCount} ${hoverNode.memberCount === 1 ? 'freelancer' : 'freelancers'}`,
          hint: 'Click to focus · drag to move',
        };
      }
      const employers = graph.edges
        .filter((e) => e.from === hoverNode.id)
        .map((e) => nodeIndex.get(e.to)?.label)
        .filter(Boolean)
        .join(', ');
      return { title: hoverNode.label, color: hoverNode.color, sub: hoverNode.category, hint: `Hired by ${employers}` };
    }, [hoverNode, hoverId, hoverEdge, graph.edges, nodeIndex]);

    const selectedNode = selectedId ? nodeIndex.get(selectedId) : undefined;
    const clusterReadable = selectedNode?.kind === 'company' ? selectedNode.clusterRadius / pw >= 100 : false;

    const clusterCompanies = useMemo(() => {
      const set = new Set<string>();
      for (const f of graph.freelancers) set.add(f.companyNodeId);
      return set;
    }, [graph.freelancers]);

    const cursor = dragging
      ? 'grabbing'
      : hoverNode
        ? hoverNode.kind === 'company'
          ? 'grab'
          : 'pointer'
        : hoverEdge
          ? 'pointer'
          : 'grab';

    return (
      <div ref={rootRef} className="relative h-full w-full overflow-hidden">
        <svg
          ref={svgRef}
          className="h-full w-full select-none"
          style={{ cursor, touchAction: scrollSafe ? 'pan-y' : 'none' }}
          viewBox={box.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Hiring network: ${graph.companies.length} companies, ${graph.freelancers.length} freelancers. Drag to pan, scroll to zoom.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={() => {
            setHover(null);
            setHoverEdge(null);
          }}
          onDoubleClick={onDoubleClick}
        >
          <defs>
            <radialGradient id={`${uid}-hub-bg`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="65%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
          </defs>

          {/* lines first, so dots and hubs sit on top */}
          <g>
            {graph.edges.map((edge) => {
              const from = nodeIndex.get(edge.from) as FreelancerNode | undefined;
              if (!from || !nodeIndex.has(edge.to)) return null;
              const a = at(edge.from);
              const b = at(edge.to);
              const emph = !!focus?.edges.has(edge.id);
              return (
                <Edge
                  key={edge.id}
                  id={edge.id}
                  color={edge.color}
                  weight={edge.weight}
                  freelancerId={edge.freelancerId}
                  ax={a.x}
                  ay={a.y}
                  bx={b.x}
                  by={b.y}
                  curved={from.companyNodeId !== edge.to}
                  today={edge.latestHiredAt >= todayStart}
                  fresh={edge.id === arrivalEdgeId}
                  dim={!!focus && !emph}
                  emph={emph}
                  pw={pw}
                />
              );
            })}
          </g>

          <g>
            {graph.freelancers.map((node, i) => {
              const p = at(node.id);
              const isArrival = node.id === arrivalFreelancerId;
              return (
                <Dot
                  key={node.id}
                  node={node}
                  x={p.x}
                  y={p.y}
                  today={node.latestHiredAt >= todayStart}
                  appear={intro || isArrival}
                  delay={intro ? Math.min(i * 0.006, 1.8) : 0}
                  dim={!!focus && !focus.nodes.has(node.id)}
                  selected={node.id === selectedId}
                  hovered={!dragging && effectiveHoverId === node.id}
                  pw={pw}
                />
              );
            })}
          </g>

          <g>
            {graph.companies.map((node, i) => {
              const p = at(node.id);
              const hasClusterRing = clusterCompanies.has(node.id);
              // For hubs without their own cluster ring, place the pill above if their links go downward
              let labelAbove = false;
              if (!hasClusterRing) {
                let sumY = 0;
                let count = 0;
                for (const e of graph.edges) {
                  if (e.to === node.id) {
                    sumY += at(e.from).y;
                    count++;
                  }
                }
                if (count > 0 && sumY / count > p.y) labelAbove = true;
              }
              return (
                <Hub
                  key={node.id}
                  node={node}
                  x={p.x}
                  y={p.y}
                  today={node.latestHiredAt >= todayStart}
                  appear={intro || node.id === arrivalCompanyId}
                  delay={intro ? Math.min(i * 0.04, 1) : 0}
                  showLabel
                  hasClusterRing={hasClusterRing}
                  labelAbove={labelAbove}
                  dim={!!focus && !focus.nodes.has(node.id)}
                  selected={node.id === selectedId}
                  hovered={!dragging && effectiveHoverId === node.id}
                  pw={pw}
                  clipId={`${uid}-${node.id}`}
                  gradId={`${uid}-hub-bg`}
                />
              );
            })}
          </g>

          {!compact && (
            <g pointerEvents="none">
              {graph.freelancers
                .filter(
                  (node) =>
                    node.id === arrivalFreelancerId ||
                    node.id === selectedId ||
                    (!focus && labelledFreelancers?.has(node.entityId)) ||
                    (clusterReadable && !!focus && focus.nodes.has(node.id)),
                )
                .map((node) => {
                  const p = at(node.id);
                  return <DotLabel key={node.id} node={node} x={p.x} y={p.y} pw={pw} />;
                })}
            </g>
          )}

          {/* "someone was just hired" */}
          {arrival && arrivalCompany && (
            <Pulse
              key={`pc-${arrival.hire.hireId}`}
              {...at(arrivalCompany.id)}
              r={hubRadius(arrivalCompany)}
              color={ACCENT}
              pw={pw}
              maxGrow={arrivalCompany.clusterRadius * 0.9}
            />
          )}
          {arrival && arrivalFreelancer && (
            <Pulse
              key={`pf-${arrival.hire.hireId}`}
              {...at(arrivalFreelancer.id)}
              r={arrivalFreelancer.r * DOT_SCALE}
              color={arrivalFreelancer.color}
              pw={pw}
              maxGrow={60}
            />
          )}
        </svg>

        {/* hover card */}
        {tipLines && (
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[18rem] rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur"
            style={{ transform: 'translate(-9999px,-9999px)' }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-50">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tipLines.color }} />
              <span className="truncate">{tipLines.title}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-300">{tipLines.sub}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{tipLines.hint}</p>
          </div>
        )}

        {/* zoom / framing controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button type="button" className={toolBtn} onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom in" title="Zoom in (+)">
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={toolBtn} onClick={() => zoomBy(1.5)} aria-label="Zoom out" title="Zoom out (−)">
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`${toolBtn} ${mode === 'manual' ? 'border-sky-400/60 text-sky-300' : ''}`}
            onClick={recenter}
            aria-label="Fit everything"
            title="Fit everything (0 or double-click)"
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
          </button>
          {offsets.size > 0 && (
            <button
              type="button"
              className={toolBtn}
              onClick={() => setOffsets(new Map())}
              aria-label="Reset moved companies"
              title="Reset moved companies"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {!compact && !touched && (
          <p className="pointer-events-none absolute bottom-4 right-16 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-400 backdrop-blur">
            Drag to pan · scroll to zoom · drag a company to move it · click to focus · double-click to zoom in
          </p>
        )}
      </div>
    );
  },
);
