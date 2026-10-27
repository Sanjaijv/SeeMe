"use client";

import { useMemo, useRef, useState } from "react";

import type { Edge, ParsedFile } from "@/lib/parser/types";
import {
  connectModules,
  foldModules,
} from "@/lib/parser/folding";
import analysis from "@/data/analysis.json";
import { RepositoryDetail } from "@/components/repository-detail";

const categoryColors: Record<ParsedFile["moduleKind"], string> = {
  source: "bg-accent",
  declaration: "bg-emerald-500",
  config: "bg-amber-500",
};

function shortPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function ModuleCanvas({
  files,
  edges,
  totalImports,
}: {
  files: ParsedFile[];
  edges: Edge[];
  totalImports: number;
}) {
  const [openNode, setOpenNode] = useState<string | null>(null);
  const [selection, setSelection] = useState<
    { type: "node"; id: string } | { type: "file"; id: string } | null
  >(null);
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => foldModules(files), [files]);
  const moduleEdges = useMemo(() => connectModules(nodes, edges), [nodes, edges]);
  const fileToNode = useMemo(
    () => new Map(nodes.flatMap((node) => node.files.map((file) => [file, node.id]))),
    [nodes],
  );
  const selectedNode =
    selection?.type === "node"
      ? selection.id
      : selection?.type === "file"
        ? fileToNode.get(selection.id) ?? null
        : null;
  const activeFiles = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "node") {
      const active = new Set<string>();
      const activeNodeIds = new Set([selection.id]);
      for (const edge of moduleEdges) {
        if (edge.from === selection.id) activeNodeIds.add(edge.to);
        if (edge.to === selection.id) activeNodeIds.add(edge.from);
      }
      for (const node of nodes) {
        if (activeNodeIds.has(node.id)) {
          for (const file of node.files) active.add(file);
        }
      }
      return active;
    }

    const active = new Set([selection.id]);
    for (const edge of edges) {
      if (edge.from === selection.id) active.add(edge.to);
      if (edge.to === selection.id) active.add(edge.from);
    }
    return active;
  }, [edges, moduleEdges, nodes, selection]);
  const activeNodes = useMemo(() => {
    if (!selectedNode) return null;
    const active = new Set([selectedNode]);
    if (selection?.type === "node") {
      for (const edge of moduleEdges) {
        if (edge.from === selectedNode) active.add(edge.to);
        if (edge.to === selectedNode) active.add(edge.from);
      }
    } else if (activeFiles) {
      for (const file of activeFiles) {
        const node = fileToNode.get(file);
        if (node) active.add(node);
      }
    }
    return active;
  }, [activeFiles, fileToNode, moduleEdges, selectedNode, selection]);
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
  const nodeHeights = nodes.map((node) =>
    openNode === node.id
      ? 300
      : Math.min(190, 74 + node.fanIn * 12),
  );
  const rowHeights = Array.from(
    { length: Math.ceil(nodes.length / columns) },
    (_, row) =>
      Math.max(...nodeHeights.slice(row * columns, (row + 1) * columns)),
  );
  const positions = new Map<string, { x: number; y: number }>();
  let rowTop = 80;
  for (let row = 0; row < rowHeights.length; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const node = nodes[row * columns + column];
      if (node) positions.set(node.id, { x: 100 + column * 280, y: rowTop });
    }
    rowTop += rowHeights[row] + 52;
  }
  const canvasHeight = Math.max(760, rowTop + 40);
  const endpoint = (nodeId: string, file: string): { x: number; y: number } => {
    const position = positions.get(nodeId);
    const node = nodes.find((item) => item.id === nodeId);
    if (!position || !node || openNode !== nodeId) {
      return { x: (position?.x ?? 0) + 92, y: (position?.y ?? 0) + 46 };
    }
    const fileIndex = node.files.indexOf(file);
    return {
      x: position.x + 92,
      y: position.y + 46 + Math.max(0, fileIndex) * 25 + 12,
    };
  };

  return (
    <>
    <main className="relative min-w-0 overflow-auto bg-background">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 border border-border bg-panel/95 px-3 py-2 font-mono text-[11px] text-muted">
        <span className="text-foreground">{nodes.length} modules</span>
        <span>{files.length} files</span>
        <span>{moduleEdges.length} connections</span>
      </div>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-0 h-full w-[940px]"
        height={canvasHeight}
        width="940"
      >
        {moduleEdges.map((edge) => {
          const from = endpoint(edge.from, edge.fromFile);
          const to = endpoint(edge.to, edge.toFile);
          const dimmed =
            selection?.type === "file"
              ? edge.fromFile !== selection.id && edge.toFile !== selection.id
              : activeNodes !== null &&
                (!activeNodes.has(edge.from) || !activeNodes.has(edge.to));
          return (
            <line
              className={dimmed ? "stroke-border/70" : "stroke-amber-400"}
              key={`${edge.from}\0${edge.to}\0${edge.fromFile}\0${edge.toFile}`}
              opacity={dimmed ? 0.65 : 1}
              strokeWidth={dimmed ? 1.5 : 2.5}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
          );
        })}
      </svg>
      <div
        ref={canvasRef}
        onClick={() => setSelection(null)}
        className="relative z-10 w-[940px]"
        style={{ height: canvasHeight }}
      >
        {nodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;
          const isOpen = openNode === node.id;
          const isDimmed = activeNodes !== null && !activeNodes.has(node.id);
          return (
            <section
              data-node-id={node.id}
              onClick={(event) => event.stopPropagation()}
              onMouseEnter={() => {
                setHighlightedNode(node.id);
                setHighlightedFile(node.files[0] ?? null);
              }}
              onMouseLeave={() => {
                setHighlightedFile(null);
                setHighlightedNode(null);
              }}
              className={`absolute w-44 border bg-panel shadow-sm transition-opacity ${
                isDimmed ? "opacity-45" : "opacity-100"
              } ${
                isOpen ||
                (highlightedFile !== null && node.files.includes(highlightedFile))
                  ? "border-accent"
                  : "border-border"
              }`}
              key={node.id}
              style={{ left: position.x, minHeight: nodeHeights[nodes.indexOf(node)], top: position.y }}
            >
              <button
                className="block w-full border-b border-border px-3 py-2 text-left hover:bg-panel-strong"
                onClick={() => {
                  setSelection({ type: "node", id: node.id });
                  if (!isOpen) {
                    setOpenNode(node.id);
                    requestAnimationFrame(() => {
                      canvasRef.current
                        ?.querySelector<HTMLElement>(
                          `[data-node-id="${node.id}"]`,
                        )
                        ?.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        });
                    });
                  } else {
                    setOpenNode(null);
                  }
                }}
                type="button"
              >
                <span className="block truncate font-mono text-xs font-semibold text-foreground">
                  {node.label}
                </span>
                <span className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                  <span>{node.files.length} files</span>
                  <span>in {node.fanIn} / out {node.fanOut}</span>
                </span>
              </button>
              {isOpen ? (
                <div className="max-h-60 overflow-y-auto">
                  {node.files.map((file) => {
                    const parsedFile = files.find((item) => item.path === file);
                    return (
                      <button
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[10px] hover:bg-panel-strong ${
                          activeFiles && !activeFiles.has(file)
                            ? "opacity-25"
                            : highlightedFile === file
                              ? "bg-accent/20 text-accent"
                            : selection?.type === "file" && selection.id === file
                              ? "bg-accent/10 text-accent"
                              : "text-muted"
                        }`}
                        key={file}
                        onClick={() => setSelection({ type: "file", id: file })}
                        onMouseEnter={() => setHighlightedFile(file)}
                        onMouseLeave={() => {
                          setHighlightedFile(null);
                          setHighlightedNode(null);
                        }}
                        type="button"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            categoryColors[parsedFile?.moduleKind ?? "source"]
                          }`}
                        />
                        <span className="truncate">{shortPath(file)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
    <RepositoryDetail
      adapter={analysis.adapter}
      edges={edges}
      files={files}
      highlightedFile={highlightedFile}
      highlightedNode={highlightedNode}
      onHoverFile={setHighlightedFile}
      onSelectFile={(path) => {
        setSelection({ type: "file", id: path });
        setOpenNode(fileToNode.get(path) ?? null);
      }}
      root={analysis.root}
      totalImports={totalImports}
      selectedNodeFiles={
        selection?.type === "node"
          ? nodes.find((node) => node.id === selection.id)?.files ?? null
          : null
      }
      selection={selection}
      skippedCount={files.filter((file) => file.adapterRole === null).length}
    />
    </>
  );
}
