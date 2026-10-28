import { useMemo, useState } from "react";

import type { Edge, ParsedFile } from "@/lib/parser/types";
import { traverseGraph } from "@/lib/parser/graph";
import { findInsights } from "@/lib/parser/insights";

type Selection =
  | { type: "node"; id: string }
  | { type: "file"; id: string }
  | null;

type DetailProps = {
  files: ParsedFile[];
  edges: Edge[];
  adapter: string;
  root: string;
  totalImports: number;
  skippedCount: number;
  selection: Selection;
  selectedNodeFiles: string[] | null;
  highlightedNode: string | null;
  highlightedFile: string | null;
  onSelectFile: (path: string) => void;
  onHoverFile: (path: string | null) => void;
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
      {children}
    </h3>
  );
}

function FileLink({
  path,
  highlightedFile,
  onSelect,
  onHover,
  displayLabel,
}: {
  path: string;
  displayLabel?: string;
  highlightedFile: string | null;
  onSelect: (path: string) => void;
  onHover: (path: string | null) => void;
}) {
  return (
    <button
      className={`block w-full truncate px-2 py-1 text-left font-mono text-[10px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent hover:bg-panel-strong ${
        highlightedFile === path ? "bg-accent/10 text-accent" : "text-muted"
      }`}
      onClick={() => onSelect(path)}
      onMouseEnter={() => onHover(path)}
      onMouseLeave={() => onHover(null)}
      type="button"
    >
      {displayLabel ?? path}
    </button>
  );
}

