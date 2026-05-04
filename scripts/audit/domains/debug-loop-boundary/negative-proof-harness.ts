import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/debug-loop-boundary/inspector.ts";
const REQUIRED_MUTATION_NAMES = [
  "add debug-loop as ability group",
  "debug-loop imports mouse-click executor",
  "debug-loop imports text-input executor",
  "debug-loop imports screenshot executor",
  "debug-loop imports Orchestration dispatcher",
  "debug-loop imports Nerve Bus dispatcher",
  "mission-runtime imports browser controller",
  "mission-runtime calls page.click",
  "mission-runtime calls page.screenshot",
  "scenario contains clickSelector",
  "scenario contains pageEvaluate",
  "scenario contains abilityCall",
  "scenario contains autoPostComment=true",
  "debug-loop imports Forensics writer",
  "debug-loop writes active registry",
  "debug-loop writes activationSnapshotRef",
  "debug-loop writes raw cookie to repair packet",
  "fake authoring marks draft map active",
  "fake authoring skips validation",
  "turn P0 into warning-only",
  "remove negative proof invocation",
] as const;
const TASK_PUBLISHER = "scripts/debug-loop/task-publisher.mjs";
const MAP_AUTHORING = "scripts/debug-loop/map-authoring-public-contract.mjs";
const REPAIR_PACKET = "scripts/debug-loop/repair-packet-writer.mjs";
const NEGATIVE_PROOF = "scripts/audit/domains/debug-loop-boundary/negative-proof-harness.ts";

const MUTATIONS: Mutation[] = [
  { name: REQUIRED_MUTATION_NAMES[0], file: "docs/法案辅助文件/GrassEye 法案冻结基线.md", search: "14. page-state", replace: "14. page-state\n15. debug-loop-controller" },
  { name: REQUIRED_MUTATION_NAMES[1], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedMouseClick = toImportHref(\"src/capabilities/mouse-click/runtime/mouse-click-executor.ts\");\n  void leakedMouseClick;" },
  { name: REQUIRED_MUTATION_NAMES[2], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedTextInput = toImportHref(\"src/capabilities/text-input/runtime/text-input-executor.ts\");\n  void leakedTextInput;" },
  { name: REQUIRED_MUTATION_NAMES[3], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedScreenshot = toImportHref(\"src/capabilities/screenshot/runtime/screenshot-executor.ts\");\n  void leakedScreenshot;" },
  { name: REQUIRED_MUTATION_NAMES[4], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedOrchestrationDispatcher = toImportHref(\"src/capabilities/orchestration/runtime/orchestration-dispatcher.ts\");\n  void leakedOrchestrationDispatcher;" },
  { name: REQUIRED_MUTATION_NAMES[5], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedNerveBusDispatch = toImportHref(\"src/capabilities/nerve-bus/runtime/dispatch-envelope.ts\");\n  void leakedNerveBusDispatch;" },
  { name: REQUIRED_MUTATION_NAMES[6], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedBrowserControllerPath = \"src/lib/browser/current-chrome-browser-controller.ts\";\n  void leakedBrowserControllerPath;" },
  { name: REQUIRED_MUTATION_NAMES[7], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedPageClick = \"page.click('#submit')\";\n  void leakedPageClick;" },
  { name: REQUIRED_MUTATION_NAMES[8], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedPageScreenshot = \"page.screenshot()\";\n  void leakedPageScreenshot;" },
  { name: REQUIRED_MUTATION_NAMES[9], file: "scripts/debug-loop/scenarios/facebook-product-video-runtime.scenario.json", search: '  "maxRuntimeMs": 180000', replace: '  "clickSelector": "#composer",\n  "maxRuntimeMs": 180000' },
  { name: REQUIRED_MUTATION_NAMES[10], file: "scripts/debug-loop/scenarios/facebook-product-video-runtime.scenario.json", search: '  "maxRuntimeMs": 180000', replace: '  "pageEvaluate": "document.body.innerText",\n  "maxRuntimeMs": 180000' },
  { name: REQUIRED_MUTATION_NAMES[11], file: "scripts/debug-loop/scenarios/facebook-product-video-runtime.scenario.json", search: '  "maxRuntimeMs": 180000', replace: '  "abilityCall": "mouse-click.execute",\n  "maxRuntimeMs": 180000' },
  { name: REQUIRED_MUTATION_NAMES[12], file: "scripts/debug-loop/scenarios/facebook-product-video-runtime.scenario.json", search: '  "maxRuntimeMs": 180000', replace: '  "autoPostComment": true,\n  "maxRuntimeMs": 180000' },
  { name: REQUIRED_MUTATION_NAMES[13], file: TASK_PUBLISHER, search: "function buildMissionRuntimeSnippet(scenario) {", replace: "function buildMissionRuntimeSnippet(scenario) {\n  const leakedForensicsWriter = toImportHref(\"src/capabilities/forensics-persistence/runtime/forensics-writer.ts\");\n  void leakedForensicsWriter;" },
  { name: REQUIRED_MUTATION_NAMES[14], file: MAP_AUTHORING, search: "function buildArtifactPaths(artifactDir) {", replace: "function buildArtifactPaths(artifactDir) {\n  const activeRegistryWrite = \"active-map-registry.generated.json\";\n  void activeRegistryWrite;" },
  { name: REQUIRED_MUTATION_NAMES[15], file: MAP_AUTHORING, search: "function buildArtifactPaths(artifactDir) {", replace: "function buildArtifactPaths(artifactDir) {\n  const forgedActivationSnapshotRef = \"activationSnapshotRef\";\n  void forgedActivationSnapshotRef;" },
  { name: REQUIRED_MUTATION_NAMES[16], file: REPAIR_PACKET, search: "    rootCause: input.classification.rootCause,", replace: "    rootCause: input.classification.rootCause,\n    rawCookie: input.rawCookie," },
  { name: REQUIRED_MUTATION_NAMES[17], file: MAP_AUTHORING, search: "function buildArtifactPaths(artifactDir) {", replace: "function buildArtifactPaths(artifactDir) {\n  const directDraftActivation = \"mark draft map active\";\n  void directDraftActivation;" },
  { name: REQUIRED_MUTATION_NAMES[18], file: MAP_AUTHORING, search: "function buildArtifactPaths(artifactDir) {", replace: "function buildArtifactPaths(artifactDir) {\n  const skipValidation = \"skip validation\";\n  void skipValidation;" },
  { name: REQUIRED_MUTATION_NAMES[19], file: "scripts/audit/domains/debug-loop-boundary/run-inspector.ts", search: "if (!result.passed || hasBlockingFindings(result.findings)) {", replace: "if (!result.passed) {" },
  { name: REQUIRED_MUTATION_NAMES[20], file: NEGATIVE_PROOF, search: '  "remove negative proof invocation",\n', replace: "" },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);
  return { passed: result.passed, violationCount: result.violationCount };
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);
  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }
  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

async function main(): Promise<void> {
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error("Baseline debug-loop-boundary inspector must pass before negative proof.");
  }
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

void main();