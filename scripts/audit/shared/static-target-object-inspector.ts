import { readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { parseDocument } from "yaml";

import { rejectDuplicateJsonKeys } from "../governance-json.js";
import { fail } from "../governance-runtime.js";
import type { InspectorContext, InspectorLawRequirement } from "./inspector-contracts.js";

const utf8 = new TextDecoder("utf-8", { fatal: true });
const binaryExtensions = new Set([".jpg", ".pdf", ".png", ".zip"]);
const sourceExtensions = new Set([".js", ".mjs", ".mts", ".ts"]);
const structuredExtensions = new Set([".json", ".yaml", ".yml"]);
const evidenceKindByMode: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const evidenceRef = (kind: string, path: string, selector: string): string =>
  `${kind}:${path}#${encodeURIComponent(selector)}`;

const binarySignatureValid = (extension: string, value: Buffer): boolean => {
  if (extension === ".png") return value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === ".jpg") return value[0] === 0xff && value[1] === 0xd8;
  if (extension === ".pdf") return value.subarray(0, 5).toString("ascii") === "%PDF-";
  return extension === ".zip" && value[0] === 0x50 && value[1] === 0x4b;
};

const validateStructuredText = (source: string, extension: string, path: string): void => {
  if (extension === ".json") {
    rejectDuplicateJsonKeys(source, path);
    try { JSON.parse(source); } catch { fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:json`); }
  }
  if (extension === ".yaml" || extension === ".yml") {
    const document = parseDocument(source, { strict: true, uniqueKeys: true });
    if (document.errors.length || document.warnings.length) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:yaml`);
  }
};