export function RepositoryDetail({
  files,
  edges,
  adapter,
  root,
  totalImports,
  skippedCount,
  selection,
  selectedNodeFiles,
  highlightedNode,
  highlightedFile,
  onSelectFile,
  onHoverFile,
}: DetailProps) {
  const [activeTab, setActiveTab] = useState<"structure" | "explanation">(
    "structure",
  );
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const selectedFile =
    selection?.type === "file" ? fileByPath.get(selection.id) : null;
  const dependencies = selectedFile
    ? edges.filter((edge) => edge.from === selectedFile.path).map((edge) => edge.to)
    : [];
  const dependents = selectedFile
    ? edges.filter((edge) => edge.to === selectedFile.path).map((edge) => edge.from)
    : [];
  const selectedNode = selection?.type === "node" ? selectedNodeFiles : null;
  const rootName = root.split("/").at(-1) ?? root;
  const topDependencies = [...files]
    .filter((file) => file.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path))
    .slice(0, 5);
  const insights = useMemo(() => findInsights(files, edges), [edges, files]);
  const unimportedFiles = new Set(
    insights.find((insight) => insight.kind === "unimported")?.files ?? [],
  );
  const unimported = files
    .filter((file) => unimportedFiles.has(file.path))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 5);
  const routeCount = files.filter((file) =>
    /(^|\/)(app|pages)\/.*(page|route)\.(tsx?|jsx?)$/.test(file.path),
  ).length;
  const [activeGraph, setActiveGraph] = useState<"blast" | "dependencies" | null>(
    null,
  );
  const graphFiles = selectedFile && activeGraph
    ? [...traverseGraph(
        selectedFile.path,
        edges,
        activeGraph === "blast" ? "reverse" : "forward",
      )].sort()
    : [];

  return (
    <aside className="min-w-0 overflow-y-auto border-l border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Details
        </h2>
        {selection ? (
          <span className="font-mono text-[10px] text-accent">selected</span>
        ) : highlightedNode ? (
          <span className="max-w-28 truncate font-mono text-[10px] text-accent">
            {highlightedNode}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex border-b border-border" role="tablist">
        {(["structure", "explanation"] as const).map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={`border-b-2 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.1em] focus-visible:outline-2 focus-visible:outline-accent ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-muted"
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab === "explanation" ? (
        <p className="mt-4 border border-dashed border-border px-3 py-4 text-[11px] leading-5 text-muted">
          Explanations will appear here when the model is connected.
        </p>
      ) : selectedFile ? (
        <div className="mt-4 space-y-5">
          <div>
            <p className="break-all font-mono text-xs font-semibold text-foreground">
              {selectedFile.path}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
              <div><dt className="text-muted">kind</dt><dd>{selectedFile.moduleKind}</dd></div>
              <div><dt className="text-muted">lines</dt><dd>{selectedFile.lines}</dd></div>
              <div><dt className="text-muted">imports</dt><dd>{dependencies.length}</dd></div>
              <div><dt className="text-muted">dependents</dt><dd>{dependents.length}</dd></div>
            </dl>
          </div>
          <div>
            <SectionTitle>Imports</SectionTitle>
            <div>{dependencies.map((path) => <FileLink key={path} path={path} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />)}</div>
          </div>
          <div>
            <SectionTitle>Imported by</SectionTitle>
            <div>{dependents.map((path) => <FileLink key={path} path={path} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />)}</div>
          </div>
          <div className="flex gap-2">
            {(["blast", "dependencies"] as const).map((kind) => (
              <button
                className={`border px-2 py-1 font-mono text-[10px] ${
                  activeGraph === kind
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:bg-panel-strong"
                }`}
                key={kind}
                onClick={() => setActiveGraph(activeGraph === kind ? null : kind)}
                type="button"
              >
                {kind === "blast" ? "Blast radius" : "Dependency chain"}
              </button>
            ))}
          </div>
          {activeGraph ? (
            <div>
              <SectionTitle>
                {activeGraph === "blast" ? "Breaks if changed" : "Needs"}
              </SectionTitle>
              {graphFiles.map((path) => (
                <FileLink key={path} path={path} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />
              ))}
            </div>
          ) : null}
        </div>
      ) : selectedNode ? (
        <div className="mt-4">
          <p className="font-mono text-xs font-semibold text-foreground">
            {selection?.id === "." ? "root" : selection?.id}
          </p>
          <SectionTitle>Files by kind</SectionTitle>
          <dl className="space-y-2 font-mono text-[10px]">
            {(["source", "declaration", "config"] as const).map((kind) => (
              <div className="flex justify-between" key={kind}>
                <dt className="text-muted">{kind}</dt>
                <dd>{selectedNode.filter((path) => fileByPath.get(path)?.moduleKind === kind).length}</dd>
              </div>
            ))}
          </dl>
          <SectionTitle>Files</SectionTitle>
          {selectedNode.map((path) => <FileLink key={path} path={path} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />)}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <section>
            <SectionTitle>Repository</SectionTitle>
            <p className="font-mono text-xs font-semibold">{rootName}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
              <div><dt className="text-muted">framework</dt><dd>{adapter === "fallback" ? "not detected" : adapter}</dd></div>
              <div><dt className="text-muted">files</dt><dd>{files.length}</dd></div>
              <div><dt className="text-muted">imports</dt><dd>{totalImports}</dd></div>
              <div><dt className="text-muted">routes</dt><dd>{routeCount}</dd></div>
            </dl>
          </section>
          <section>
            <SectionTitle>Most depended on</SectionTitle>
            {topDependencies.map((file) => <FileLink key={file.path} path={file.path} displayLabel={`${file.path}  ${file.fanIn}`} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />)}
          </section>
          <section>
            <SectionTitle>Nothing imports</SectionTitle>
            {unimported.map((file) => <FileLink key={file.path} path={file.path} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />)}
          </section>
          <p className="font-mono text-[10px] text-muted">{skippedCount} files had no identified convention.</p>
          <section>
            <SectionTitle>Insights</SectionTitle>
            <div className="space-y-2">
              {insights.map((insight) => (
                <details className="border border-border" key={insight.kind}>
                  <summary className="cursor-pointer list-none px-2 py-2 font-mono text-[10px] text-muted">
                    <span className="text-foreground">{insight.files.length}</span>{" "}
                    {insight.kind}
                  </summary>
                  <div className="border-t border-border px-2 py-2">
                    <p className="font-mono text-[10px] text-muted">{insight.sentence}</p>
                    {insight.files.map((path) => (
                      <FileLink key={path} path={path} highlightedFile={highlightedFile} onSelect={onSelectFile} onHover={onHoverFile} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
