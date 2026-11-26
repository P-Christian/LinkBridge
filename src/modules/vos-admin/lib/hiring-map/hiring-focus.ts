// src/modules/vos-admin/lib/hiring-map/hiring-focus.ts
//
// Which nodes and lines stay bright when something is selected, hovered or a
// category is picked in the legend. Everything else fades back.
import type { GraphSelection, HiringGraph } from '../../types/hiring-map.types';

export interface GraphFocus {
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export function computeFocus(
  graph: HiringGraph,
  selection: GraphSelection | null,
  category: string | null,
): GraphFocus | null {
  const nodes = new Set<string>();
  const edges = new Set<string>();

  if (selection?.kind === 'company') {
    nodes.add(selection.id);
    for (const e of graph.edges) {
      if (e.to !== selection.id) continue;
      edges.add(e.id);
      nodes.add(e.from);
    }
    return { nodes, edges };
  }

  if (selection?.kind === 'freelancer') {
    nodes.add(selection.id);
    for (const e of graph.edges) {
      if (e.from !== selection.id) continue;
      edges.add(e.id);
      nodes.add(e.to);
    }
    return { nodes, edges };
  }

  if (category) {
    for (const f of graph.freelancers) if (f.category === category) nodes.add(f.id);
    for (const e of graph.edges) {
      if (!nodes.has(e.from)) continue;
      edges.add(e.id);
      nodes.add(e.to);
    }
    return { nodes, edges };
  }

  return null;
}
