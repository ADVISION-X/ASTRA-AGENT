import { AUTHORING_INPUT_PACKAGE_MUTATIONS } from "./authoring-input-package-negative-proof.js";
import { MAP_PLUGIN_PATHS } from "./constants.js";

const { LAW_FILE: MAP_PLUGIN_LAW_FILE } = MAP_PLUGIN_PATHS;

export type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

export const REQUIRED_MUTATION_NAMES = [
  "macos local smoke missing open-local-program mutation",
  "phase05 diagnostic success path uses review terminal mutation",
  "phase05 diagnostic ai reverted to product presence mutation",
  "facebook non-product scroll path skips geometry mutation",
  "delete binary outcome policy from authoring input package mutation",
  "delete routeLabel prompt requirement mutation",
  "orchestration reintroduces product decision alias mutation",
] as const;

export const MAP_PLUGIN_NEGATIVE_PROOF_MUTATIONS: Mutation[] = [
  ...AUTHORING_INPUT_PACKAGE_MUTATIONS,
  {
    name: "delete binary outcome policy from authoring input package mutation",
    file: "src/map-plugins/authoring/map-authoring-input-package.schema.ts",
    search: "  binaryOutcomePolicy: MapAuthoringBinaryOutcomePolicySchema,\n",
    replace: "",
  },
  {
    name: "delete routeLabel prompt requirement mutation",
    file: "src/map-plugins/authoring/map-authoring-template.ts",
    search: "    \"- Runtime Prompt Contracts for binary product decisions must require AI to output decision plus routeLabel. Orchestration may only match the routeLabel mechanically; it must not infer next actions from product_yes/product_no.\",\n",
    replace: "",
  },
  {
    name: "orchestration reintroduces product decision alias mutation",
    file: "src/capabilities/orchestration/runtime/transition-evaluator.ts",
    search: "const readRouteLabel = (result: MissionStepResultRecord): string | null => {\n",
    replace: "const productyes = \"productyes\";\nconst readRouteLabel = (result: MissionStepResultRecord): string | null => {\n",
  },
  {
    name: "manual-first law regression mutation",
    file: MAP_PLUGIN_LAW_FILE,
    search: "## Law GRASSEYE-MAP-PLUGIN-001-V2\n\nstatus: active  \ntier: P0  \ncapabilityDomain: map-plugin-package  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    replace: "## Law GRASSEYE-MAP-PLUGIN-001-V2\n\nstatus: active  \ntier: P1  \ncapabilityDomain: map-plugin-package  \nenforcementMode: manual-first  \nevidenceMode: law",
  },
  {
    name: "old tiktok product discovery remains loaded mutation",
    file: "src/map-plugins/builtins/index.ts",
    search: '    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),\n',
    replace: '    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),\n    readBuiltin("tiktok-product-discovery.map-package.json"),\n',
  },
  {
    name: "old facebook safe comment map remains loaded mutation",
    file: "src/map-plugins/builtins/index.ts",
    search: '    readBuiltin("facebook-seeding-video-discovery.meta.map-package.json"),\n',
    replace: '    readBuiltin("facebook-seeding-video-discovery.meta.map-package.json"),\n    readBuiltin("facebook-safe-comment-draft-review.map-package.json"),\n',
  },
  {
    name: "old tiktok comment evidence map remains loaded mutation",
    file: "src/map-plugins/builtins/index.ts",
    search: '    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),\n',
    replace: '    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),\n    readBuiltin("tiktok-comment-evidence.map-package.json"),\n',
  },
  {
    name: "old ai draft placeholder remains loaded mutation",
    file: "src/map-plugins/builtins/index.ts",
    search: '    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),\n',
    replace: '    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),\n    readBuiltin("ai-draft-map-placeholder.map-package.json"),\n',
  },
  {
    name: "map package modeled as child ability mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '    "packageKind": "operational-map-package",\n',
    replace: '    "packageKind": "child-capability-package",\n',
  },
  {
    name: "builtin loader direct parse diagnostic bypass mutation",
    file: "src/map-plugins/builtin-loader/builtin-map-package-loader.ts",
    search: "  return parseBuiltinPackage(fileName, JSON.parse(content));\n",
    replace: "  return JSON.parse(content) as MapPackage;\n",
  },
  {
    name: "map package raw prompt mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '  "signature": null\n',
    replace: '  "rawPrompt": "Do the platform action directly.",\n  "signature": null\n',
  },
  {
    name: "map package functionBody mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '  "signature": null\n',
    replace: '  "functionBody": "return \\"mutated\\";",\n  "signature": null\n',
  },
  {
    name: "map package eval string mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '  "changelog": "Initial governed TikTok seeding-video discovery meta map. Replaces legacy builtin maps and exercises only map-routable capability groups while relying on Commander, Orchestration, and Nerve Bus through the governed runtime chain.",\n',
    replace: '  "changelog": "eval(1)",\n',
  },
  {
    name: "map step successCondition forbidden mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '      "promptContractId": "vision.productPresence.v1"\n',
    replace: '      "promptContractId": "vision.productPresence.v1",\n      "successCondition": { "conditionType": "comparison", "leftRef": "status", "operator": "equals", "rightValue": "success" }\n',
  },
  {
    name: "map transition condition forbidden mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '      "onStatus": "success",\n      "toStepId": "judge-seeding-video",\n',
    replace: '      "onStatus": "success",\n      "condition": { "conditionType": "comparison", "leftRef": "schemaFieldRef:decision", "operator": "equals", "rightValue": "product_yes" },\n      "toStepId": "judge-seeding-video",\n',
  },
  {
    name: "delete promptContractId mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: ', "promptContractId": "vision.productPresence.v1"',
    replace: "",
  },
  {
    name: "delete prompt binding mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '      {\n        "stepId": "judge-seeding-video",\n        "promptContractId": "vision.productPresence.v1",\n        "requiredInputRefs": [\n          "promptInputRef"\n        ],\n        "outputSchemaRef": "ai.product_presence_judgment.v1"\n      },\n',
    replace: "",
  },
  {
    name: "unknown promptContractId mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '"promptContractId": "vision.productPresence.v1",',
    replace: '"promptContractId": "vision.productPresence.unknown",',
  },
  {
    name: "prompt outputSchemaRef mismatch mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '"outputSchemaRef": "ai.product_presence_judgment.v1"',
    replace: '"outputSchemaRef": "ai.mismatched_schema.v1"',
  },
  {
    name: "missing geometry proof mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.v1.ts",
    search: 'inputRefs: ["visualTargetRef", "geometryProofRef"],',
    replace: 'inputRefs: ["visualTargetRef"],',
  },
  {
    name: "facebook non-product scroll path skips geometry mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.v1.ts",
    search: '      transitionId: "observe-next-video-region:success",\n      fromStepId: "observe-next-video-region",\n      onStatus: "success",\n      toStepId: "normalize-next-video-region",',
    replace: '      transitionId: "observe-next-video-region:success",\n      fromStepId: "observe-next-video-region",\n      onStatus: "success",\n      toStepId: "scroll-next-video",',
  },
  {
    name: "seeding map duplicates route plan-owned step mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '      {\n        "stepId": "judge-seeding-video",\n        "capabilityId": "orchestration",',
    replace: '      {\n        "stepId": "observe-next-video-region",\n        "capabilityId": "orchestration",\n        "childCapabilityId": "observe-next-video-region",\n        "stepKind": "ability",\n        "targetAbilityGroupId": "visual-target",\n        "inputRefs": [\n          "screenshotEvidenceRef"\n        ],\n        "outputRefPolicy": {\n          "storeAs": [\n            "visualTargetRef"\n          ]\n        },\n        "promptContractId": null\n      },\n      {\n        "stepId": "judge-seeding-video",\n        "capabilityId": "orchestration",',
  },
  {
    name: "seeding map removes route plan id mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '    "mapVersion": "1.0.0",\n    "routePlanId": "product-discovery-route-plan.v1"\n',
    replace: '    "mapVersion": "1.0.0",\n    "routePlanId": null\n',
  },
  {
    name: "seeding map demotes route plan bound kind mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '    "mapKind": "routePlanBoundMap",\n',
    replace: '    "mapKind": "genericDiagnosticMap",\n',
  },
  {
    name: "seeding map owns ai success route mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '      {\n        "transitionId": "judge-seeding-video:failed",\n        "fromStepId": "judge-seeding-video",\n        "onStatus": "failed",\n        "toStepId": null,\n        "finalStatus": "failed"\n      }\n',
    replace: '      {\n        "transitionId": "judge-seeding-video:success",\n        "fromStepId": "judge-seeding-video",\n        "onStatus": "success",\n        "toStepId": "observe-next-video-region",\n        "finalStatus": null\n      },\n      {\n        "transitionId": "judge-seeding-video:failed",\n        "fromStepId": "judge-seeding-video",\n        "onStatus": "failed",\n        "toStepId": null,\n        "finalStatus": "failed"\n      }\n',
  },
  {
    name: "startup preparation spine bypass mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '      {\n        "transitionId": "prepare-ai-input:success",\n        "fromStepId": "prepare-ai-input",\n        "onStatus": "success",\n        "toStepId": "startup-preparation",\n        "finalStatus": null\n      },\n',
    replace: '      {\n        "transitionId": "prepare-ai-input:success",\n        "fromStepId": "prepare-ai-input",\n        "onStatus": "success",\n        "toStepId": "judge-seeding-video",\n        "finalStatus": null\n      },\n',
  },
  {
    name: "activation snapshot proof mutation",
    file: "src/map-plugins/import/map-package-activation.ts",
    search: '  return {\n    activationId: input.activationId,\n    activationSnapshotRef: snapshotFields.activationSnapshotRef,\n    activationSnapshotHash: snapshotFields.activationSnapshotHash,\n',
    replace: '  return {\n    activationId: input.activationId,\n    activationSnapshotHash: snapshotFields.activationSnapshotHash,\n',
  },
  {
    name: "generated capability catalog drift mutation",
    file: "src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json",
    search: '  "version": "2026-04-map-prompt-contract-v1",\n',
    replace: '  "version": "2026-04-map-prompt-contract-v1-tampered",\n',
  },
  {
    name: "routableByMap false mutation",
    file: "src/map-plugins/authoring/capability-catalog/policies.ts",
    search: '  "page-state": {\n    supportedTargets: ["browser-page"],\n    routableByMap: true,\n',
    replace: '  "page-state": {\n    supportedTargets: ["browser-page"],\n    routableByMap: false,\n',
  },
  {
    name: "missing capability child mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '"childCapabilityId": "detect-feed-ready"',
    replace: '"childCapabilityId": "missing-capability-child"',
  },
  {
    name: "open target profile drift mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '    "targetProfileRef": "open-target-profile:open-facebook",\n',
    replace: '    "targetProfileRef": "facebook-web:persistent-local-profile",\n',
  },
  {
    name: "hardcoded capability list in prompt template mutation",
    file: "src/map-plugins/authoring/map-authoring-template.ts",
    search: '    "Static Governance Rules:",\n',
    replace: '    "Static Governance Rules:",\n    "- open-tiktok: stale manual childCapabilityId text",\n',
  },
  {
    name: "gate-passed manifest without validationReportRef mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '    "validationReportRef": "audit://map-plugin-package/builtin.tiktok-seeding-video-discovery/validation/v1",\n',
    replace: '    "validationReportRef": null,\n',
  },
  {
    name: "ai generated active map mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '    "aiGenerated": false,\n',
    replace: '    "aiGenerated": true,\n',
  },
  {
    name: "ordinary feed exposes mapId mutation",
    file: "src/map-plugins/registry/active-map-registry.ts",
    search: '  availability: registration.mapPackage.taskTemplate.availabilityPolicy === "active" ? "ready" : "disabled",\n  defaultHumanGoal: registration.mapPackage.taskTemplate.defaultHumanGoal,\n',
    replace: '  availability: registration.mapPackage.taskTemplate.availabilityPolicy === "active" ? "ready" : "disabled",\n  mapId: registration.mapPackage.manifest.mapId,\n  defaultHumanGoal: registration.mapPackage.taskTemplate.defaultHumanGoal,\n',
  },
  {
    name: "commander direct registry write mutation",
    file: "src/lib/local-app-shell/task-template-registry.ts",
    search: '  const activeRegistry = getLocalAppShellMapRegistry().active;\n',
    replace: '  const activeRegistry = getLocalAppShellMapRegistry().active;\n  if (false) {\n    getLocalAppShellMapRegistry().active.activate({} as never, {} as never);\n  }\n',
  },
  {
    name: "map contains shellCommand mutation",
    file: "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json",
    search: '  "signature": null\n',
    replace: '  "shellCommand": "open -a iPhone Mirroring",\n  "signature": null\n',
  },
  {
    name: "map contains openApp mutation",
    file: "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json",
    search: '  "signature": null\n',
    replace: '  "openApp": "iPhone Mirroring",\n  "signature": null\n',
  },
  {
    name: "map contains osascript mutation",
    file: "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json",
    search: '  "signature": null\n',
    replace: '  "osascript": "tell application \\"iPhone Mirroring\\" to activate",\n  "signature": null\n',
  },
  {
    name: "macos local smoke missing open-local-program mutation",
    file: "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json",
    search: '"childCapabilityId": "open-local-program"',
    replace: '"childCapabilityId": "open-local-workbench"',
  },
  {
    name: "phase05 diagnostic success path uses review terminal mutation",
    file: "src/map-plugins/builtins/phase-05-full-surface-diagnostic.meta.map-package.json",
    search: '"transitionId": "persist-diagnostic-evidence-record:success",\n      "fromStepId": "persist-diagnostic-evidence-record",\n      "onStatus": "success",\n      "toStepId": "finalize-diagnostic-mission",\n      "finalStatus": null',
    replace: '"transitionId": "persist-diagnostic-evidence-record:success",\n      "fromStepId": "persist-diagnostic-evidence-record",\n      "onStatus": "success",\n      "toStepId": "request-human-review",\n      "finalStatus": null',
  },
  {
    name: "phase05 diagnostic ai reverted to product presence mutation",
    file: "src/map-plugins/builtins/phase-05-full-surface-diagnostic.meta.map-package.json",
    search: '"childCapabilityId": "schema-validation-only",',
    replace: '"childCapabilityId": "product-presence-judgment",',
  },
  {
    name: "forensics proof missing activationId mutation",
    file: "src/map-plugins/shared/map-package-proof.ts",
    search: '  activationId: string;\n',
    replace: "",
  },
  {
    name: "remove negative proof invocation mutation",
    file: "scripts/audit/domains/map-plugin-package/inspector.ts",
    search: '    : runNegativeProofHarness();\n',
    replace: '    : Promise.resolve({\n        findings: [],\n        phase: createPhase("negative-proof-harness", "PASS", true, "mutated bypass"),\n      });\n',
  },
  {
    name: "prompt template legacy meta field reintroduced mutation",
    file: "src/lib/local-ai/prompts/vision-product-presence.v1.ts",
    search: '  requiredOutputSchema: {\n    inputMode: "multi_frame_contact_sheet | multi_image | single_frame_fallback",\n',
    replace: '  requiredOutputSchema: {\n    taskType: "vision.productPresence",\n    inputMode: "multi_frame_contact_sheet | multi_image | single_frame_fallback",\n',
  },
];
