import { readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { parseDocument } from "yaml";

import { rejectDuplicateJsonKeys } from "../governance-json.js";
import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorEvaluation, InspectorLawRequirement, InspectorOutput,
} from "./inspector-contracts.js";

const evidenceKind: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
export type StaticLawRoute = Readonly<{
  lawId: string;
  forbiddenCount: number;
}>;
export type StaticInspectorExecutor = (context: InspectorContext) => InspectorEvaluation | Promise<InspectorEvaluation>;

const availableClauses = (route: StaticLawRoute): string[] => [
  ...Array.from({ length: route.forbiddenCount }, (_, index) => `forbidden:${index}`),
  "summary",
].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));

const utf8 = new TextDecoder("utf-8", { fatal: true });
const binarySignatureValid = (extension: string, value: Buffer): boolean => {
  if (extension === ".png") return value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === ".jpg") return value[0] === 0xff && value[1] === 0xd8;
  if (extension === ".pdf") return value.subarray(0, 5).toString("ascii") === "%PDF-";
  if (extension === ".zip") return value[0] === 0x50 && value[1] === 0x4b;
  return false;
};
const inspectTargetObjects = (context: InspectorContext, targetPaths: readonly string[]): void => {
  const root = resolve(context.sealedRoot);
  for (const path of targetPaths) {
    const absolute = resolve(root, path);
    const escaped = relative(root, absolute);
    if (escaped === ".." || escaped.startsWith("../")) fail("TARGET_OUTSIDE_DOMAIN_AUTHORITY", path);
    let value: Buffer;
    try { value = readFileSync(absolute); } catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", path); }
    const extension = extname(path).toLocaleLowerCase("en-US");
    if ([".png", ".jpg", ".pdf", ".zip"].includes(extension)) {
      if (!binarySignatureValid(extension, value)) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:binary-signature`);
      continue;
    }
    let source: string;
    try { source = utf8.decode(value); } catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:utf8`); }
    if (extension === ".json") {
      rejectDuplicateJsonKeys(source, path);
      try { JSON.parse(source); } catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:json`); }
    } else if (extension === ".yaml" || extension === ".yml") {
      const document = parseDocument(source, { strict: true, uniqueKeys: true });
      if (document.errors.length || document.warnings.length) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:yaml`);
    } else if ([".ts", ".mts", ".js", ".mjs"].includes(extension)) {
      const ast = context.project.getSourceFile(absolute);
      if (!ast || ast.getFullText() !== source) fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${path}:ast`);
    }
  }
};

export const finalizeStaticInspection = async (
  context: InspectorContext,
  routes: readonly StaticLawRoute[],
  execute: StaticInspectorExecutor,
): Promise<InspectorOutput> => {
  const executorName = execute.name;
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(executorName)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:unnamed-executor`);
  }
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  if (JSON.stringify(ordered(routes.map((route) => route.lawId))) !== JSON.stringify(requiredIds)
    || routes.some((route) => !Number.isInteger(route.forbiddenCount) || route.forbiddenCount < 1)) {
    fail("LAW_CHECK_ROUTE_MISSING", context.planEntry.capabilityDomain);
  }
  const routesByLaw = new Map(routes.map((route) => [route.lawId, route]));
  for (const requirement of context.lawRequirements) {
    const route = routesByLaw.get(requirement.lawId) ?? fail("LAW_CHECK_ROUTE_MISSING", requirement.lawId);
    const requiredClauses = ordered(Object.values(requirement.clausesByMode).flat());
    const available = availableClauses(route);
    if (!requiredClauses.includes("summary") || requiredClauses.some((clause) => !available.includes(clause))) {
      fail("LAW_CHECK_ROUTE_MISSING", `${requirement.lawId}:clause`);
    }
  }
  const requiredTargets = ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths));
  let evaluation: InspectorEvaluation;
  try { evaluation = await execute(context); }
  catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}`); }
  inspectTargetObjects(context, requiredTargets);
  if (evaluation.capabilityDomain !== context.planEntry.capabilityDomain
    || JSON.stringify(evaluation.reportedLawIds) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}:result`);
  }
  const executionId = `${context.planEntry.capabilityDomain}/${executorName}`;
  const declaredInspected = new Set(evaluation.inspectedFiles);
  if (declaredInspected.size !== evaluation.inspectedFiles.length
    || JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(ordered(evaluation.inspectedFiles))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:inspection-order`);
  }
  if (JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(requiredTargets)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}:target-denominator`);
  }
  const lawResults = context.lawRequirements.map((requirement) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
    return {
      lawId: requirement.lawId,
      assertions: Object.entries(requirement.clausesByMode).map(([mode, clauses]) => ({
        clauses,
        evidenceMode: mode,
        passed: findings.length === 0,
        refs: ordered([
          ...clauses.map((clause) =>
            `${evidenceKind[mode] ?? "file"}:${context.planEntry.ownerInspectorPath}#${encodeURIComponent(`executionId=${executionId};clause=${clause};mode=${mode};targetCount=${requirement.targetSet.count}`)}`),
          requirement.targetSet.queryRef,
        ]),
      })),
      findings,
    };
  });
  return {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: requiredIds,
    lawResults,
    inspectedFiles: evaluation.inspectedFiles,
  };
};
