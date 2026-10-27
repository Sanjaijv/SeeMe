import type { Edge, ParsedFile } from "./types";

export type ModuleNode = {
  id: string;
  path: string;
  label: string;
  files: string[];
  fanIn: number;
  fanOut: number;
};

export type ModuleEdge = {
  from: string;
  to: string;
  fromFile: string;
  toFile: string;
};

type WorkingNode = {
  path: string;
  files: string[];
};

function parentPath(folder: string): string | null {
  if (folder === ".") return null;
  const parent = folder.slice(0, folder.lastIndexOf("/"));
  return parent || ".";
}

function initialNodes(files: ParsedFile[]): WorkingNode[] {
  const grouped = new Map<string, string[]>();
  for (const file of files) {
    const paths = grouped.get(file.folder) ?? [];
    paths.push(file.path);
    grouped.set(file.folder, paths);
  }
  return [...grouped.entries()]
    .map(([path, nodeFiles]) => ({ path, files: nodeFiles.sort() }))
    .sort((a, b) => b.path.split("/").length - a.path.split("/").length);
}

function foldAtThreshold(files: ParsedFile[], threshold: number): WorkingNode[] {
  const byPath = new Map(
    initialNodes(files).map((node) => [node.path, node]),
  );

  let changed = true;
  while (changed) {
    changed = false;
    const candidates = [...byPath.values()]
      .filter((node) => node.files.length < threshold && node.path !== ".")
      .sort((a, b) => b.path.split("/").length - a.path.split("/").length);

    for (const node of candidates) {
      if (!byPath.has(node.path)) continue;
      const parent = parentPath(node.path);
      if (!parent) continue;
      const parentNode = byPath.get(parent) ?? { path: parent, files: [] };
      parentNode.files.push(...node.files);
      parentNode.files.sort();
      byPath.set(parent, parentNode);
      byPath.delete(node.path);
      changed = true;
    }
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function nodeCountAtThreshold(files: ParsedFile[], threshold: number): number {
  return foldAtThreshold(files, threshold).length;
}

export function foldModules(files: ParsedFile[]): ModuleNode[] {
  if (files.length === 0) return [];

  let threshold = 2;
  while (nodeCountAtThreshold(files, threshold) > 24) threshold += 1;
  const folded = foldAtThreshold(files, threshold);
  const fileByPath = new Map(files.map((file) => [file.path, file]));

  return folded.map((node) => {
    const fanIn = node.files.reduce(
      (total, file) => total + (fileByPath.get(file)?.fanIn ?? 0),
      0,
    );
    const fanOut = node.files.reduce(
      (total, file) => total + (fileByPath.get(file)?.fanOut ?? 0),
      0,
    );
    return {
      id: node.path,
      path: node.path,
      label: node.path === "." ? "root" : node.path.split("/").at(-1) ?? node.path,
      files: node.files,
      fanIn,
      fanOut,
    };
  });
}

export function connectModules(
  nodes: ModuleNode[],
  edges: Edge[],
): ModuleEdge[] {
  const nodeByFile = new Map<string, string>();
  for (const node of nodes) {
    for (const file of node.files) nodeByFile.set(file, node.id);
  }

  const seen = new Set<string>();
  const result: ModuleEdge[] = [];
  for (const edge of edges) {
    const from = nodeByFile.get(edge.from);
    const to = nodeByFile.get(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}\0${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ from, to, fromFile: edge.from, toFile: edge.to });
  }
  return result;
}
