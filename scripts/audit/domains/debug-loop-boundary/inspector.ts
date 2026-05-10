import type { Finding, InspectorContext } from "../../core/schema.js";
import { listFilesRecursive, readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { collectIdentityFindings } from "./identity-findings.js";
import { collectDebugLoopImportGraphFindings } from "./import-graph-check.js";
import { buildFinding, collectRuleFindings, createCheckPhase, extractArrayBlock, extractBlock, requirePattern, type TextRule } from "./inspection-utils.js";

const DOMAIN = "debug-loop-boundary";
const INSPECTOR_ENTRY = "scripts/audit/domains/debug-loop-boundary/inspector.ts";
const DEBUG_LOOP_ROOT = "scripts/debug-loop";
const KERNEL_FILE = ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md";
const BASELINE_FILE = "docs/法案辅助文件/GrassEye 法案冻结基线.md";
const TASK_PUBLISHER = "scripts/debug-loop/task-publisher.mjs";
const REPAIR_PACKET = "scripts/debug-loop/repair-packet-writer.mjs";
const MAP_AUTHORING = "scripts/debug-loop/map-authoring-public-contract.mjs";
const RUN_INSPECTOR = "scripts/audit/domains/debug-loop-boundary/run-inspector.ts";
const PACKAGE_JSON = "package.json";
const RETIRED_ACTIVATION_REF_FIELD = ["activation", "Snapshot", "Ref"].join("");
const FORBIDDEN_SCENARIO_FIELDS = new Set([
  "openApp",
  "shellCommand",
  "osascript",
  "clickSelector",
  "typeText",
  "scrollScript",
  "screenshotSelector",
  "pageEvaluate",
  "domQuery",
  "browserAction",
  "abilityCall",
  "capabilityExecutor",
  "nerveBusDispatch",
  "orchestrationStep",
  "forensicsWrite",
  "activationWrite",
  "rawCookie",
  "apiKey",
  "rawSecret",
  "autoPostComment",
  "autoLike",
  "autoMessage",
  "autoPurchase",
]);
const REQUIRED_ATTACK_NAMES = [
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
  "scenario contains openApp",
  "scenario contains shellCommand",
  "scenario contains osascript",
  "scenario contains autoPostComment=true",
  "debug-loop imports Forensics writer",
  "debug-loop writes active registry",
  "debug-loop writes legacy activation truth",
  "debug-loop writes raw cookie to repair packet",
  "fake authoring marks draft map active",
  "fake authoring skips validation",
  "turn P0 into warning-only",
];
const IMPORT_RULES: TextRule[] = [
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import mouse-click executors.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/mouse-click\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import text-input executors.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/text-input\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import screenshot executors.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/screenshot\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import visual-target internals.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/visual-target\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import geometry-guard internals.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/geometry-guard\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import mouse-scroll internals.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/mouse-scroll\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import post-action-verification internals.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/post-action-verification\// },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import orchestration dispatch/runtime internals.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/orchestration\/.*(?:dispatcher|runtime)/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "debug-loop must not import nerve-bus dispatch internals.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/nerve-bus\/.*dispatch/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-004-V1", message: "debug-loop must not import forensics production writers.", pattern: /(?:toImportHref|await import)\([^\n]*src\/capabilities\/forensics-persistence\/.*writer/i },
];
const MISSION_RULES: TextRule[] = [
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not use direct browser controller state.", pattern: /\bbrowserController\b/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not import CurrentChromeBrowserController.", pattern: /CurrentChromeBrowserController/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not reference browser controller import paths.", pattern: /current-chrome-browser-controller/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", message: "mission-runtime must not read orchestration internals directly.", pattern: /\.orchestrationAbilityGroup\b/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-004-V1", message: "mission-runtime must not read evidence store internals directly.", pattern: /\.evidenceStore\b/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not call page.click directly.", pattern: /page\.click/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not call page.fill directly.", pattern: /page\.fill/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not call page.type directly.", pattern: /page\.type/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not call page.screenshot directly.", pattern: /page\.screenshot/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "mission-runtime must not call page.evaluate directly.", pattern: /page\.evaluate/ },
];
const PREFLIGHT_RULES: TextRule[] = [
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "preflight must not contain mission actions such as comment/like/message/purchase/submit.", pattern: /\b(comment|like|message|purchase|submit)\b/i },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1", message: "preflight must not call direct page actions.", pattern: /page\.(?:click|fill|type|screenshot|evaluate)/ },
];
const AUTHORING_RULES: TextRule[] = [
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-005-V1", message: "fake authoring must not write active registry directly.", pattern: /active-map-registry|mark draft map active/i },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-005-V1", message: "fake authoring must not forge legacy activation truth.", pattern: new RegExp(RETIRED_ACTIVATION_REF_FIELD) },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-005-V1", message: "fake authoring must not skip validation.", pattern: /skip validation/i },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-005-V1", message: "fake authoring must not execute operational maps directly.", pattern: /operationalMap\.steps|interpret map branch/i },
];
const REPAIR_RULES: TextRule[] = [
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not store rawCookie.", pattern: /rawCookie/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not store apiKey.", pattern: /apiKey/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not store rawSecret.", pattern: /rawSecret/ },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not store raw prompt bodies.", pattern: /rawPromptBody|raw prompt body/i },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not store raw sensitive text.", pattern: /rawSensitiveText|raw sensitive text/i },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not include executable patch scripts.", pattern: /executablePatchScript|autoApplyPatch|auto apply patch/i },
  { lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1", message: "repair packets must not target production source or generated artifacts.", pattern: /(?:src\/|scripts\/audit\/generated\/)/ },
];