const inspectTargetObject = (context: InspectorContext, root: string, path: string): void => {
  const absolute = resolve(root, path);
  const escaped = relative(root, absolute);
  if (escaped === ".." || escaped.startsWith("../")) fail("TARGET_OUTSIDE_DOMAIN_AUTHORITY", path);
  let value: Buffer;
  try { value = readFileSync(absolute); } catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", path); }
  const extension = extname(path).toLocaleLowerCase("en-US");
  if (binaryExtensions.has(extension)) {
    if (!binarySignatureValid(extension, value)) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:binary-signature`);
    return;
  }
  let source: string;
  try { source = utf8.decode(value); } catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:utf8`); }
  validateStructuredText(source, extension, path);
  if (sourceExtensions.has(extension)) {
    const ast = context.project.getSourceFile(absolute);
    if (!ast || ast.getFullText() !== source) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:ast`);
  }
};

export const inspectTargetObjects = (context: InspectorContext, targetPaths: readonly string[]): void => {
  const root = resolve(context.sealedRoot);
  for (const path of targetPaths) inspectTargetObject(context, root, path);
};

const sourceFor = (context: InspectorContext, path: string) =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const observation = (requirement: InspectorLawRequirement, evidenceMode: string, selector: string): string =>
  `lawId=${requirement.lawId};mode=${evidenceMode};${selector}`;

const astRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] => paths.flatMap((path) => {
  if (!sourceExtensions.has(extname(path).toLocaleLowerCase("en-US"))) return [];
  const source = sourceFor(context, path);
  return source ? [evidenceRef("ast", path, observation(requirement, evidenceMode,
    `node=SourceFile;statements=${source.getStatements().length}`))] : [];
});

const typeRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] => {
  const checker = context.project.getTypeChecker();
  return paths.flatMap((path) => {
    if (![".ts", ".mts"].includes(extname(path).toLocaleLowerCase("en-US"))) return [];
    const source = sourceFor(context, path);
    const declaration = source?.getExportedDeclarations().entries().next().value as
      | [string, import("ts-morph").Node[]] | undefined;
    const node = declaration?.[1][0];
    if (!declaration || !node) return [];
    const observedType = checker.getTypeAtLocation(node).getText(node).slice(0, 256);
    return [evidenceRef("ast", path, observation(requirement, evidenceMode,
      `symbol=${declaration[0]};declarations=${declaration[1].length};type=${observedType}`))];
  });
};

const dependencyRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] => paths.flatMap((path) => {
  const source = sourceFor(context, path);
  return source?.getImportDeclarations().flatMap((declaration) => {
    const bindings = [
      ...declaration.getNamedImports().map((entry) => entry.getName()),
      ...(declaration.getDefaultImport() ? [declaration.getDefaultImport()!.getText()] : []),
      ...(declaration.getNamespaceImport() ? [declaration.getNamespaceImport()!.getText()] : []),
    ];
    return [evidenceRef("dependency", path, observation(requirement, evidenceMode,
      `from=${path};to=${declaration.getModuleSpecifierValue()};bindings=${bindings.sort().join(",") || "side-effect"}`))];
  }) ?? [];
});

const parsedRoot = (path: string, source: string): unknown => {
  const extension = extname(path).toLocaleLowerCase("en-US");
  if (extension === ".json") return JSON.parse(source) as unknown;
  return parseDocument(source, { strict: true, uniqueKeys: true }).toJS() as unknown;
};

const structuredRefs = (
  context: InspectorContext,
  requirement: InspectorLawRequirement,
  paths: readonly string[],
  mode: "static.config" | "static.contract" | "static.json" | "static.yaml",
): string[] => paths.flatMap((path) => {
  const extension = extname(path).toLocaleLowerCase("en-US");
  const isRequestedStructure = mode === "static.json" ? extension === ".json"
    : mode === "static.yaml" ? extension === ".yaml" || extension === ".yml"
      : structuredExtensions.has(extension) && /(?:contract|manifest|package|config|workflow)/iu.test(path);
  if (!isRequestedStructure) return [];
  const root = parsedRoot(path, readFileSync(resolve(context.sealedRoot, path), "utf8"));
  const keys = root && typeof root === "object" && !Array.isArray(root)
    ? Object.keys(root as Record<string, unknown>).sort().slice(0, 24)
    : [];
  return [evidenceRef(evidenceKindByMode[mode]!, path, observation(requirement, mode,
    `parser=${extension.slice(1)};pointer=/;keys=${keys.join(",") || "scalar"}`))];
});

const typescriptContractRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] =>
  paths.flatMap((path) => {
    const source = sourceFor(context, path);
    if (!source) return [];
    const declarations = [
      ...source.getInterfaces().map((node) => ({ kind: "interface", name: node.getName(), members: node.getMembers().length })),
      ...source.getTypeAliases().map((node) => ({ kind: "type", name: node.getName(), members: node.getTypeNode()?.getChildCount() ?? 0 })),
      ...source.getClasses().map((node) => ({ kind: "class", name: node.getName() ?? "default", members: node.getMembers().length })),
    ];
    return declarations.slice(0, 24).map((declaration) => evidenceRef("config", path,
      observation(requirement, evidenceMode,
        `parser=typescript;contract=${declaration.name};kind=${declaration.kind};members=${declaration.members}`)));
  });

const typescriptConfigRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] =>
  paths.flatMap((path) => {
    const source = sourceFor(context, path);
    if (!source) return [];
    const environmentReads = source.getFullText().match(/\bprocess\.env(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]+\])/gu) ?? [];
    const declarations = source.getVariableDeclarations()
      .filter((node) => /(?:config|environment|options|settings)/iu.test(node.getName()))
      .map((node) => node.getName());
    if (!environmentReads.length && !declarations.length) return [];
    return [evidenceRef("config", path, observation(requirement, evidenceMode,
      `parser=typescript;environmentReads=${environmentReads.length};declarations=${declarations.slice(0, 24).sort().join(",") || "none"}`))];
  });

const textRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] => paths.flatMap((path) => {
  const extension = extname(path).toLocaleLowerCase("en-US");
  if (binaryExtensions.has(extension)) return [];
  const value = readFileSync(resolve(context.sealedRoot, path), "utf8");
  return [evidenceRef("text", path, observation(requirement, evidenceMode,
    `encoding=utf8;lines=${value.split("\n").length}`))];
});

const filesystemRefs = (
  context: InspectorContext, requirement: InspectorLawRequirement, evidenceMode: string, paths: readonly string[],
): string[] => paths.map((path) => {
  const bytes = readFileSync(resolve(context.sealedRoot, path));
  return evidenceRef("file", path, observation(requirement, evidenceMode,
    `state=regular;bytes=${bytes.byteLength}`));
});

export const collectStaticModeEvidenceRefs = (
  context: InspectorContext,
  requirement: InspectorLawRequirement,
  evidenceMode: string,
): string[] => {
  const paths = requirement.targetPaths.filter((path) => !/[#@]/u.test(path));
  let refs: string[];
  switch (evidenceMode) {
    case "static.filesystem": refs = filesystemRefs(context, requirement, evidenceMode, paths); break;
    case "static.text": refs = textRefs(context, requirement, evidenceMode, paths); break;
    case "static.ast": refs = astRefs(context, requirement, evidenceMode, paths); break;
    case "static.types": refs = typeRefs(context, requirement, evidenceMode, paths); break;
    case "static.dependency": refs = dependencyRefs(context, requirement, evidenceMode, paths); break;
    case "static.contract": refs = [...structuredRefs(context, requirement, paths, "static.contract"), ...typescriptContractRefs(context, requirement, evidenceMode, paths)]; break;
    case "static.config": refs = [...structuredRefs(context, requirement, paths, "static.config"), ...typescriptConfigRefs(context, requirement, evidenceMode, paths)]; break;
    case "static.json": refs = structuredRefs(context, requirement, paths, "static.json"); break;
    case "static.yaml": refs = structuredRefs(context, requirement, paths, "static.yaml"); break;
    case "static.sql": refs = paths.filter((path) => extname(path) === ".sql")
      .map((path) => evidenceRef("sql", path, observation(requirement, evidenceMode, "parser=sql;scope=complete-file"))); break;
    case "static.migration": refs = paths.filter((path) => /migration/iu.test(path))
      .map((path) => evidenceRef("file", path, observation(requirement, evidenceMode, "role=migration;state=regular"))); break;
    default: refs = [];
  }
  if (refs.length === 0) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${requirement.lawId}:${evidenceMode}:native-observation`);
  return ordered(refs.slice(0, 256));
};
