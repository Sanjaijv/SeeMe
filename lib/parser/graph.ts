import type { Edge, ParsedFile } from "./types";

export type GraphDirection = "forward" | "reverse";

export function traverseGraph(
  start: string,
  edges: Edge[],
  direction: GraphDirection,
  maxDepth = 2,
): Set<string> {
  const adjacent = new Map<string, string[]>();
  for (const edge of edges) {
    const from = direction === "forward" ? edge.from : edge.to;
    const to = direction === "forward" ? edge.to : edge.from;
    const neighbours = adjacent.get(from) ?? [];
    neighbours.push(to);
    adjacent.set(from, neighbours);
  }

  const reached = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [
    { path: start, depth: 0 },
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;
    for (const neighbour of adjacent.get(current.path) ?? []) {
      if (reached.has(neighbour)) continue;
      reached.add(neighbour);
      queue.push({ path: neighbour, depth: current.depth + 1 });
    }
  }
  return reached;
}

export function addGraphMetrics(files: ParsedFile[], edges: Edge[]): void {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();

  for (const edge of edges) {
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
  }

  for (const file of files) {
    file.fanIn = fanIn.get(file.path) ?? 0;
    file.fanOut = fanOut.get(file.path) ?? 0;
  }
}
