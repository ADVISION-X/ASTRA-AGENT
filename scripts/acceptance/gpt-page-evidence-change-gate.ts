import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  gptPageEvidencePrivacyFailures,
}
  from "../audit/domains/gpt/gpt-page-evidence-capture-inspection.js";

const ROOT = resolve(".");
const REPORT_PATH = "docs/项目方案/GPT页面操作子能力实证资料.json";
const REPORT_SCHEMA = "gpt-page-operation-evidence.v7";
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
  evidenceDemand: Record<string, unknown> & {
    digest: string;
    pageDemandDigest?: string;
    sourceBinding: Record<string, { files?: Array<{ path?: string; contentHash?: string }> }>;
  };
};

type EvidenceScope = Readonly<Record<string, readonly string[]>>;

const record = (value: unknown): Record<string, unknown> | null => value
  && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const productCallsForChild = (
  report: Record<string, unknown>, childId: string,
): Array<{ run: Record<string, unknown>; call: Record<string, unknown> }> => {
  const products = Array.isArray(report.products) ? report.products : [];
  return products.flatMap((product) => {
    const runs = Array.isArray(record(product)?.runs) ? record(product)!.runs as unknown[] : [];
    return runs.flatMap((run) => {
      const calls = Array.isArray(record(run)?.calls) ? record(run)!.calls as unknown[] : [];
      return calls.flatMap((call) => record(call)?.childId === childId && record(run) && record(call)
        ? [{ run: record(run)!, call: record(call)! }] : []);
    });
  });
};

const productCallCurrentForChild = (
  child: EvidenceChild, candidate: { run: Record<string, unknown>; call: Record<string, unknown> },
): boolean => {
  const snapshot = record(candidate.call.pageRequirementSnapshot);
  const context = record(candidate.run.captureContext);
  return snapshot?.childCandidateDigest === child.evidenceDemand.childCandidateDigest
    && Array.isArray(context?.sceneManifest) && record(candidate.call.domEvidence) !== null
    && Array.isArray(record(candidate.call.domEvidence)?.specimens);
};

const callHasCompleteDomEvidence = (call: Record<string, unknown>): boolean => {
  const domEvidence = record(call.domEvidence);
  return call.captureComplete === true && Array.isArray(call.gaps) && call.gaps.length === 0
    && Array.isArray(domEvidence?.specimens) && domEvidence.specimens.length > 0;
};

const scopedProductCallFactFailures = (
  child: EvidenceChild, candidates: Array<{ run: Record<string, unknown>; call: Record<string, unknown> }>,
  factIds: readonly string[],
): string[] => {
  const current = candidates.filter((candidate) => productCallCurrentForChild(child, candidate));
  const currentFactIds = new Set((Array.isArray(child.evidenceDemand.facts)
    ? child.evidenceDemand.facts : []).flatMap((fact) => {
    const value = record(fact)?.factId;
    return typeof value === "string" ? [value] : [];
  }));
  const unknownFacts = factIds.filter((factId) => !currentFactIds.has(factId));
  if (unknownFacts.length > 0) return unknownFacts.map((factId) => `current-demand-missing:${factId}`);
  const scoped = current.length > 0 ? current : candidates;
  if (current.some(({ call }) => callHasCompleteDomEvidence(call))) return [];
  const failures: string[] = [];
  for (const factId of factIds) {
    const observed = scoped.some(({ run, call }) => {
      const context = record(run.captureContext)!;
      const domEvidence = record(call.domEvidence);
      if (!Array.isArray(context?.sceneManifest) || !Array.isArray(domEvidence?.specimens)) return false;
      const scenes = (context.sceneManifest as unknown[]).flatMap((entry) => record(entry) ? [record(entry)!] : []);
      const specimens = (domEvidence.specimens as unknown[])
        .flatMap((entry) => record(entry) ? [record(entry)!] : []);
      return specimens.some((specimen) => {
        const scene = scenes.find((entry) => entry.sceneId === specimen.sourceSceneId);
        const sceneBound = Boolean(scene) && scene!.stateSignature === specimen.sourceSceneSignature
          && record(scene!.binding)?.captureEpoch === run.captureEpoch;
        if (!sceneBound) return false;
        if (factId.startsWith("live-state:")) return specimen.stateId === factId.slice("live-state:".length);
        if (factId.startsWith("target:")) {
          const target = record(record(specimen.core)?.targets)?.[factId.slice("target:".length)];
          return record(target)?.observed === true;
        }
        return false;
      });
    });
    if (!observed) failures.push(`fact-not-observed:${factId}`);
  }
  return failures;
};

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

