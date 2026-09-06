import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { completeGptPageEvidenceCaptureFailures, gptPageEvidencePrivacyFailures }
  from "../audit/domains/gpt/gpt-page-evidence-closure-inspection.js";

const ROOT = resolve(".");
const REPORT_PATH = "docs/项目方案/GPT页面操作子能力实证资料.json";
const REPORT_SCHEMA = "gpt-page-operation-evidence.v5";
const ACTIVE_LAW_PATH = ".github/instructions/agent-rules/功能法案.md";
const BLUEPRINT_PATH = "docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md";
const SHARED_PAGE_PATHS = new Set([
  "src/capabilities/gpt/contract.ts",
  "src/capabilities/gpt/child-types.ts",
  "src/capabilities/gpt/schema.ts",
]);

const sha256 = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const statusPaths = (): string[] => execFileSync("git", ["-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"], {
  cwd: ROOT, encoding: "utf8",
}).split("\n").filter(Boolean).map((line) => {
  const raw = line.slice(3);
  return raw.includes(" -> ") ? raw.slice(raw.indexOf(" -> ") + 4) : raw;
}).map((path) => path.replace(/^"|"$/gu, ""));

const changedText = (path: string): string => {
  try {
    return execFileSync("git", ["diff", "--unified=0", "HEAD", "--", path], {
      cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    }).split("\n").filter((line) => /^[+-](?![+-])/u.test(line)).join("\n");
  } catch { return ""; }
};

type EvidenceChild = Record<string, unknown> & {
  childCapabilityId: string;
  pageOperationRequired: boolean;
  captureComplete: boolean;
  evidenceDemand: Record<string, unknown> & {
    digest: string;
    sourceBinding: Record<string, { files?: Array<{ path?: string; contentHash?: string }> }>;
  };
  collection?: { factBindings?: Array<{ factId?: string }> };
};

type EvidenceScope = Readonly<Record<string, readonly string[]>>;

const requestedEvidenceScope = (): EvidenceScope => {
  const raw = process.env.GPT_PAGE_EVIDENCE_SCOPE;
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("scope-object");
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.some(([, facts]) => !Array.isArray(facts) || facts.length === 0
      || facts.some((fact) => typeof fact !== "string" || fact.length === 0))) throw new Error("scope-facts");
    return Object.fromEntries(entries.map(([id, facts]) => [id, [...new Set(facts as string[])].sort()]));
  } catch {
    throw new Error("GPT_PAGE_EVIDENCE_SCOPE_INVALID");
  }
};

const operationalBoundPaths = (child: EvidenceChild): string[] => Object.entries(child.evidenceDemand.sourceBinding ?? {})
  .filter(([kind]) => kind !== "authority")
  .flatMap(([, binding]) => binding.files ?? [])
  .flatMap((entry) => typeof entry.path === "string" ? [entry.path] : []);

const childIdsMentionedByDiff = (path: string, ids: readonly string[]): string[] => {
  const text = changedText(path);
  return ids.filter((id) => text.includes(id));
};

