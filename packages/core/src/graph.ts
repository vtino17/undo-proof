import type { AgentAction } from "./types.js";

export interface GraphResult {
  order: string[];
  missing: Array<{ actionId: string; dependencyId: string }>;
  cycle: string[];
}

export function analyzeGraph(actions: AgentAction[]): GraphResult {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const missing: GraphResult["missing"] = [];
  for (const action of actions) {
    for (const dependencyId of action.dependsOn) {
      if (!byId.has(dependencyId)) missing.push({ actionId: action.id, dependencyId });
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];
  const cycle: string[] = [];

  function visit(id: string, trail: string[]): void {
    if (visited.has(id) || cycle.length > 0) return;
    if (visiting.has(id)) {
      const start = trail.indexOf(id);
      cycle.push(...trail.slice(start), id);
      return;
    }
    visiting.add(id);
    const action = byId.get(id);
    for (const dependency of action?.dependsOn ?? []) {
      if (byId.has(dependency)) visit(dependency, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const action of actions) visit(action.id, []);
  return { order, missing, cycle };
}
