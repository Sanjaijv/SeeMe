import type { Edge, ParsedFile } from "./types";

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
