import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { parseDocument } from "yaml";

import { rejectDuplicateJsonKeys } from "../governance-json.js";
import { fail } from "../governance-runtime.js";
import type { InspectorContext } from "./inspector-contracts.js";
import { observeTypeCheckerRelations } from "./typechecker-observation.js";

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

const observationDigest = (facts: readonly (string | Buffer)[]): string =>
  createHash("sha256").update(facts.map((fact) => Buffer.isBuffer(fact) ? fact.toString("hex") : fact)
    .sort().join("\0")).digest("hex");
const observationCache = new WeakMap<InspectorContext, Map<string, string>>();

export const observeStaticMode = (context: InspectorContext, evidenceMode: string): string => {
  const cache = observationCache.get(context) ?? new Map<string, string>();
  observationCache.set(context, cache);
  const cached = cache.get(evidenceMode);
  if (cached) return cached;
  const targetPaths = context.targetPaths ?? context.lawRequirements.flatMap((requirement) => requirement.targetPaths);
  if (evidenceMode === "static.types") {
    const observation = observeTypeCheckerRelations(context.project, targetPaths);
    cache.set(evidenceMode, observation);
    return observation;
  }
  const root = resolve(context.sealedRoot);
  const facts = targetPaths.map((path) => {
    const absolute = resolve(root, path);
    const value = readFileSync(absolute);
    const sourceFile = context.project.getSourceFile(absolute);
    if (evidenceMode === "static.filesystem") {
      return `${path}:file:${value.byteLength}`;
    }
    if (evidenceMode === "static.ast") {
      if (!sourceFile) return `${path}:text:${observationDigest([value.toString("utf8")])}`;
      return `${path}:ast:${observationDigest(sourceFile.getDescendants().map((node) => String(node.getKind())))}`;
    }
    if (evidenceMode === "static.dependency") {
      if (!sourceFile) return `${path}:no-module-edges`;
      const imports = sourceFile.getImportDeclarations().map((entry) => `import:${entry.getModuleSpecifierValue()}`);
      const exports = sourceFile.getExportDeclarations().map((entry) =>
        `export:${entry.getModuleSpecifierValue() ?? "local"}`);
      return `${path}:edges:${observationDigest([...imports, ...exports])}`;
    }
    if (["static.config", "static.contract", "static.json", "static.migration", "static.sql", "static.text", "static.yaml"]
      .includes(evidenceMode)) {
      return `${path}:parsed-object:${observationDigest([value])}`;
    }
    return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${evidenceMode}:native-observation-mode`);
  });
  if (!facts.length) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${evidenceMode}:native-observation-empty`);
  const observation = `${evidenceMode}:${observationDigest(facts)}`;
  cache.set(evidenceMode, observation);
  return observation;
};
