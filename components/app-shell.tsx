"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";

import { OrganizationControls } from "@/components/organization-controls";
import { ThemeControl } from "@/components/theme-control";
import analysis from "@/data/analysis.json";
import type { ParsedFile } from "@/lib/parser/types";

const categoryColors: Record<ParsedFile["moduleKind"], string> = {
  source: "bg-accent",
  declaration: "bg-emerald-500",
  config: "bg-amber-500",
};

type Category = ParsedFile["moduleKind"];
const CategoryContext = createContext<Category | null>(null);

export function useActiveCategory(): Category | null {
  return useContext(CategoryContext);
}

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const files = analysis.files as ParsedFile[];
  const categories = (["source", "declaration", "config"] as const).map(
    (kind) => ({
      kind,
      count: files.filter((file) => file.moduleKind === kind).length,
    }),
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
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[13rem_minmax(0,1fr)_18rem]">
        <aside className="border-r border-border bg-panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Files
            </h2>
            <span className="font-mono text-[11px] text-muted">
              {files.length}
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
                    className={`h-1.5 w-1.5 rounded-full ${categoryColors[category.kind]}`}
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
    </div>
  );
}