const operationalBoundPaths = (child: EvidenceChild): string[] => Object.entries(
  child.evidenceDemand.sourceBinding ?? {},
)
  .filter(([kind]) => kind === "implementation" || kind === "browser")
  .flatMap(([, binding]) => binding.files ?? [])
  .flatMap((entry) => typeof entry.path === "string" ? [entry.path] : []);

const childImplementationPaths = (child: EvidenceChild): string[] =>
  (child.evidenceDemand.sourceBinding?.implementation?.files ?? [])
    .flatMap((entry) => typeof entry.path === "string" ? [entry.path] : []);

const childIdsMentionedByDiff = (path: string, ids: readonly string[]): string[] => {
  const text = changedText(path);
  return ids.filter((id) => text.includes(id));
};

const headPageDemandDigests = (): ReadonlyMap<string, string> => {
  try {
    const head = JSON.parse(execFileSync("git", ["show", `HEAD:${REPORT_PATH}`], {
      cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    })) as Record<string, unknown>;
    const children = Array.isArray(head.children) ? head.children : [];
    return new Map(children.flatMap((entry) => {
      const child = record(entry);
      const demand = record(child?.evidenceDemand);
      return typeof child?.childCapabilityId === "string" && typeof demand?.pageDemandDigest === "string"
        ? [[child.childCapabilityId, demand.pageDemandDigest] as const] : [];
    }));
  } catch { return new Map(); }
};

