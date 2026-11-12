import fs from "node:fs";
import path from "node:path";

import {
  SyntaxKind,
  type Node,
  type SourceFile,
} from "ts-morph";

import type { FrameworkAdapter, Route } from "./types";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function packageNames(root: string): Set<string> {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

function joinRoute(...parts: string[]): string {
  const joined = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return `/${joined}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function nextPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  const marker = normalized.startsWith("app/") ? "app/" : normalized.startsWith("pages/") ? "pages/" : null;
  if (!marker) return null;
  const relative = normalized.slice(marker.length);
  const segments = relative.split("/");
  const filename = segments.pop() ?? "";
  if (!/^page\.[cm]?[jt]sx?$/.test(filename) && !/^route\.[cm]?[jt]sx?$/.test(filename)) return null;
  const routeSegments = segments.filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("_"));
  return joinRoute(...routeSegments.map((segment) => segment.replace(/^\[\.\.\.(.+)\]$/, "[...$1]")));
}

function exportedHttpMethods(sourceFile: SourceFile): string[] {
  return sourceFile.getFunctions()
    .filter((declaration) => declaration.isExported() && HTTP_METHODS.has(declaration.getName() ?? ""))
    .map((declaration) => declaration.getName() as string)
    .concat(
      sourceFile.getVariableDeclarations()
        .filter((declaration) => declaration.isExported() && HTTP_METHODS.has(declaration.getName() ?? ""))
        .map((declaration) => declaration.getName()),
    );
}

function stringArgument(node: Node): string | null {
  const argument = node.asKind(SyntaxKind.StringLiteral) ?? node.asKind(SyntaxKind.NoSubstitutionTemplateLiteral);
  return argument?.getLiteralValue() ?? null;
}

function nestRoutes(filePath: string, sourceFile: SourceFile): Route[] {
  const controller = sourceFile.getClasses()
    .flatMap((declaration) => declaration.getDecorators())
    .find((decorator) => decorator.getName() === "Controller");
  if (!controller) return [];
  const controllerArgument = controller.getArguments()[0];
  const controllerPath = controllerArgument ? stringArgument(controllerArgument) : null;
  if (controllerArgument && controllerPath === null) return [];
  return sourceFile.getClasses().flatMap((declaration) =>
    declaration.getMethods().flatMap((method) => {
      const decorator = method.getDecorators().find((item) =>
        ["Get", "Post", "Put", "Patch", "Delete", "Head", "Options"].includes(item.getName()),
      );
      if (!decorator) return [];
      const argument = decorator.getArguments()[0];
      const methodPath = argument ? stringArgument(argument) : "";
      if (methodPath === null) return [];
      return [{
        file: filePath,
        method: decorator.getName().toUpperCase(),
        path: joinRoute(controllerPath ?? "", methodPath),
      }];
    }),
  );
}

function nextRoutes(filePath: string, sourceFile: SourceFile): Route[] {
  const routePath = nextPath(filePath);
  if (!routePath) return [];
  if (filePath.includes("/route.")) {
    return exportedHttpMethods(sourceFile).map((method) => ({ file: filePath, method, path: routePath }));
  }
  if (filePath.includes("/page.")) return [{ file: filePath, method: "PAGE", path: routePath }];
  return [];
}

function baseAdapter(
  name: string,
  roleForFile: (filePath: string, sourceFile?: SourceFile) => string | null,
  routeExtractor: (filePath: string, sourceFile: SourceFile) => Route[],
): FrameworkAdapter {
  return {
    name,
    identifyFile: roleForFile,
    routesForFile: routeExtractor,
  };
}

function createNextAdapter(): FrameworkAdapter {
  return baseAdapter("nextjs", (filePath, sourceFile) => {
    if (sourceFile && (sourceFile.getText().includes('"use server"') || sourceFile.getText().includes("'use server'"))) {
      return "Server actions";
    }
    if (nextPath(filePath) && filePath.includes("/route.")) return "API endpoints";
    if (nextPath(filePath) && filePath.includes("/page.")) return "Page routes";
    return null;
  }, nextRoutes);
}

function createNestAdapter(): FrameworkAdapter {
  return baseAdapter("nestjs", (filePath) => {
    const name = path.basename(filePath).toLowerCase();
    if (name.endsWith(".controller.ts") || name.endsWith(".controller.js")) return "Controllers";
    if (name.endsWith(".service.ts") || name.endsWith(".service.js")) return "Services";
    if (name.endsWith(".module.ts") || name.endsWith(".module.js")) return "Modules";
    if (name.endsWith(".entity.ts") || name.endsWith(".entity.js")) return "Entities";
    return null;
  }, nestRoutes);
}

function createReactAdapter(): FrameworkAdapter {
  return baseAdapter("react", (filePath) => {
    const name = path.basename(filePath);
    if (/^use[A-Z].*\.[cm]?[jt]sx?$/.test(name)) return "Hooks";
    if (/\.[jt]sx?$/.test(name)) return "Components";
    return null;
  }, () => []);
}

export function createFallbackAdapter(): FrameworkAdapter {
  return baseAdapter("fallback", () => null, () => []);
}

export function detectFrameworkAdapter(root: string, files: string[]): FrameworkAdapter {
  const packages = packageNames(root);
  if (packages.has("next") || files.some((file) => /^app\/.*\/(?:page|route)\.[cm]?[jt]sx?$/.test(file))) {
    return createNextAdapter();
  }
  if (packages.has("@nestjs/core") || files.some((file) => /\.controller\.[cm]?[jt]s$/.test(file))) {
    return createNestAdapter();
  }
  if (packages.has("react")) return createReactAdapter();
  return createFallbackAdapter();
}
