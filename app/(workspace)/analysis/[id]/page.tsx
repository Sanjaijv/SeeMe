import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { ModuleCanvas } from "@/components/module-canvas";
import { AnalysisProgress } from "@/components/analysis-progress";
import type { Edge, ParsedFile, Route } from "@/lib/parser/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export const instant = false;
export const prefetch = "force-disabled";

export default async function AnalysisPage({ params }: Props) {
  const session = await auth();
  if (!session.isAuthenticated || !session.orgId) notFound();
  const { id } = await params;
  const client = createSupabaseServerClient(() => session.getToken({ template: "supabase" }));
  const { data: analysis, error: analysisError } = await client
    .from("analyses")
    .select("id, status, stage, stage_message, error_message, started_at, root, adapter, coverage, skipped")
    .eq("id", id)
    .maybeSingle();
  if (analysisError) throw new Error(analysisError.message);
  if (!analysis) notFound();

  if (analysis.status !== "complete") {
    const stale = analysis.status === "running"
      && analysis.started_at
      && new Date(analysis.started_at).getTime() < new Date().getTime() - 5 * 60 * 1000;
    return (
      <main className="col-span-2 p-8">
        <h1 className="font-mono text-sm">Analysing repository</h1>
        <AnalysisProgress
          analysisId={id}
          message={analysis.stage_message}
          stage={analysis.stage}
        />
        {stale ? <p className="mt-3 font-mono text-xs text-amber-700">This run is stale and may have stopped before completing.</p> : null}
        {analysis.status === "failed" ? <p className="mt-4 text-xs text-red-600">{analysis.error_message}</p> : null}
      </main>
    );
  }

  const pageSize = 1000;
  const fetchAll = async <T,>(query: ReturnType<typeof client.from>, select: string): Promise<T[]> => {
    const all: T[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await query.select(select).eq("analysis_id", id).order("id", { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as T[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const [files, storedEdges, storedRoutes] = await Promise.all([
    fetchAll<{ id: string; path: string; language: string | null; lines: number; hash: string | null; module_kind: string | null; adapter_role: string | null; fan_in: number | null; fan_out: number | null }>(client.from("files"), "id, path, language, lines, hash, module_kind, adapter_role, fan_in, fan_out"),
    fetchAll<{ from_file_id: string; to_file_id: string; kind: "import" | "re-export" | "dynamic-import"; specifier: string | null }>(client.from("edges"), "from_file_id, to_file_id, kind, specifier"),
    fetchAll<{ file_id: string; method: string; path: string }>(client.from("routes"), "file_id, method, path"),
  ]);
  const fileById = new Map(files.map((file) => [file.id, file.path]));
  const parsedFiles: ParsedFile[] = files.map((file) => ({
    path: file.path,
    folder: file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ".",
    extension: file.language ? `.${file.language}` : "",
    lines: file.lines,
    hash: file.hash ?? "",
    moduleKind: (file.module_kind === "declaration" || file.module_kind === "config" ? file.module_kind : "source") as ParsedFile["moduleKind"],
    adapterRole: file.adapter_role,
    fanIn: file.fan_in ?? 0,
    fanOut: file.fan_out ?? 0,
  }));
  const edges: Edge[] = storedEdges.flatMap((edge) => {
    const from = fileById.get(edge.from_file_id);
    const to = fileById.get(edge.to_file_id);
    return from && to ? [{ from, to, kind: edge.kind, specifier: edge.specifier ?? "" }] : [];
  });
  const routes: Route[] = storedRoutes.flatMap((route) => {
    const file = fileById.get(route.file_id);
    return file ? [{ file, method: route.method, path: route.path }] : [];
  });

  return (
    <ModuleCanvas
      adapter={analysis.adapter ?? "fallback"}
      coverage={analysis.coverage as { totalImports: number; counts: Record<string, number> } | null}
      edges={edges}
      files={parsedFiles}
      root={analysis.root ?? ""}
      skippedCount={Array.isArray(analysis.skipped) ? analysis.skipped.length : 0}
      totalImports={analysis.coverage?.totalImports ?? 0}
      routes={routes}
    />
  );
}
