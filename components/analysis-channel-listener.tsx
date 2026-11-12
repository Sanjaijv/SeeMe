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
  const analysisKey = analysisIds.join(",");

  useEffect(() => {
    let active = true;
    const channels: Array<ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]>> = [];
    const ids = analysisKey ? analysisKey.split(",") : [];

    void getToken({ template: "supabase" }).then((token) => {
      if (!active || !token) return;
      const client = createSupabaseBrowserClient(async () => token);
      for (const analysisId of ids) {
        const channel = client
          .channel(`analysis:${analysisId}`, { config: { private: true } })
          .on("broadcast", { event: "stage_changed" }, () => router.refresh())
          .subscribe((status, error) => {
            if (status === "SUBSCRIBED") {
              router.refresh();
              return;
            }
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
  }, [analysisKey, getToken, router]);

  return null;
}
