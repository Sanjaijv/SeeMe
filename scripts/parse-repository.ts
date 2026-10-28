import fs from "node:fs";

import { parseRepository } from "../lib/parser/parse";
import type { ParserResult } from "../lib/parser/types";

function usage(): never {
  console.error("Usage: pnpm parser <directory> [--output <file>]");
  process.exit(1);
}

function parseArguments(args: string[]): { directory: string; output?: string } {
  const directory = args[0];
  if (!directory) usage();
  const outputFlag = args.indexOf("--output");
  if (outputFlag === -1) return { directory };
  const output = args[outputFlag + 1];
  if (!output) usage();
  return { directory, output };
}

function printSummary(result: ParserResult): void {
  console.log(`Root: ${result.root}`);
  console.log(`Files found: ${result.files.length + result.skipped.length}`);
  console.log(`Files parsed: ${result.files.length}`);
  console.log(`Files skipped: ${result.skipped.length}`);
  for (const skipped of result.skipped) console.log(`  skipped ${skipped.path}: ${skipped.reason}`);
  console.log(`Folders: ${new Set(result.files.map((file) => file.folder)).size}`);
  console.log(`Edges: ${result.edges.length}`);
  console.log(`Imports: ${result.coverage.totalImports}`);
  const reExports = result.coverage.imports.filter((item) => item.kind === "re-export");
  console.log(
    `Re-exports: ${reExports.length} found, ${reExports.filter((item) => item.status === "resolved").length} resolved`,
  );
  console.log(
    `Coverage: resolved ${result.coverage.counts.resolved}, external ${result.coverage.counts.external}, excluded ${result.coverage.counts.excluded}, unresolved ${result.coverage.counts.unresolved}`,
  );
}

const { directory, output } = parseArguments(process.argv.slice(2));
const result = parseRepository(directory);
if (output) {
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote: ${output}`);
}
printSummary(result);
