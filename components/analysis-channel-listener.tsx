"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AnalysisChannelListener({
  analysisIds,
}: {
  analysisIds: string[];
}) {
  const { getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const channels: Array<ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]>> = [];

    void getToken({ template: "supabase" }).then((token) => {
      if (!active || !token) return;
      const client = createSupabaseBrowserClient(token);
      for (const analysisId of analysisIds) {
        const channel = client
          .channel(`analysis:${analysisId}`, { config: { private: true } })
          .on("broadcast", { event: "stage_changed" }, () => router.refresh())
          .subscribe((status, error) => {
            if (status === "CHANNEL_ERROR") {
              console.error(`Could not subscribe to analysis ${analysisId}.`, error);
            }
          });
        channels.push(channel);
      }
    });

    return () => {
      active = false;
      for (const channel of channels) void channel.unsubscribe();
    };
  }, [analysisIds, getToken, router]);

  return null;
}
