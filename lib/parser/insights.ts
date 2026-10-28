import type { Edge, ParsedFile } from "./types";

export type InsightKind =
  | "unimported"
  | "cycle"
  | "high-fan-in"
  | "long-file";

export type Insight = {
  kind: InsightKind;
  sentence: string;
  files: string[];
};

const LONG_FILE_LINE_THRESHOLD = 500;

function isFrameworkEntry(file: ParsedFile): boolean {
  if (file.moduleKind === "config" || file.adapterRole !== null) return true;
  return /(^|\/)(app|pages)\/.*(?:page|route|layout)\.(?:[cm]?[jt]sx?)$/.test(
    file.path,
  ) || /(^|\/)(middleware|next\.config|vite\.config|webpack\.config)/.test(
    file.path,
  );
}

function cycleFiles(files: ParsedFile[], edges: Edge[]): string[] {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbours = outgoing.get(edge.from) ?? [];
    neighbours.push(edge.to);
    outgoing.set(edge.from, neighbours);
    const predecessors = incoming.get(edge.to) ?? [];
    predecessors.push(edge.from);
    incoming.set(edge.to, predecessors);
  }

  const visited = new Set<string>();
  const order: string[] = [];
  for (const file of files) {
    if (visited.has(file.path)) continue;
    const stack: Array<{ node: string; nextIndex: number }> = [
      { node: file.path, nextIndex: 0 },
    ];
    visited.add(file.path);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbours = outgoing.get(frame.node) ?? [];
      const neighbour = neighbours[frame.nextIndex];
      if (neighbour && !visited.has(neighbour)) {
        visited.add(neighbour);
        stack.push({ node: neighbour, nextIndex: 0 });
      } else if (frame.nextIndex < neighbours.length) {
        frame.nextIndex += 1;
      } else {
        order.push(frame.node);
        stack.pop();
      }
    }
  }

  const assigned = new Set<string>();
  const cyclic = new Set<string>();
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const start = order[index];
    if (assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      component.push(node);
      for (const predecessor of incoming.get(node) ?? []) {
        if (assigned.has(predecessor)) continue;
        assigned.add(predecessor);
        stack.push(predecessor);
      }
    }

    if (
      component.length > 1 ||
      (component.length === 1 &&
        (outgoing.get(component[0]) ?? []).includes(component[0]))
    ) {
      for (const node of component) cyclic.add(node);
    }
  }
  return [...cyclic].sort();
}

function highFanInFiles(files: ParsedFile[]): string[] {
  if (files.length === 0) return [];
  const average = files.reduce((total, file) => total + file.fanIn, 0) / files.length;
  const variance =
    files.reduce((total, file) => total + (file.fanIn - average) ** 2, 0) /
    files.length;
  const threshold = Math.max(3, average + Math.sqrt(variance));
  return files
    .filter((file) => file.fanIn > threshold)
    .sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path))
    .map((file) => file.path);
}

export function findInsights(files: ParsedFile[], edges: Edge[]): Insight[] {
  const unimported = files
    .filter((file) => file.fanIn === 0 && !isFrameworkEntry(file))
    .map((file) => file.path)
    .sort();
  const cycles = cycleFiles(files, edges);
  const highFanIn = highFanInFiles(files);
  const longFiles = files
    .filter((file) => file.lines >= LONG_FILE_LINE_THRESHOLD)
    .sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path))
    .map((file) => file.path);

  return [
    { kind: "unimported", sentence: "Nothing imports this file.", files: unimported },
    { kind: "cycle", sentence: "This file is part of an import cycle.", files: cycles },
    { kind: "high-fan-in", sentence: "Many files import this file.", files: highFanIn },
    { kind: "long-file", sentence: "This file is unusually long.", files: longFiles },
  ];
}
