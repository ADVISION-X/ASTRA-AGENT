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

const EPHEMERAL_CLEANUP_SNIPPETS = [
  "burnEphemeralScreenshotFile",
  "output_is_retained_artifact",
  "rm(input.outputFilePath, { force: true })",
] as const;

type LifecycleEvidenceCheck = {
  path: string;
  snippets: readonly string[];
};

type LifecycleRequirement = {
  file: string;
  message: string;
  evidence: readonly LifecycleEvidenceCheck[];
};

const createLifecycleFinding = (requirement: LifecycleRequirement): Finding =>
  createFinding({
    lawId: LAW_IDS.LIFECYCLE,
    file: requirement.file,
    line: 1,
    severity: "fatal",
    message: requirement.message,
  });

const LIFECYCLE_REQUIREMENTS: readonly LifecycleRequirement[] = [
  {
    file: PATHS.LIFECYCLE_SCHEMA,
    message: "Screenshot lifecycle schema must define budget policy, budget snapshot, cleanup gate, and lifecycle manifest truth.",
    evidence: [{
      path: PATHS.LIFECYCLE_SCHEMA,
      snippets: [
        "ScreenshotArtifactBudgetPolicySchema",
        "ScreenshotArtifactBudgetSnapshotSchema",
        "ScreenshotArtifactLifecycleManifestSchema",
        "ScreenshotArtifactCleanupGateSchema",
      ],
    }],
  },
  {
    file: PATHS.SCHEMA,
    message: "Screenshot schema must project lifecycle manifest, retention, promotion, artifact hash, and byte-size truth.",
    evidence: [{ path: PATHS.SCHEMA, snippets: LIFECYCLE_SCHEMA_SNIPPETS }],
  },
  {
    file: PATHS.LIFECYCLE_RUNTIME,
    message: "Screenshot lifecycle runtime must resolve retention, default non-promotion, TTL, and artifact budget checks.",
    evidence: [{ path: PATHS.LIFECYCLE_RUNTIME, snippets: LIFECYCLE_RUNTIME_SNIPPETS }],
  },
  {
    file: PATHS.PAYLOAD_BUDGET_GATE,
    message: "Screenshot payload budget gate must enforce artifact quota/backpressure before execution.",
    evidence: [{
      path: PATHS.PAYLOAD_BUDGET_GATE,
      snippets: [
        "artifact_budget_exceeded",
        "evaluateScreenshotArtifactBudget",
        "resolveScreenshotRetentionClass",
      ],
    }],
  },
  {
    file: PATHS.ARTIFACT_STORAGE_GATE,
    message: "Screenshot artifact storage gate must write lifecycle metadata and fail closed on budget overflow.",
    evidence: [{
      path: PATHS.ARTIFACT_STORAGE_GATE,
      snippets: [
        "artifact_budget_exceeded",
        "resolveScreenshotArtifactLifecyclePlan",
        "artifactLifecycleManifestRef",
      ],
    }],
  },
  {
    file: PATHS.EPHEMERAL_FILE_CLEANUP,
    message: "Screenshot lifecycle must physically delete ephemeral work files after artifact handoff; only retained artifact storage refs may survive.",
    evidence: [
      { path: PATHS.EPHEMERAL_FILE_CLEANUP, snippets: EPHEMERAL_CLEANUP_SNIPPETS },
      {
        path: PATHS.EXECUTION_ARTIFACT_PHASE,
        snippets: [
          "burnEphemeralScreenshotFile",
          "ephemeral_cleanup_failed",
          "Screenshot ephemeral work file cleanup failed after artifact handoff.",
        ],
      },
    ],
  },
  {
    file: PATHS.OUTPUT_BOUNDARY_GATE,
    message: "Screenshot output boundary gate must verify lifecycle manifest parity and ban self-promotion.",
    evidence: [{ path: PATHS.OUTPUT_BOUNDARY_GATE, snippets: LIFECYCLE_GATE_SNIPPETS }],
  },
] as const;

function sourceContainsAll(path: string, project: Project, snippets: readonly string[]): boolean {
  const text = getSource(project, path).getFullText();
  return snippets.every((snippet) => text.includes(snippet));
}

const requirementIsSatisfied = (project: Project, requirement: LifecycleRequirement): boolean =>
  requirement.evidence.every(({ path, snippets }) => sourceContainsAll(path, project, snippets));

function collectLifecycleTruthFindings(project: Project): Finding[] {
  return LIFECYCLE_REQUIREMENTS.flatMap((requirement) =>
    requirementIsSatisfied(project, requirement) ? [] : [createLifecycleFinding(requirement)]);
}

export { collectLifecycleTruthFindings };
