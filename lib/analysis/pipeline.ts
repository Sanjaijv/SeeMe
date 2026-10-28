import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseRepository } from "@/lib/parser/parse";
import type { ParserResult } from "@/lib/parser/types";
import { parseRepositoryUrl, type RepositoryReference } from "./repository-url";

type AnalysisClient = SupabaseClient;

type AnalysisRow = {
  id: string;
  organization_id: string;
  project_id: string;
};

function assertResponse(response: Response, description: string): void {
  if (!response.ok) {
    throw new Error(`${description} failed (${response.status} ${response.statusText}).`);
  }
}

async function selectArchive(archive: Buffer, destination: string): Promise<void> {
  const tar = gunzipSync(archive);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const sizeText = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const type = header[156];
    const content = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    if (type !== 0 && type !== 48) continue;
    const relativePath = name.split("/").slice(1).join("/");
    if (!relativePath || relativePath.includes("..")) continue;
    const target = path.join(destination, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
}

async function updateStage(
  client: AnalysisClient,
  analysisId: string,
  stage: string,
  stageMessage: string,
): Promise<void> {
  const { error } = await client
    .from("analyses")
    .update({ stage, stage_message: stageMessage })
    .eq("id", analysisId);
  if (error) throw new Error(`Could not update analysis stage: ${error.message}`);
}

async function failAnalysis(
  client: AnalysisClient,
  analysisId: string,
  stage: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await client
    .from("analyses")
    .update({
      status: "failed",
      stage,
      stage_message: errorMessage,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
  if (error) throw new Error(`Could not record analysis failure: ${error.message}`);
}

async function storeResult(
  client: AnalysisClient,
  analysis: AnalysisRow,
  result: ParserResult,
): Promise<void> {
  const files = result.files.map((file) => ({
    organization_id: analysis.organization_id,
    analysis_id: analysis.id,
    path: file.path,
    language: file.extension.replace(".", "") || null,
    lines: file.lines,
    hash: file.hash,
    module_kind: file.moduleKind,
    adapter_role: file.adapterRole,
    fan_in: file.fanIn,
    fan_out: file.fanOut,
  }));
  const { data: storedFiles, error: filesError } = await client
    .from("files")
    .insert(files)
    .select("id, path");
  if (filesError) throw new Error(`Could not store parsed files: ${filesError.message}`);

  const fileIds = new Map(
    (storedFiles as Array<{ id: string; path: string }>).map((file) => [file.path, file.id]),
  );
  const edges = result.edges.flatMap((edge) => {
    const from = fileIds.get(edge.from);
    const to = fileIds.get(edge.to);
    return from && to
      ? [{
          organization_id: analysis.organization_id,
          analysis_id: analysis.id,
          from_file_id: from,
          to_file_id: to,
          kind: edge.kind,
          specifier: edge.specifier,
        }]
      : [];
  });
  if (edges.length > 0) {
    const { error: edgesError } = await client.from("edges").insert(edges);
    if (edgesError) throw new Error(`Could not store parsed edges: ${edgesError.message}`);
  }
}

export async function runAnalysis(
  client: AnalysisClient,
  analysis: AnalysisRow,
  reference: RepositoryReference,
): Promise<void> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "seeme-"));
  let stage = "fetching";
  try {
    await updateStage(client, analysis.id, stage, "Fetching repository metadata.");
    const metadataResponse = await fetch(
      `https://api.github.com/repos/${reference.owner}/${reference.name}`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "seeme" } },
    );
    assertResponse(metadataResponse, "GitHub repository lookup");
    const metadata = (await metadataResponse.json()) as { default_branch?: string };
    const branch = metadata.default_branch ?? "main";

    const commitResponse = await fetch(
      `https://api.github.com/repos/${reference.owner}/${reference.name}/commits/${encodeURIComponent(branch)}`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "seeme" } },
    );
    assertResponse(commitResponse, "GitHub commit lookup");
    const commit = (await commitResponse.json()) as { sha?: string };
    if (!commit.sha) throw new Error("GitHub did not return a commit for the default branch.");

    const archiveResponse = await fetch(
      `https://github.com/${reference.owner}/${reference.name}/archive/${commit.sha}.tar.gz`,
      { headers: { "User-Agent": "seeme" } },
    );
    assertResponse(archiveResponse, "Repository archive download");
    await updateStage(client, analysis.id, "selecting", "Selecting source files.");
    await selectArchive(Buffer.from(await archiveResponse.arrayBuffer()), temporaryDirectory);

    stage = "parsing";
    await updateStage(client, analysis.id, stage, "Parsing imports and resolving edges.");
    const result = parseRepository(temporaryDirectory);

    stage = "storing";
    await updateStage(client, analysis.id, stage, "Storing the parsed graph.");
    await storeResult(client, analysis, result);
    const { error } = await client
      .from("analyses")
      .update({
        status: "complete",
        stage: "complete",
        stage_message: "Analysis complete.",
        commit_sha: commit.sha,
        root: result.root,
        coverage: result.coverage,
        skipped: result.skipped,
        adapter: result.adapter,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysis.id);
    if (error) throw new Error(`Could not complete analysis: ${error.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The analysis failed.";
    await failAnalysis(client, analysis.id, stage, message);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export { parseRepositoryUrl };
