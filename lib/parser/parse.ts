import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  Project,
  SyntaxKind,
  ts,
  type SourceFile,
} from "ts-morph";

import { createFallbackAdapter } from "./adapter";
import { addGraphMetrics } from "./graph";
import type {
  CoverageReport,
  Edge,
  FrameworkAdapter,
  ImportCoverage,
  ImportKind,
  ParsedFile,
  ParserResult,
  SkippedFile,
} from "./types";

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".parser-build",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

type DiscoveredFile = {
  absolutePath: string;
  relativePath: string;
};

function discoverFiles(root: string): DiscoveredFile[] {
  const result: DiscoveredFile[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(absolutePath);
        continue;
      }
      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        result.push({
          absolutePath,
          relativePath: path.relative(root, absolutePath).split(path.sep).join("/"),
        });
      }
    }
  };
  visit(root);
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function countLines(contents: string): number {
  return contents.length === 0 ? 0 : contents.split(/\r\n|\r|\n/).length;
}

function moduleKind(filePath: string): ParsedFile["moduleKind"] {
  const name = path.basename(filePath).toLowerCase();
  if (name.endsWith(".d.ts") || name.endsWith(".d.mts") || name.endsWith(".d.cts")) {
    return "declaration";
  }
  if (name.includes("config") || name.startsWith(".")) return "config";
  return "source";
}

function collectImports(
  sourceFile: SourceFile,
): Array<{ kind: ImportKind; specifier: string }> {
  const imports = sourceFile.getImportDeclarations().map((declaration) => ({
    kind: "import" as const,
    specifier: declaration.getModuleSpecifierValue(),
  }));
  const exports = sourceFile.getExportDeclarations().flatMap((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier ? [{ kind: "re-export" as const, specifier }] : [];
  });
  const dynamicImports = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .flatMap((call) => {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) return [];
      const argument = call.getArguments()[0];
      const literal = argument?.asKind(SyntaxKind.StringLiteral);
      if (!literal) return [];
      return [{ kind: "dynamic-import" as const, specifier: literal.getLiteralValue() }];
    });
  return [...imports, ...exports, ...dynamicImports];
}

function resolverOptions(root: string): ts.CompilerOptions {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  let configOptions: ts.CompilerOptions = {};
  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
      );
    }
    configOptions = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
      undefined,
      configPath,
    ).options;
  }
  return {
    ...configOptions,
    allowJs: true,
    baseUrl: configOptions.baseUrl ?? root,
    moduleResolution:
      configOptions.moduleResolution ?? ts.ModuleResolutionKind.NodeJs,
  };
}

function resolveImport(
  root: string,
  importer: string,
  specifier: string,
  selected: Set<string>,
): { status: ImportCoverage["status"]; resolvedPath?: string; reason?: string } {
  const containingFile = path.join(root, importer);
  const resolution = ts.resolveModuleName(
    specifier,
    containingFile,
    resolverOptions(root),
    ts.sys,
  ).resolvedModule;

  if (resolution) {
    const resolvedPath = path.relative(root, resolution.resolvedFileName).split(path.sep).join("/");
    const isInsideRoot =
      path.isAbsolute(resolution.resolvedFileName) &&
      !resolvedPath.startsWith("..") &&
      !resolvedPath.startsWith("../");
    if (isInsideRoot && resolvedPath.split("/").includes("node_modules")) {
      return {
        status: "external",
        resolvedPath,
        reason: "The import resolves to an ignored dependency directory.",
      };
    }
    if (isInsideRoot) {
      if (selected.has(resolvedPath)) {
        return { status: "resolved", resolvedPath };
      }
      return {
        status: "excluded",
        resolvedPath,
        reason: "The target exists inside the repository but was excluded from the file set.",
      };
    }
    return {
      status: "external",
      resolvedPath: resolution.resolvedFileName,
      reason: "The import resolves outside the repository.",
    };
  }

  if (!specifier.startsWith(".") && !path.isAbsolute(specifier)) {
    return { status: "external", reason: "No local file matched this package import." };
  }
  const unresolvedTarget = path.resolve(path.dirname(containingFile), specifier);
  if (
    fs.existsSync(unresolvedTarget) &&
    fs.statSync(unresolvedTarget).isFile()
  ) {
    return {
      status: "excluded",
      resolvedPath: path.relative(root, unresolvedTarget).split(path.sep).join("/"),
      reason: "The target exists but its file extension is not parsed.",
    };
  }
  return {
    status: "unresolved",
    reason: "No file matched the relative or absolute import path.",
  };
}

function createCoverage(): CoverageReport {
  return {
    totalImports: 0,
    counts: { resolved: 0, external: 0, excluded: 0, unresolved: 0 },
    imports: [],
    examples: { resolved: [], external: [], excluded: [], unresolved: [] },
  };
}

export function parseRepository(
  inputRoot: string,
  adapter: FrameworkAdapter = createFallbackAdapter(),
): ParserResult {
  const root = path.resolve(inputRoot);
  if (!fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${inputRoot}`);

  const discovered = discoverFiles(root);
  const files: ParsedFile[] = [];
  const skipped: SkippedFile[] = [];
  const sourceByRelativePath = new Map<string, SourceFile>();
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: resolverOptions(root),
  });

  for (const file of discovered) {
    try {
      const contents = fs.readFileSync(file.absolutePath, "utf8");
      const relativePath = file.relativePath;
      files.push({
        path: relativePath,
        folder: path.posix.dirname(relativePath) === "." ? "." : path.posix.dirname(relativePath),
        extension: path.extname(relativePath),
        lines: countLines(contents),
        hash: crypto.createHash("sha256").update(contents).digest("hex"),
        moduleKind: moduleKind(relativePath),
        adapterRole: adapter.identifyFile(relativePath),
        fanIn: 0,
        fanOut: 0,
      });
      sourceByRelativePath.set(
        relativePath,
        project.createSourceFile(file.absolutePath, contents, { overwrite: true }),
      );
    } catch (error) {
      skipped.push({
        path: file.relativePath,
        reason: error instanceof Error ? error.message : "The file could not be read or parsed.",
      });
    }
  }

  const selected = new Set(files.map((file) => file.path));
  const coverage = createCoverage();
  const edgeKeys = new Set<string>();
  const edges: Edge[] = [];

  for (const [importer, sourceFile] of sourceByRelativePath) {
    for (const item of collectImports(sourceFile)) {
      coverage.totalImports += 1;
      const resolution = resolveImport(root, importer, item.specifier, selected);
      coverage.counts[resolution.status] += 1;
      const record: ImportCoverage = {
        importer,
        specifier: item.specifier,
        kind: item.kind,
        status: resolution.status,
        ...(resolution.resolvedPath ? { resolvedPath: resolution.resolvedPath } : {}),
        ...(resolution.reason ? { reason: resolution.reason } : {}),
      };
      coverage.imports.push(record);
      if (resolution.status !== "resolved" && coverage.examples[resolution.status].length < 20) {
        coverage.examples[resolution.status].push(record);
      }
      if (resolution.status === "resolved" && resolution.resolvedPath) {
        const key = `${importer}\0${resolution.resolvedPath}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({
            from: importer,
            to: resolution.resolvedPath,
            kind: item.kind,
            specifier: item.specifier,
          });
        }
      }
    }
  }

  addGraphMetrics(files, edges);
  return {
    version: 1,
    root,
    files,
    edges,
    skipped,
    coverage,
    adapter: adapter.name,
  };
}
