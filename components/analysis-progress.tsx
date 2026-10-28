"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AnalysisProgress({
  analysisId,
  stage,
  message,
}: {
  analysisId: string;
  stage: string;
  message: string;
}) {
  const router = useRouter();
  const { getToken } = useAuth();

  useEffect(() => {
    let active = true;
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null = null;
    void getToken({ template: "supabase" }).then((token) => {
      if (!active || !token) return;
      const client = createSupabaseBrowserClient(token);
      channel = client
        .channel(`analysis:${analysisId}`, { config: { private: true } })
        .on("broadcast", { event: "stage_changed" }, () => router.refresh())
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR") {
            console.error(`Could not subscribe to analysis ${analysisId}.`, error);
          }
        });
    });
    return () => {
      active = false;
      if (channel) void channel.unsubscribe();
    };
  }, [analysisId, getToken, router]);

  return <p className="mt-4 font-mono text-xs text-muted">{stage}: {message}</p>;
}
