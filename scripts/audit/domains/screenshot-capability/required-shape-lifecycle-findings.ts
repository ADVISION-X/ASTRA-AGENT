import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getSource } from "./project-access.js";

const LIFECYCLE_SCHEMA_SNIPPETS = [
  "ScreenshotStoredArtifactSchema",
  "artifactBudgetSnapshot",
  "artifactLifecycleManifestRef",
  "retentionClass",
  "promotionStatus",
  "artifactHash",
  "byteSize",
] as const;

const LIFECYCLE_RUNTIME_SNIPPETS = [
  "resolveScreenshotArtifactLifecyclePlan",
  "evaluateScreenshotArtifactBudget",
  'promotionStatus: "not_promoted"',
  "maxPendingTransientBytes",
] as const;

const LIFECYCLE_GATE_SNIPPETS = [
  "ScreenshotArtifactLifecycleManifestSchema.parse",
  "self_promotion_forbidden",
  "artifact_lifecycle_manifest_mismatch",
] as const;

function sourceContainsAll(path: string, project: Project, snippets: readonly string[]): boolean {
  const text = getSource(project, path).getFullText();
  return snippets.every((snippet) => text.includes(snippet));
}

function collectLifecycleTruthFindings(project: Project): Finding[] {
  const findings: Finding[] = [];

  if (!sourceContainsAll(PATHS.LIFECYCLE_SCHEMA, project, [
    "ScreenshotArtifactBudgetPolicySchema",
    "ScreenshotArtifactBudgetSnapshotSchema",
    "ScreenshotArtifactLifecycleManifestSchema",
    "ScreenshotArtifactCleanupGateSchema",
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.LIFECYCLE_SCHEMA, line: 1, severity: "fatal", message: "Screenshot lifecycle schema must define budget policy, budget snapshot, cleanup gate, and lifecycle manifest truth." }));
  }

  if (!sourceContainsAll(PATHS.SCHEMA, project, LIFECYCLE_SCHEMA_SNIPPETS)) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema must project lifecycle manifest, retention, promotion, artifact hash, and byte-size truth." }));
  }

  if (!sourceContainsAll(PATHS.LIFECYCLE_RUNTIME, project, LIFECYCLE_RUNTIME_SNIPPETS)) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.LIFECYCLE_RUNTIME, line: 1, severity: "fatal", message: "Screenshot lifecycle runtime must resolve retention, default non-promotion, TTL, and artifact budget checks." }));
  }

  if (!sourceContainsAll(PATHS.PAYLOAD_BUDGET_GATE, project, [
    "artifact_budget_exceeded",
    "evaluateScreenshotArtifactBudget",
    "resolveScreenshotRetentionClass",
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.PAYLOAD_BUDGET_GATE, line: 1, severity: "fatal", message: "Screenshot payload budget gate must enforce artifact quota/backpressure before execution." }));
  }

  if (!sourceContainsAll(PATHS.ARTIFACT_STORAGE_GATE, project, [
    "artifact_budget_exceeded",
    "resolveScreenshotArtifactLifecyclePlan",
    "artifactLifecycleManifestRef",
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.ARTIFACT_STORAGE_GATE, line: 1, severity: "fatal", message: "Screenshot artifact storage gate must write lifecycle metadata and fail closed on budget overflow." }));
  }

  if (!sourceContainsAll(PATHS.OUTPUT_BOUNDARY_GATE, project, LIFECYCLE_GATE_SNIPPETS)) {
    findings.push(createFinding({ lawId: LAW_IDS.LIFECYCLE, file: PATHS.OUTPUT_BOUNDARY_GATE, line: 1, severity: "fatal", message: "Screenshot output boundary gate must verify lifecycle manifest parity and ban self-promotion." }));
  }

  return findings;
}

export { collectLifecycleTruthFindings };