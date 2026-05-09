import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import {
  CODE_PURITY_FINDINGS_NDJSON,
  CODE_PURITY_INVENTORY_NDJSON,
  CODE_PURITY_NEGATIVE_PROOF_RESULT,
  CODE_PURITY_REPORT_RESULT,
  CODE_PURITY_SCAN_SUMMARY,
} from "../domains/code-purity/components/purity-stage-paths.js";
import {
  ABILITY_GROUP_SAFE_CONCURRENCY,
  CODE_PURITY_TIMEOUT_MS,
  OWNER_STEP_TIMEOUT_MS,
  QUICK_STEP_TIMEOUT_MS,
} from "./ci-full-timeouts.js";

export type CiFullLayerLabel = "foundation-layer" | "map-layer" | "ability-group-layer";

export const CI_FULL_SUMMARY_CONSUMER = "ci-full-summary" as const;

export const CI_FULL_LAYER_ORDER = ["foundation-layer", "map-layer", "ability-group-layer"] as const;

export const CI_FULL_LAYER_EXECUTION = {
  "foundation-layer": { executionMode: "serial" as const },
  "map-layer": { executionMode: "serial" as const },
  "ability-group-layer": { executionMode: "bounded" as const, maxConcurrency: ABILITY_GROUP_SAFE_CONCURRENCY },
} as const;

export type CiFullCheckOwner = {
  checkId: string;
  layer: CiFullLayerLabel;
  args: string[];
  timeoutMs: number;
  env?: Record<string, string>;
  producer: string;
  allowedConsumers: string[];
  exclusive: true;
  artifactPaths: string[];
};

const OWNER_SKIP_NEGATIVE_PROOF_ENV = {
  GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF: "1",
} as const;

const createCheckOwner = (input: Omit<CiFullCheckOwner, "exclusive">): CiFullCheckOwner => ({
  ...input,
  exclusive: true,
});

export const CI_FULL_CHECK_OWNERS = [
  createCheckOwner({
    checkId: "audit-build",
    layer: "foundation-layer",
    args: ["run", "audit:build"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    producer: "audit:build",
    allowedConsumers: ["code-purity", "audit-system", CI_FULL_SUMMARY_CONSUMER],
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
  createCheckOwner({
    checkId: "code-purity",
    layer: "foundation-layer",
    args: ["run", "audit:code-purity"],
    timeoutMs: CODE_PURITY_TIMEOUT_MS,
    env: {
      GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY: "1",
    },
    producer: "audit:code-purity",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [
      CODE_PURITY_FINDINGS_NDJSON,
      CODE_PURITY_INVENTORY_NDJSON,
      CODE_PURITY_SCAN_SUMMARY,
      CODE_PURITY_REPORT_RESULT,
      CODE_PURITY_NEGATIVE_PROOF_RESULT,
    ],
  }),
  createCheckOwner({
    checkId: "typecheck",
    layer: "foundation-layer",
    args: ["run", "typecheck"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    producer: "typecheck",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "capability-group-governance",
    layer: "foundation-layer",
    args: ["run", "audit:capability-group-governance"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:capability-group-governance",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "type-safety",
    layer: "foundation-layer",
    args: ["run", "audit:type-safety"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    producer: "audit:type-safety",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "security-privacy",
    layer: "foundation-layer",
    args: ["run", "audit:security-privacy"],
    timeoutMs: QUICK_STEP_TIMEOUT_MS,
    producer: "audit:security-privacy",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "audit-system",
    layer: "foundation-layer",
    args: ["run", "audit:audit-system"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:audit-system",
    allowedConsumers: [CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "map-plugin-package",
    layer: "map-layer",
    args: ["run", "audit:map-plugin-package"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:map-plugin-package",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "commander-console",
    layer: "ability-group-layer",
    args: ["run", "audit:commander-console"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:commander-console",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "orchestration",
    layer: "ability-group-layer",
    args: ["run", "audit:orchestration"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:orchestration",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "nerve-bus",
    layer: "ability-group-layer",
    args: ["run", "audit:nerve-bus"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:nerve-bus",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "ai",
    layer: "ability-group-layer",
    args: ["run", "audit:ai"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:ai",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "open",
    layer: "ability-group-layer",
    args: ["run", "audit:open"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:open",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "screenshot",
    layer: "ability-group-layer",
    args: ["run", "audit:screenshot"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:screenshot",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "visual-target",
    layer: "ability-group-layer",
    args: ["run", "audit:visual-target"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:visual-target",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "geometry-guard",
    layer: "ability-group-layer",
    args: ["run", "audit:geometry-guard"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:geometry-guard",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "mouse-click",
    layer: "ability-group-layer",
    args: ["run", "audit:mouse-click"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:mouse-click",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "text-input",
    layer: "ability-group-layer",
    args: ["run", "audit:text-input-capability"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:text-input-capability",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "mouse-scroll",
    layer: "ability-group-layer",
    args: ["run", "audit:mouse-scroll"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:mouse-scroll",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "post-action-verification",
    layer: "ability-group-layer",
    args: ["run", "audit:post-action-verification"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:post-action-verification",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "forensics-persistence",
    layer: "ability-group-layer",
    args: ["run", "audit:forensics-persistence"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:forensics-persistence",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
  createCheckOwner({
    checkId: "page-state",
    layer: "ability-group-layer",
    args: ["run", "audit:page-state"],
    timeoutMs: OWNER_STEP_TIMEOUT_MS,
    env: OWNER_SKIP_NEGATIVE_PROOF_ENV,
    producer: "audit:page-state",
    allowedConsumers: ["audit-system", CI_FULL_SUMMARY_CONSUMER],
    artifactPaths: [],
  }),
] as const;

export const CI_FULL_CHECK_OWNERS_BY_ID = new Map(CI_FULL_CHECK_OWNERS.map((owner) => [owner.checkId, owner] as const));

export const getCiFullOwnership = (checkId: string): CiFullCheckOwner => {
  const ownership = CI_FULL_CHECK_OWNERS_BY_ID.get(checkId);
  if (!ownership) {
    throw new Error(`[CI FULL CONFIG] Missing ownership metadata for ${checkId}.`);
  }

  return ownership;
};

export const getCiFullOwnersByLayer = (layer: CiFullLayerLabel): CiFullCheckOwner[] =>
  CI_FULL_CHECK_OWNERS.filter((owner) => owner.layer === layer);