// CI-FULL plan — minimal quality kernel phase.
// Current stage: ci:full is equivalent to ci:simple (typecheck + quality-kernel only).
// Owner-by-owner inspector universe has been physically removed.
// Re-introduce per-capability inspectors only after the simplified production system is stable.

export type CiFullLayerLabel = "foundation-layer";

export const CI_FULL_LAYER_ORDER = ["foundation-layer"] as const;

export const CI_FULL_LAYER_EXECUTION = {
  "foundation-layer": { executionMode: "serial" as const },
} as const;

export type CiFullStepDefinition = {
  name: string;
  layer: CiFullLayerLabel;
  command: readonly [string, ...string[]];
  timeoutMs: number;
  artifactPaths: string[];
};

const STEP_TIMEOUT_MS = 120_000;

export const CI_FULL_STEPS: CiFullStepDefinition[] = [
  {
    name: "typecheck",
    layer: "foundation-layer",
    command: ["npm", "run", "typecheck"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: [],
  },
  {
    name: "quality-kernel",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/quality-kernel/run-inspector.ts"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: ["scripts/audit/generated/quality-kernel-summary.generated.json"],
  },
  {
    name: "dom-automation-owner",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/dom-automation/run-inspector.ts"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: [],
  },
];

export const getCiFullStepsByLayer = (layer: CiFullLayerLabel): CiFullStepDefinition[] =>
  CI_FULL_STEPS.filter((s) => s.layer === layer);
