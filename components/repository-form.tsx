"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function RepositoryForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as { analysisId?: string; error?: string };
      if (!response.ok || !body.analysisId) throw new Error(body.error ?? "Could not start analysis.");
      router.push(`/analysis/${body.analysisId}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not start analysis.");
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-xl gap-2" onSubmit={submit}>
      <label className="sr-only" htmlFor="repository-url">Public GitHub repository URL</label>
      <input
        className="min-w-0 flex-1 border border-border bg-panel px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        id="repository-url"
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://github.com/owner/repository"
        required
        type="url"
        value={url}
      />
      <button className="border border-accent bg-accent px-3 py-2 font-mono text-xs text-white disabled:opacity-50" disabled={submitting} type="submit">
        {submitting ? "starting..." : "analyse"}
      </button>
      {error ? <p className="basis-full text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
