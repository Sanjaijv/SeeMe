import { RepositoryForm } from "@/components/repository-form";
import { AnalysisChannelListener } from "@/components/analysis-channel-listener";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const instant = false;

export default async function WorkspacePage() {
  const session = await auth();
  const client = createSupabaseAdminClient();
  const { data: analyses, error } = await client
    .from("analyses")
    .select("id, status, stage, stage_message, started_at, created_at, projects(name, repository_url)")
    .eq("organization_id", session.orgId)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42703" && error.message.includes("analyses.stage")) {
      return (
        <main className="col-span-2 p-8">
          <h1 className="font-mono text-sm">Database migration required</h1>
          <p className="mt-3 max-w-xl text-xs leading-5 text-muted">
            Apply the phase 7 migration before using repository analysis. The database is
            still on the phase 2 schema.
          </p>
        </main>
      );
    }
    throw new Error(error.message);
  }
  const staleBefore = new Date().getTime() - 5 * 60 * 1000;
  const runningAnalysisIds = (analyses ?? [])
    .filter((analysis) => analysis.status === "running")
    .map((analysis) => analysis.id);

  return (
    <main className="col-span-2 p-8">
      <h1 className="font-mono text-sm">Analyse a repository</h1>
      <p className="mt-2 max-w-xl text-xs text-muted">
        Fetch a public GitHub repository and build its dependency map from the parsed source.
      </p>
      <div className="mt-6">
        <RepositoryForm />
      </div>
      <AnalysisChannelListener analysisIds={runningAnalysisIds} />
      <section className="mt-10 max-w-2xl">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Analyses</h2>
        <div className="mt-3 divide-y divide-border border-y border-border">
          {(analyses ?? []).map((analysis) => {
            const project = Array.isArray(analysis.projects) ? analysis.projects[0] : analysis.projects;
            const stale = analysis.status === "running"
              && analysis.started_at
              && new Date(analysis.started_at).getTime() < staleBefore;
            return (
              <a className="block py-3 hover:bg-panel-strong" href={`/analysis/${analysis.id}`} key={analysis.id}>
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate font-mono text-xs">{project?.repository_url ?? "Repository"}</span>
                  <span className={`shrink-0 font-mono text-[10px] ${analysis.status === "failed" ? "text-red-600" : "text-muted"}`}>
                    {stale ? "stale" : analysis.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted">{analysis.stage}: {analysis.stage_message}</p>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
