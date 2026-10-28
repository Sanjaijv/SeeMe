import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { ModuleCanvas } from "@/components/module-canvas";
import { AnalysisProgress } from "@/components/analysis-progress";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export default async function AnalysisPage({ params }: Props) {
  const session = await auth();
  if (!session.isAuthenticated || !session.orgId) notFound();
  const { id } = await params;
  const client = createSupabaseAdminClient();
  const { data: analysis, error: analysisError } = await client
    .from("analyses")
    .select("id, status, stage, stage_message, error_message, started_at, root, adapter, coverage, skipped")
    .eq("id", id)
    .eq("organization_id", session.orgId)
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

  const [{ data: files }, { data: storedEdges }] = await Promise.all([
    client.from("files").select("id, path, language, lines, hash, module_kind, adapter_role, fan_in, fan_out").eq("analysis_id", id),
    client.from("edges").select("from_file_id, to_file_id, kind, specifier").eq("analysis_id", id),
  ]);
  const fileById = new Map((files ?? []).map((file) => [file.id, file.path]));
  const parsedFiles = (files ?? []).map((file) => ({
    path: file.path,
    folder: file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ".",
    extension: file.language ? `.${file.language}` : "",
    lines: file.lines,
    hash: file.hash ?? "",
    moduleKind: file.module_kind ?? "source",
    adapterRole: file.adapter_role,
    fanIn: file.fan_in,
    fanOut: file.fan_out,
  }));
  const edges = (storedEdges ?? []).flatMap((edge) => {
    const from = fileById.get(edge.from_file_id);
    const to = fileById.get(edge.to_file_id);
    return from && to ? [{ from, to, kind: edge.kind, specifier: edge.specifier }] : [];
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
    />
  );
}
