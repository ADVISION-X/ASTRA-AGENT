import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import {
  CODE_PURITY_FINDINGS_NDJSON,
  CODE_PURITY_INVENTORY_NDJSON,
  CODE_PURITY_REPORT_RESULT,
  CODE_PURITY_SCAN_SUMMARY,
} from "../domains/code-purity/components/purity-stage-paths.js";
import {
  ABILITY_GROUP_SAFE_MAX_CONCURRENCY,
  CODE_PURITY_TIMEOUT_MS,
  OWNER_STEP_TIMEOUT_MS,
  QUICK_STEP_TIMEOUT_MS,
} from "./ci-full-timeouts.js";

export type CiFullLayerLabel = "foundation-layer" | "ability-group-layer";

export const CI_FULL_LAYER_ORDER = ["foundation-layer", "ability-group-layer"] as const;

export const CI_FULL_LAYER_EXECUTION = {
  "foundation-layer": { executionMode: "serial" as const },
  "ability-group-layer": { executionMode: "bounded" as const, maxConcurrency: ABILITY_GROUP_SAFE_MAX_CONCURRENCY },
} as const;

export type CiFullStepDefinition = {
  name: string;
  layer: CiFullLayerLabel;
  command: readonly [string, ...string[]];
  timeoutMs: number;
  artifactPaths: string[];
};

const createStep = (input: CiFullStepDefinition): CiFullStepDefinition => ({
  ...input,
  command: [...input.command] as readonly [string, ...string[]],
  artifactPaths: [...input.artifactPaths],
});

const CI_FULL_STEPS = [
  createStep({
    name: "audit-build",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/build-audit-artifacts-cli.ts"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    artifactPaths: [
      generatedArtifactPaths.lawRegistry,
      generatedArtifactPaths.enforcementMatrixJson,
      generatedArtifactPaths.enforcementMatrixYaml,
      generatedArtifactPaths.auditPlan,
      generatedArtifactPaths.auditConflicts,
      generatedArtifactPaths.staticClauseCoverage,
      generatedArtifactPaths.touchedFiles,
    ],
  }),
  createStep({
    name: "code-purity",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/code-purity/run-inspector.ts"],
    timeoutMs: CODE_PURITY_TIMEOUT_MS,
    artifactPaths: [
      CODE_PURITY_FINDINGS_NDJSON,
      CODE_PURITY_INVENTORY_NDJSON,
      CODE_PURITY_SCAN_SUMMARY,
      CODE_PURITY_REPORT_RESULT,
    ],
  }),
  createStep({
    name: "typecheck",
    layer: "foundation-layer",
    command: ["npm", "run", "typecheck"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "capability-group-governance",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/capability-group-governance/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "type-safety",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/type-safety/run-inspector.ts"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "security-privacy",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/security-privacy/run-inspector.ts"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "audit-system",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/audit-system/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "commander-console",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/commander-console-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "orchestration",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/orchestration-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "nerve-bus",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/nerve-bus-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "ai",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/ai-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "open",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/open-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "screenshot",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/screenshot-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "visual-target",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/visual-target-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "geometry-guard",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/geometry-guard-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "mouse-click",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/mouse-click-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "text-input",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/text-input-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "mouse-scroll",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/mouse-scroll-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "post-action-verification",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/post-action-verification-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
  createStep({
    name: "forensics-persistence",
    layer: "ability-group-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/forensics-persistence-capability/run-inspector.ts"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    artifactPaths: [],
  }),
] as const;

export const getCiFullStepsByLayer = (layer: CiFullLayerLabel): CiFullStepDefinition[] =>
  CI_FULL_STEPS.filter((step) => step.layer === layer);