export const affectedGptPageChildren = (paths: readonly string[], children: readonly EvidenceChild[]): string[] => {
  const ids = children.map((child) => child.childCapabilityId);
  const affected = new Set<string>();
  for (const path of paths) {
    const direct = path.match(/^src\/capabilities\/gpt\/children\/([^/]+)\//u)?.[1];
    if (direct && ids.includes(direct)) affected.add(direct);
    for (const child of children) if (operationalBoundPaths(child).includes(path)) affected.add(child.childCapabilityId);
    if (path.startsWith("src/plugins/") || path.startsWith("src/capabilities/gpt/web/")) {
      const text = `${changedText(path)}\n${existsSync(resolve(ROOT, path)) ? readFileSync(resolve(ROOT, path), "utf8") : ""}`;
      for (const id of ids.filter((id) => text.includes(id))) affected.add(id);
    }
    if (SHARED_PAGE_PATHS.has(path)) {
      const mentioned = childIdsMentionedByDiff(path, ids);
      for (const id of mentioned.length > 0 ? mentioned : ids) affected.add(id);
    }
    if (path === ACTIVE_LAW_PATH || path === BLUEPRINT_PATH) {
      for (const id of childIdsMentionedByDiff(path, ids)) affected.add(id);
    }
  }
  return [...affected].sort();
};

export const gptPageEvidenceChangeGateFailures = (
  report: Record<string, unknown>,
  paths: readonly string[],
): string[] => {
  const failures: string[] = [];
  const requestedScope = requestedEvidenceScope();
  if (report.schemaVersion !== REPORT_SCHEMA) failures.push("report-schema");
  if (report.productionRuntimeConsumer !== false || report.claimsQualityVerdict !== false) failures.push("report-role");
  const rawChildren = Array.isArray(report.children) ? report.children : [];
  const children = rawChildren.filter((entry): entry is EvidenceChild => Boolean(entry)
    && typeof entry === "object" && !Array.isArray(entry)
    && typeof (entry as { childCapabilityId?: unknown }).childCapabilityId === "string"
    && (entry as { pageOperationRequired?: unknown }).pageOperationRequired === true);
  if (children.length !== 22 || new Set(children.map((child) => child.childCapabilityId)).size !== 22) {
    failures.push("page-child-denominator");
  }
  if (gptPageEvidencePrivacyFailures(report).length > 0) failures.push("privacy");
  const affected = affectedGptPageChildren(paths, children);
  for (const child of children) {
    const authorityPaths = child.evidenceDemand?.sourceBinding?.authority?.files?.map((entry) => entry.path) ?? [];
    if (!authorityPaths.includes(ACTIVE_LAW_PATH) || !authorityPaths.includes(BLUEPRINT_PATH)) {
      failures.push(`${child.childCapabilityId}:authority-binding`);
    }
    for (const binding of Object.values(child.evidenceDemand?.sourceBinding ?? {})) {
      for (const entry of binding.files ?? []) {
        if (!entry.path || !entry.contentHash || !existsSync(resolve(ROOT, entry.path))
          || sha256(readFileSync(resolve(ROOT, entry.path))) !== entry.contentHash) {
          failures.push(`${child.childCapabilityId}:source-stale:${entry.path ?? "missing"}`);
        }
      }
    }
    if (child.captureComplete === true) {
      for (const failure of completeGptPageEvidenceCaptureFailures(child, child.evidenceDemand)) {
        failures.push(`${child.childCapabilityId}:capture:${failure}`);
      }
    }
  }
  for (const id of affected) {
    const child = children.find((entry) => entry.childCapabilityId === id);
    if (!child) {
      failures.push(`${id}:not-admitted`);
      continue;
    }
    if (child.captureComplete !== true) {
      const admittedFacts = new Set((child.collection?.factBindings ?? [])
        .flatMap((binding) => typeof binding.factId === "string" ? [binding.factId] : []));
      const requestedFacts = requestedScope[id] ?? [];
      if (requestedFacts.length === 0) failures.push(`${id}:observation-scope-required`);
      for (const factId of requestedFacts.filter((factId) => !admittedFacts.has(factId))) {
        failures.push(`${id}:fact-not-admitted:${factId}`);
      }
      continue;
    }
    for (const failure of completeGptPageEvidenceCaptureFailures(child, child.evidenceDemand)) {
      failures.push(`${id}:targeted-capture:${failure}`);
    }
  }
  return [...new Set(failures)];
};

function main(): void {
  const absolute = resolve(ROOT, REPORT_PATH);
  if (!existsSync(absolute)) throw new Error("GPT_PAGE_EVIDENCE_REPORT_REQUIRED");
  const report = JSON.parse(readFileSync(absolute, "utf8")) as Record<string, unknown>;
  const paths = statusPaths();
  const failures = gptPageEvidenceChangeGateFailures(report, paths);
  if (failures.length > 0) {
    throw new Error(`GPT_PAGE_EVIDENCE_CHANGE_GATE_FAILED:${failures.slice(0, 30).join(",")}`);
  }
  process.stdout.write(`${JSON.stringify({ status: "ADMITTED", affectedChildren: affectedGptPageChildren(
    paths,
    (report.children as EvidenceChild[]).filter((child) => child.pageOperationRequired),
  ) })}\n`);
}

main();
