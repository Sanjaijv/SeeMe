export type ImportKind = "import" | "re-export" | "dynamic-import";

export type ResolutionStatus =
  | "resolved"
  | "external"
  | "excluded"
  | "unresolved";

export type SkippedFile = {
  path: string;
  reason: string;
};

export type ParsedFile = {
  path: string;
  folder: string;
  extension: string;
  lines: number;
  hash: string;
  moduleKind: "source" | "declaration" | "config";
  adapterRole: string | null;
  fanIn: number;
  fanOut: number;
};

export type Edge = {
  from: string;
  to: string;
  kind: ImportKind;
  specifier: string;
};

export type ImportCoverage = {
  importer: string;
  specifier: string;
  kind: ImportKind;
  status: ResolutionStatus;
  resolvedPath?: string;
  reason?: string;
};

export type CoverageReport = {
  totalImports: number;
  counts: Record<ResolutionStatus, number>;
  imports: ImportCoverage[];
  examples: Record<ResolutionStatus, ImportCoverage[]>;
};

export type Route = {
  file: string;
  method: string;
  path: string;
};

export type ParserResult = {
  version: 1;
  root: string;
  files: ParsedFile[];
  edges: Edge[];
  skipped: SkippedFile[];
  coverage: CoverageReport;
  adapter: string;
  routes: Route[];
};

export type FrameworkAdapter = {
  name: string;
  identifyFile(path: string, sourceFile?: import("ts-morph").SourceFile): string | null;
  routesForFile(path: string, sourceFile: import("ts-morph").SourceFile): Route[];
};
