import analysis from "@/data/analysis.json";
import { ModuleCanvas } from "@/components/module-canvas";
import type { ParserResult } from "@/lib/parser/types";

export const instant = false;

export default function WorkspacePage() {
  const result = analysis as ParserResult;

  return (
    <ModuleCanvas
      files={result.files}
      edges={result.edges}
      totalImports={result.coverage.totalImports}
    />
  );
}