const collectRuntimeFindings = async (taskPublisherContent: string, debugLoopFiles: string[]): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const missionBlock = extractBlock(taskPublisherContent, "function buildMissionRuntimeSnippet");
  const preflightBlock = extractBlock(taskPublisherContent, "function buildPlatformAuthSnippet");
  for (const absoluteFile of debugLoopFiles) {
    findings.push(...collectRuleFindings({ file: toRepoRelativePath(absoluteFile), content: await readTextFile(absoluteFile), rules: IMPORT_RULES }));
  }
  findings.push(...collectDebugLoopImportGraphFindings(debugLoopFiles));
  findings.push(...collectRuleFindings({ file: TASK_PUBLISHER, content: missionBlock, rules: MISSION_RULES }));
  findings.push(...collectRuleFindings({ file: TASK_PUBLISHER, content: preflightBlock, rules: PREFLIGHT_RULES }));
  findings.push(...requirePattern({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", file: TASK_PUBLISHER, content: missionBlock, pattern: /childCapabilityId:\s*'issue-human-command'/, message: "mission-runtime must start missions through Commander issue-human-command." }));
  findings.push(...requirePattern({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", file: TASK_PUBLISHER, content: missionBlock, pattern: /commandType:\s*'start-mission'/, message: "mission-runtime must publish a human-like start-mission command." }));
  findings.push(...requirePattern({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", file: TASK_PUBLISHER, content: missionBlock, pattern: /childCapabilityId:\s*'show-mission-dashboard'/, message: "mission-runtime must observe mission state only through Commander mission dashboard read model." }));
  findings.push(...requirePattern({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", file: TASK_PUBLISHER, content: missionBlock, pattern: /deriveMissionFromRuntimeEvents/, message: "mission-runtime must keep observing governed runtime terminal events when dashboard observer reads are transiently unavailable." }));
  findings.push(...requirePattern({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", file: TASK_PUBLISHER, content: missionBlock, pattern: /dashboardReadFailureReason/, message: "mission-runtime must treat dashboard observer timeout as observer evidence only, not as accepted mission failure." }));
  return findings;
};

const collectScenarioFindings = async (scenarioFiles: string[]): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const visit = (file: string, value: unknown, trail: string[]): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(file, entry, [...trail, String(index)]));
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      const nextTrail = [...trail, key];
      if (FORBIDDEN_SCENARIO_FIELDS.has(key)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-006-V1", file, line: 1, message: `Scenario must not contain forbidden field ${key}.`, detail: nextTrail.join(".") }));
      visit(file, nested, nextTrail);
    }
  };
  for (const absoluteFile of scenarioFiles) {
    const repoFile = toRepoRelativePath(absoluteFile);
    const scenario = await readJsonFile<Record<string, unknown>>(absoluteFile);
    visit(repoFile, scenario, []);
    if (scenario.scenarioKind === "mission-runtime" && scenario.entryMode !== "commander-public-contract") findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1", file: repoFile, line: 1, message: "mission-runtime scenarios must declare commander-public-contract entryMode." }));
  }
  return findings;
};

const collectArtifactBoundaryFindings = async (input: {
  mapAuthoringContent: string;
  repairContent: string;
  packageJson: { scripts?: Record<string, string> };
  runInspectorContent: string;
}): Promise<Finding[]> => {
  const findings = [
    ...collectRuleFindings({ file: MAP_AUTHORING, content: input.mapAuthoringContent, rules: AUTHORING_RULES }),
    ...collectRuleFindings({ file: REPAIR_PACKET, content: input.repairContent, rules: REPAIR_RULES }),
  ];
  const legacyScriptName = ["audit", "debug-loop-boundary"].join(":");
  if (legacyScriptName in (input.packageJson.scripts ?? {})) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-008-V1", file: PACKAGE_JSON, line: 1, message: "package.json must not expose debug-loop-boundary owner scripts; CI-FULL is the only complete quality entrypoint." }));
  if (!/hasBlockingFindings\(result\.findings\)/.test(input.runInspectorContent)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-008-V1", file: RUN_INSPECTOR, line: 1, message: "run-inspector must keep blocking findings fail-fast logic and must not downgrade P0 enforcement." }));
  return findings;
};

const runDebugLoopBoundaryChecks = async (context: InspectorContext) => {
  const [kernelContent, baselineContent, taskPublisherContent, mapAuthoringContent, repairContent, packageJson, runInspectorContent, debugLoopFiles, scenarioFiles] = await Promise.all([
    readTextFile(pathFromRepoRoot(KERNEL_FILE)),
    readTextFile(pathFromRepoRoot(BASELINE_FILE)),
    readTextFile(pathFromRepoRoot(TASK_PUBLISHER)),
    readTextFile(pathFromRepoRoot(MAP_AUTHORING)),
    readTextFile(pathFromRepoRoot(REPAIR_PACKET)),
    readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot(PACKAGE_JSON)),
    readTextFile(pathFromRepoRoot(RUN_INSPECTOR)),
    listFilesRecursive(pathFromRepoRoot(DEBUG_LOOP_ROOT), { extensions: [".mjs"] }),
    listFilesRecursive(pathFromRepoRoot("scripts/debug-loop/scenarios"), { extensions: [".json"] }),
  ]);
  const identityFindings = await collectIdentityFindings(context, kernelContent, baselineContent);
  const runtimeFindings = await collectRuntimeFindings(taskPublisherContent, debugLoopFiles);
  const scenarioFindings = await collectScenarioFindings(scenarioFiles);
  const artifactFindings = await collectArtifactBoundaryFindings({ mapAuthoringContent, repairContent, packageJson, runInspectorContent });
  return {
    findings: [...identityFindings, ...runtimeFindings, ...scenarioFindings, ...artifactFindings],
    phases: [
      createCheckPhase({ name: "debug-loop-identity", findings: identityFindings, pass: "debug-loop stays local tooling and never becomes an active owner.", fail: "debug-loop identity drifted into an active owner or runtime role." }),
      createCheckPhase({ name: "debug-loop-runtime-boundary", findings: runtimeFindings, pass: "mission-runtime starts via Commander and observes through governed read models only.", fail: "mission-runtime still reaches across the Commander boundary or direct browser/runtime internals." }),
      createCheckPhase({ name: "debug-loop-scenario-boundary", findings: scenarioFindings, pass: "scenario JSON stays declarative and non-executable.", fail: "scenario JSON still contains executable action fields or a non-Commander mission entry." }),
      createCheckPhase({ name: "debug-loop-artifact-boundary", findings: artifactFindings, pass: "repair packets, fake authoring, and package wiring remain governed.", fail: "artifact boundaries or enforcement wiring drifted into fake enforcement.", classification: "FAKE ENFORCEMENT" }),
    ],
  };
};

export const debugLoopBoundaryInspector = createPendingDomainInspector({
  inspector: "GrassEye Debug Loop Boundary Owner Inspector",
  inspectorId: "debug-loop-boundary-owner",
  capabilityDomain: DOMAIN,
  inspectorEntry: INSPECTOR_ENTRY,
  ownedPaths: [DEBUG_LOOP_ROOT],
  pendingSummary: "debug-loop-boundary must close through an owner-local inspector and package audit script.",
  implementedSummary: "debug-loop remains an operator harness and is blocked from becoming a second Agent runtime.",
  extraChecks: runDebugLoopBoundaryChecks,
});
