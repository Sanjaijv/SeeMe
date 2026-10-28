import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";

import { runAnalysis } from "@/lib/analysis/pipeline";
import { parseRepositoryUrl } from "@/lib/analysis/repository-url";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.isAuthenticated || !session.orgId) {
    return Response.json({ error: "Select an organization before analysing a repository." }, { status: 401 });
  }

  const body = (await request.json()) as { url?: unknown };
  if (typeof body.url !== "string") {
    return Response.json({ error: "A repository URL is required." }, { status: 400 });
  }

  let reference;
  try {
    reference = parseRepositoryUrl(body.url);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid repository URL." },
      { status: 400 },
    );
  }

  const client = createSupabaseAdminClient();
  const { error: organizationError } = await client
    .from("organizations")
    .upsert({ id: session.orgId }, { onConflict: "id", ignoreDuplicates: true });
  if (organizationError) return Response.json({ error: organizationError.message }, { status: 500 });

  const { data: project, error: projectError } = await client
    .from("projects")
    .select("id")
    .eq("organization_id", session.orgId)
    .eq("repository_url", reference.url)
    .maybeSingle();
  if (projectError) return Response.json({ error: projectError.message }, { status: 500 });

  let projectId = project?.id as string | undefined;
  if (!projectId) {
    const { data: createdProject, error: createProjectError } = await client
      .from("projects")
      .insert({
        organization_id: session.orgId,
        name: reference.name,
        repository_url: reference.url,
      })
      .select("id")
      .single();
    if (createProjectError) return Response.json({ error: createProjectError.message }, { status: 500 });
    projectId = createdProject.id as string;
  }

  const { data: existing, error: existingError } = await client
    .from("analyses")
    .select("id")
    .eq("organization_id", session.orgId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return Response.json({ error: existingError.message }, { status: 500 });
  if (existing) return Response.json({ analysisId: existing.id, existing: true });

  const { data: analysis, error: analysisError } = await client
    .from("analyses")
    .insert({
      organization_id: session.orgId,
      project_id: projectId,
      status: "running",
      stage: "queued",
      stage_message: "Queued.",
      started_at: new Date().toISOString(),
    })
    .select("id, organization_id, project_id")
    .single();
  if (analysisError) return Response.json({ error: analysisError.message }, { status: 500 });

  after(() => runAnalysis(client, analysis, reference));
  return Response.json({ analysisId: analysis.id, existing: false }, { status: 202 });
}
