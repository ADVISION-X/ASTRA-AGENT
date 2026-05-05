import { AUTHORING_INPUT_PACKAGE_MUTATIONS } from "./authoring-input-package-negative-proof.js";
import { MAP_PLUGIN_PATHS } from "./constants.js";

const { LAW_FILE: MAP_PLUGIN_LAW_FILE } = MAP_PLUGIN_PATHS;

export type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

export const MAP_PLUGIN_NEGATIVE_PROOF_MUTATIONS: Mutation[] = [
  ...AUTHORING_INPUT_PACKAGE_MUTATIONS,
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
    file: "src/map-plugins/builtins/index.ts",
    search: "  return parseBuiltinPackage(fileName, JSON.parse(content));\n",
    replace: "  return MapPackageSchema.parse(JSON.parse(content));\n",
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
    name: "bare decision branch mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "schemaFieldRef:decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "conditionType": "comparison", "leftRef": "decision", "operator": "equals", "rightValue": "product_yes" }',
  },
  {
    name: "legacy branch dsl mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "schemaFieldRef:decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "source": "decision", "equals": "product_yes" }',
  },
  {
    name: "branch undeclared field mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "schemaFieldRef:decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "conditionType": "comparison", "leftRef": "schemaFieldRef:decisionDetail", "operator": "equals", "rightValue": "product_yes" }',
  },
  {
    name: "branch non schema ref mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "schemaFieldRef:decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "conditionType": "comparison", "leftRef": "decisionDetail", "operator": "equals", "rightValue": "product_yes" }',
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
    search: '      { "stepId": "judge-seeding-video", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "judge-seeding-video:failed" },\n',
    replace: "",
  },
  {
    name: "unknown promptContractId mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '      { "stepId": "judge-seeding-video", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "judge-seeding-video:failed" }',
    replace: '      { "stepId": "judge-seeding-video", "promptContractId": "vision.productPresence.unknown", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "judge-seeding-video:failed" }',
  },
  {
    name: "prompt outputSchemaRef mismatch mutation",
    file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
    search: '      { "stepId": "judge-seeding-video", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "judge-seeding-video:failed" }',
    replace: '      { "stepId": "judge-seeding-video", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.mismatched_schema.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "judge-seeding-video:failed" }',
  },
  {
    name: "missing post-action verification mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: ', "postActionVerification": { "required": true, "verificationKind": "panel-open", "expectedSignal": "comment-panel-visible", "timeoutMs": 5000, "onPassTransitionId": "verify-comments-open:success", "onFailTransitionId": "verify-comments-open:failed", "onAmbiguousTransitionId": "verify-comments-open:review" }',
    replace: "",
  },
  {
    name: "missing geometry proof mutation",
    file: "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
    search: '"inputRefs": ["visualTargetRef", "geometryProofRef"]',
    replace: '"inputRefs": ["visualTargetRef"]',
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
    name: "approved manifest without validationReportRef mutation",
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
    replace: '  const activeRegistry = getLocalAppShellMapRegistry().active;\n  getLocalAppShellMapRegistry().active.activate({} as never, {} as never);\n',
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
];
