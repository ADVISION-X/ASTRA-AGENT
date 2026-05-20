import { buildOwnerRunnerCommand, loadOwnerManifests, sortOwnerManifests } from "./owner-manifests.js";

// CI-FULL plan — the only complete quality gate.
// Foundation steps stay explicit; owner steps are generated from governed owner manifests.

export type CiFullLayerLabel = "foundation-layer" | "owner-layer";

const CI_FULL_LAYER_ORDER = ["foundation-layer", "owner-layer"] as const;

const CI_FULL_LAYER_EXECUTION = {
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

const FOUNDATION_STEPS: CiFullStepDefinition[] = [
  {
    name: "audit-build",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/build-audit-artifacts.ts"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: [
      "scripts/audit/generated/active-law-census.generated.json",
      "scripts/audit/generated/owner-inspector-matrix.generated.json",
      "scripts/audit/generated/all-law-enforcement-matrix.generated.json",
      "scripts/audit/generated/audit-system-summary.generated.json",
      "scripts/audit/generated/audit-artifact-provenance.generated.json",
    ],
  },
  {
    name: "code-purity-owner",
    layer: "foundation-layer",
    command: ["node", "--import", "tsx", "scripts/audit/domains/code-purity/run-inspector.ts"],
    timeoutMs: STEP_TIMEOUT_MS,
    artifactPaths: [],
  },
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
      "scripts/audit/generated/all-law-enforcement-matrix.generated.json",
      "scripts/audit/generated/audit-system-summary.generated.json",
    ],
  },
];

const buildOwnerSteps = (): CiFullStepDefinition[] =>
  sortOwnerManifests(loadOwnerManifests())
    .filter((manifest) => manifest.capabilityDomain !== "audit-system" && manifest.capabilityDomain !== "code-purity")
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

const getCiFullStepsByLayer = (layer: CiFullLayerLabel): CiFullStepDefinition[] =>
  buildCiFullSteps().filter((s) => s.layer === layer);
