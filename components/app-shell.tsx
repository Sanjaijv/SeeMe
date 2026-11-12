"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Link from "next/link";

import { OrganizationControls } from "@/components/organization-controls";
import { ThemeControl } from "@/components/theme-control";
import type { ParsedFile } from "@/lib/parser/types";
import { genericTaxonomyForModuleKind, taxonomyForAdapter } from "@/lib/parser/taxonomy";

type Category = string;
const CategoryContext = createContext<Category | null>(null);
const WorkspaceContext = createContext<{
  adapter: string;
  files: ParsedFile[];
  setWorkspace: (adapter: string, files: ParsedFile[]) => void;
} | null>(null);

export function useActiveCategory(): Category | null {
  return useContext(CategoryContext);
}

export function AppShell({
  children,
  files = [],
}: {
  children: ReactNode;
  files?: ParsedFile[];
}) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [workspace, setWorkspaceState] = useState({ adapter: "fallback", files });
  const taxonomy = workspace.adapter === "fallback"
    ? genericTaxonomyForModuleKind()
    : taxonomyForAdapter(workspace.adapter);
  const categories = taxonomy.categories.map((kind) => ({
    kind,
    count: workspace.files.filter((file) =>
      workspace.adapter === "fallback" ? file.moduleKind === kind : file.adapterRole === kind,
    ).length,
  }));
  const setWorkspace = useCallback(
    (adapter: string, nextFiles: ParsedFile[]) => setWorkspaceState({ adapter, files: nextFiles }),
    [],
  );

  return (
    <div className="min-h-screen min-w-[68rem] bg-background text-foreground">
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-panel px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link className="font-mono text-sm font-semibold tracking-tight" href="/">
            seeme
          </Link>
          <span className="text-border">/</span>
          <OrganizationControls />
        </div>
        <ThemeControl />
      </header>
      <WorkspaceContext.Provider value={{ adapter: workspace.adapter, files: workspace.files, setWorkspace }}>
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[13rem_minmax(0,1fr)_18rem]">
        <aside className="border-r border-border bg-panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Files
            </h2>
            <span className="font-mono text-[11px] text-muted">
              {workspace.files.length}
            </span>
          </div>
          <div className="mt-4 space-y-1">
            {categories.map((category) => (
              <button
                aria-pressed={activeCategory === category.kind}
                className={`flex w-full items-center justify-between px-2 py-1.5 text-left font-mono text-[11px] text-muted hover:bg-panel-strong ${
                  activeCategory === category.kind ? "bg-panel-strong text-foreground" : ""
                }`}
                key={category.kind}
                onClick={() =>
                  setActiveCategory((current) =>
                    current === category.kind ? null : category.kind,
                  )
                }
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${taxonomy.colors[category.kind] ?? "bg-accent"}`}
                  />
                  {category.kind}
                </span>
                <span>{category.count}</span>
              </button>
            ))}
          </div>
        </aside>
        <CategoryContext.Provider value={activeCategory}>
          {children}
        </CategoryContext.Provider>
      </div>
      </WorkspaceContext.Provider>
    </div>
  );
}

export function useWorkspace(): {
  adapter: string;
  files: ParsedFile[];
  setWorkspace: (adapter: string, files: ParsedFile[]) => void;
} {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside AppShell");
  return context;
}
