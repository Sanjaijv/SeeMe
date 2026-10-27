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

function foldAtThreshold(
  files: ParsedFile[],
  threshold: number,
  maxNodes = Number.POSITIVE_INFINITY,
): WorkingNode[] {
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

  while (byPath.size > maxNodes) {
    const candidates = [...byPath.values()]
      .filter((node) => node.path !== "." && byPath.has(parentPath(node.path) ?? ""))
      .sort(
        (a, b) =>
          a.files.length - b.files.length ||
          b.path.split("/").length - a.path.split("/").length ||
          a.path.localeCompare(b.path),
      );
    const node = candidates[0];
    if (!node) break;
    const parent = parentPath(node.path);
    if (!parent) break;
    const parentNode = byPath.get(parent);
    if (!parentNode) break;
    parentNode.files.push(...node.files);
    parentNode.files.sort();
    byPath.delete(node.path);
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function foldModules(files: ParsedFile[]): ModuleNode[] {
  if (files.length === 0) return [];

  const threshold = 2;
  const folded = foldAtThreshold(files, threshold, 24);
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

  const result: ModuleEdge[] = [];
  for (const edge of edges) {
    const from = nodeByFile.get(edge.from);
    const to = nodeByFile.get(edge.to);
    if (!from || !to || from === to) continue;
    result.push({ from, to, fromFile: edge.from, toFile: edge.to });
  }
  return result;
}
