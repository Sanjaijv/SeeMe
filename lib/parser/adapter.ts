import type { FrameworkAdapter } from "./types";

export function createFallbackAdapter(): FrameworkAdapter {
  return {
    name: "fallback",
    identifyFile: () => null,
  };
}
