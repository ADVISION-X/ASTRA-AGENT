import { buildOwnerRunnerCommand, loadOwnerManifests, sortOwnerManifests } from "./owner-manifests.js";

// CI-FULL plan — the only complete quality gate.
// Foundation steps stay explicit; owner steps are generated from governed owner manifests.

export type CiFullLayerLabel = "foundation-layer" | "owner-layer";

export const CI_FULL_LAYER_ORDER = ["foundation-layer", "owner-layer"] as const;

export const CI_FULL_LAYER_EXECUTION = {
  "foundation-layer": { executionMode: "serial" as const },
  "owner-layer": { executionMode: "serial" as const },
} as const;

export type CiFullStepDefinition = {
  name: string;
  layer: CiFullLayerLabel;
  command: readonly [string, ...string[]];
  timeoutMs: number;
  artifactPaths: string[];
};

const STEP_TIMEOUT_MS = 120_000;

export const FOUNDATION_STEPS: CiFullStepDefinition[] = [
  {
    name: "typecheck",
    layer: "foundation-layer",
    command: ["npm", "run", "typecheck"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: [],
  },
  {
    name: "audit:quality-kernel",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/quality-kernel/run-inspector.ts"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: ["scripts/audit/generated/quality-kernel-summary.generated.json"],
  },
  {
    name: "audit:audit-system",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/audit-system/run-inspector.ts"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: [
      "scripts/audit/generated/active-law-census.generated.json",
      "scripts/audit/generated/owner-inspector-matrix.generated.json",
      "scripts/audit/generated/audit-system-summary.generated.json",
    ],
  },
];

export const buildOwnerSteps = (): CiFullStepDefinition[] =>
  sortOwnerManifests(loadOwnerManifests())
    .filter((manifest) => manifest.capabilityDomain !== "audit-system")
    .map((manifest) => ({
      name: manifest.inspectorId,
      layer: "owner-layer" as const,
      command: buildOwnerRunnerCommand(manifest),
      timeoutMs: STEP_TIMEOUT_MS,
      artifactPaths: [],
    }));

export const buildCiFullSteps = (): CiFullStepDefinition[] => [
  ...FOUNDATION_STEPS,
  ...buildOwnerSteps(),
];

export const getCiFullStepsByLayer = (layer: CiFullLayerLabel): CiFullStepDefinition[] =>
  buildCiFullSteps().filter((s) => s.layer === layer);
