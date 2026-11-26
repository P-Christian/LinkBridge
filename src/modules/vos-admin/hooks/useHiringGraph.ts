// src/modules/vos-admin/hooks/useHiringGraph.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HireEvent, HiringGraph } from '../types/hiring-map.types';
import { buildCategoryColors, buildHiringGraph } from '../lib/hiring-map/hiring-graph';

export interface ElementSize {
  width: number;
  height: number;
}

/** Callback-ref + live pixel size of an element (ResizeObserver). */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;
    const measure = () => {
      const next = { width: node.clientWidth, height: node.clientHeight };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };

    // Avoid synchronous setState within effect to prevent cascading render warnings
    const frameId = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [node]);

  return { ref: setNode, size };
}

/**
 * Builds the graph for the visible hires. Colours come from ALL hires so a
 * category keeps its colour when the time range changes.
 */
export function useHiringGraph(visible: readonly HireEvent[], all: readonly HireEvent[], size: ElementSize) {
  const categoryColors = useMemo(() => buildCategoryColors(all), [all]);
  // Round the aspect so a 1px resize does not re-layout the whole graph.
  const aspect = size.width > 0 && size.height > 0 ? Math.round((size.width / size.height) * 20) / 20 : 16 / 9;
  const graph: HiringGraph = useMemo(
    () => buildHiringGraph(visible, { aspect, categoryColors }),
    [visible, aspect, categoryColors],
  );
  return { graph, categoryColors };
}