const productEvidenceRequiredByChange = (
  id: string,
  child: EvidenceChild,
  paths: readonly string[],
): boolean => paths.some((path) => {
  const direct = path.match(/^src\/capabilities\/gpt\/children\/([^/]+)\//u)?.[1];
  if (direct === id || childImplementationPaths(child).includes(path)) {
    return true;
  }
  if (path.startsWith("src/plugins/") || path.startsWith("src/capabilities/gpt/web/")) {
    return changedText(path).includes(id);
  }
  return (SHARED_PAGE_PATHS.has(path) || path === ACTIVE_LAW_PATH || path === BLUEPRINT_PATH)
    && childIdsMentionedByDiff(path, [id]).length === 1;
});

export const affectedGptPageChildren = (paths: readonly string[], children: readonly EvidenceChild[]): string[] => {
  const ids = children.map((child) => child.childCapabilityId);
  const affected = new Set<string>();
  for (const path of paths) {
    if (path.endsWith("/page-evidence-contract.json")) continue;
    const direct = path.match(/^src\/capabilities\/gpt\/children\/([^/]+)\//u)?.[1];
    if (direct && ids.includes(direct)) affected.add(direct);
    for (const child of children) if (operationalBoundPaths(child).includes(path)) affected.add(child.childCapabilityId);
    if (path.startsWith("src/plugins/") || path.startsWith("src/capabilities/gpt/web/")) {
      const text = changedText(path);
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

const childBindingFailures = (child: EvidenceChild): string[] => {
  const failures: string[] = [];
  const authorityPaths = child.evidenceDemand?.sourceBinding?.authority?.files?.map((entry) => entry.path) ?? [];
  if (!authorityPaths.includes(ACTIVE_LAW_PATH) || !authorityPaths.includes(BLUEPRINT_PATH)) {
    failures.push(`${child.childCapabilityId}:authority-binding`);
  }
  for (const [kind, binding] of Object.entries(child.evidenceDemand?.sourceBinding ?? {})) {
    for (const entry of binding.files ?? []) {
      if (kind === "authority" && entry.path
        && [ACTIVE_LAW_PATH, BLUEPRINT_PATH].includes(entry.path)
        && childIdsMentionedByDiff(entry.path, [child.childCapabilityId]).length === 0) continue;
      if (!entry.path || !entry.contentHash || !existsSync(resolve(ROOT, entry.path))
        || sha256(readFileSync(resolve(ROOT, entry.path))) !== entry.contentHash) {
        failures.push(`${child.childCapabilityId}:source-stale:${entry.path ?? "missing"}`);
      }
    }
  }
  return failures;
};

const affectedChildFailures = (
  id: string,
  children: readonly EvidenceChild[],
  requestedScope: EvidenceScope,
  report: Record<string, unknown>,
  paths: readonly string[],
  baselinePageDemand: ReadonlyMap<string, string>,
): string[] => {
  const child = children.find((entry) => entry.childCapabilityId === id);
  if (!child) return [`${id}:not-admitted`];
  const browserImplementationOnly = !productEvidenceRequiredByChange(id, child, paths);
  if (browserImplementationOnly
    && child.evidenceDemand.pageDemandDigest === baselinePageDemand.get(id)) return [];
  const productCalls = productCallsForChild(report, id);
  if (productCalls.length === 0) return [`${id}:product-call-evidence-required`];
  if (productCalls.some((candidate) => productCallCurrentForChild(child, candidate)
    && callHasCompleteDomEvidence(candidate.call))) return [];
  const requestedFacts = requestedScope[id] ?? [];
  return [
    ...(requestedFacts.length === 0 ? [`${id}:observation-scope-required`] : []),
    ...scopedProductCallFactFailures(child, productCalls, requestedFacts)
      .map((failure) => `${id}:scoped-capture:${failure}`),
  ];
};

export const gptPageEvidenceChangeGateFailures = (
  report: Record<string, unknown>,
  paths: readonly string[],
): string[] => {
  const failures: string[] = [];
  const requestedScope = requestedEvidenceScope();
  const baselinePageDemand = headPageDemandDigests();
  if (report.schemaVersion !== REPORT_SCHEMA) failures.push("report-schema");
  const rawChildren = Array.isArray(report.children) ? report.children : [];
  const children = rawChildren.filter((entry): entry is EvidenceChild => Boolean(entry)
    && typeof entry === "object" && !Array.isArray(entry)
    && typeof (entry as { childCapabilityId?: unknown }).childCapabilityId === "string"
    && (entry as { pageOperationRequired?: unknown }).pageOperationRequired === true);
  if (children.length !== 13 || new Set(children.map((child) => child.childCapabilityId)).size !== 13) {
    failures.push("page-child-denominator");
  }
  if (gptPageEvidencePrivacyFailures(report).length > 0) failures.push("privacy");
  const affected = affectedGptPageChildren(paths, children);
  const browserRoutes = new Map<string, string[]>();
  for (const child of children) {
    for (const entry of child.evidenceDemand.sourceBinding?.browser?.files ?? []) {
      if (!entry.path) continue;
      browserRoutes.set(entry.path, [...(browserRoutes.get(entry.path) ?? []), child.childCapabilityId]);
    }
  }
  for (const [path, ids] of browserRoutes) {
    const routed = new Set(affectedGptPageChildren([path], children));
    if (ids.some((id) => !routed.has(id))) failures.push(`browser-binding-routing:${path}`);
  }
  for (const child of children) failures.push(...childBindingFailures(child));
  for (const id of affected) failures.push(...affectedChildFailures(
    id, children, requestedScope, report, paths, baselinePageDemand,
  ));
  return [...new Set(failures)];
};

function main(): void {
  const absolute = resolve(ROOT, REPORT_PATH);
  if (!existsSync(absolute)) throw new Error("GPT_PAGE_EVIDENCE_REPORT_REQUIRED");
  execFileSync(process.execPath, ["--import", "tsx",
    resolve(ROOT, ".agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs"), "validate",
    "--repo", ROOT,
    "--matrix", resolve(ROOT, "src/capabilities/gpt/page-operation-matrix.json"),
    "--report", absolute,
  ], { cwd: ROOT, encoding: "utf8", stdio: "pipe", maxBuffer: 32 * 1024 * 1024 });
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
