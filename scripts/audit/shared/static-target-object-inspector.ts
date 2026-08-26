import { lstatSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { parseDocument } from "yaml";

import { rejectDuplicateJsonKeys } from "../governance-json.js";
import { fail } from "../governance-runtime.js";
import type { InspectorContext } from "./inspector-contracts.js";

const utf8 = new TextDecoder("utf-8", { fatal: true });
const binaryExtensions = new Set([".jpg", ".pdf", ".png", ".zip"]);
const sourceExtensions = new Set([".js", ".mjs", ".mts", ".ts"]);

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

type NativeObservationInput = {
  checks: readonly string[];
  clauses: readonly string[];
  context: InspectorContext;
  evidenceMode: string;
  executionPassed: boolean;
  lawId: string;
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const targetPaths = (input: NativeObservationInput): string[] => {
  const requirement = input.context.lawRequirements.find((law) => law.lawId === input.lawId)
    ?? fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${input.lawId}:requirement`);
  return requirement.targetPaths.filter((path) => !/[#@]/u.test(path));
};
const nativeRef = (input: NativeObservationInput, kind: string, path: string, fact: string): string =>
  `${kind}:${path}#${encodeURIComponent(`lawId=${input.lawId};mode=${input.evidenceMode};semanticChecks=${ordered(input.checks).join(",")};executionResult=${input.executionPassed ? "passed" : "failed"};${fact};clauses=${input.clauses.join(",")}`)}`;
const requireRefs = (input: NativeObservationInput, refs: readonly string[]): string[] => {
  if (!refs.length) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${input.lawId}:${input.evidenceMode}:native-object`);
  return ordered(refs);
};

export const observeStaticFilesystem = (input: NativeObservationInput): string[] => requireRefs(input,
  targetPaths(input).map((path) => {
    const stat = lstatSync(resolve(input.context.sealedRoot, path));
    if (!stat.isFile() || stat.isSymbolicLink()) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:regular-file`);
    return nativeRef(input, "file", path, `object=regular-file;bytes=${stat.size}`);
  }));

export const observeStaticAst = (input: NativeObservationInput): string[] => requireRefs(input,
  targetPaths(input).flatMap((path) => {
    if (!sourceExtensions.has(extname(path).toLocaleLowerCase("en-US"))) return [];
    const source = input.context.project.getSourceFile(resolve(input.context.sealedRoot, path));
    return source ? [nativeRef(input, "ast", path,
      `node=SourceFile;statements=${source.getStatements().length};descendants=${source.getDescendants().length}`)] : [];
  }));

export const observeStaticTypes = (input: NativeObservationInput): string[] => {
  const checker = input.context.project.getTypeChecker();
  return requireRefs(input, targetPaths(input).flatMap((path) => {
    const source = input.context.project.getSourceFile(resolve(input.context.sealedRoot, path));
    const declaration = source?.getExportedDeclarations().entries().next().value as
      | [string, import("ts-morph").Node[]] | undefined;
    const node = declaration?.[1][0];
    if (!declaration || !node) return [];
    return [nativeRef(input, "test", path,
      `symbol=${declaration[0]};declarations=${declaration[1].length};type=${checker.getTypeAtLocation(node).getText(node).slice(0, 256)}`)];
  }));
};

export const observeStaticDependency = (input: NativeObservationInput): string[] => requireRefs(input,
  targetPaths(input).flatMap((path) => {
    const source = input.context.project.getSourceFile(resolve(input.context.sealedRoot, path));
    return source?.getImportDeclarations().map((declaration) => nativeRef(input, "dependency", path,
      `from=${path};to=${declaration.getModuleSpecifierValue()}`)) ?? [];
  }));

const structuredRoot = (input: NativeObservationInput, path: string): { extension: string; keys: string[] } | null => {
  const extension = extname(path).toLocaleLowerCase("en-US");
  if (![".json", ".yaml", ".yml"].includes(extension)) return null;
  const source = readFileSync(resolve(input.context.sealedRoot, path), "utf8");
  const value = extension === ".json" ? JSON.parse(source) as unknown
    : parseDocument(source, { strict: true, uniqueKeys: true }).toJS() as unknown;
  const keys = value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort() : [];
  return { extension, keys };
};

export const observeStaticContract = (input: NativeObservationInput): string[] => requireRefs(input,
  targetPaths(input).flatMap((path) => {
    const structured = structuredRoot(input, path);
    if (structured) return [nativeRef(input, "config", path,
      `parser=${structured.extension.slice(1)};pointer=/;keys=${structured.keys.join(",") || "scalar"}`)];
    const source = input.context.project.getSourceFile(resolve(input.context.sealedRoot, path));
    if (!source) return [];
    const declarations = [
      ...source.getInterfaces().map((node) => `interface:${node.getName()}`),
      ...source.getTypeAliases().map((node) => `type:${node.getName()}`),
      ...source.getClasses().map((node) => `class:${node.getName() ?? "default"}`),
    ];
    return declarations.slice(0, 32).map((contract) => nativeRef(input, "config", path,
      `parser=typescript;contract=${contract}`));
  }));

export const observeStaticConfig = (input: NativeObservationInput): string[] => observeStaticContract(input);
export const observeStaticJson = (input: NativeObservationInput): string[] => requireRefs(input,
  targetPaths(input).flatMap((path) => {
    const root = structuredRoot(input, path);
    return root?.extension === ".json" ? [nativeRef(input, "json", path,
      `parser=json;pointer=/;keys=${root.keys.join(",") || "scalar"}`)] : [];
  }));
export const observeStaticYaml = (input: NativeObservationInput): string[] => requireRefs(input,
  targetPaths(input).flatMap((path) => {
    const root = structuredRoot(input, path);
    return root && [".yaml", ".yml"].includes(root.extension) ? [nativeRef(input, "yaml", path,
      `parser=yaml;pointer=/;keys=${root.keys.join(",") || "scalar"}`)] : [];
  }));
