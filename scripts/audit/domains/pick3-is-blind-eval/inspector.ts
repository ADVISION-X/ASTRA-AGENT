import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const domain = "pick3-is-blind-eval";
const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const selfPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";
const acceptancePath = "scripts/acceptance/pick3-is-blind-eval.acceptance.ts";
const packagePath = "package.json";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const aiExchangePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts";
const scoringPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts";
const failureReviewPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.ts";
const promptVersioningPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts";
const storageSchemaPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts";
const playbookSystemPath = "src/plugins/pick3-is-blind-eval/playbooks/system.md";
const playbookGrammarPath = "src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md";
const playbookHundredsPath = "src/plugins/pick3-is-blind-eval/playbooks/is_hundreds_l80_v1.md";
const playbookTensPath = "src/plugins/pick3-is-blind-eval/playbooks/is_tens_l80_v1.md";
const playbookOnesPath = "src/plugins/pick3-is-blind-eval/playbooks/is_ones_l80_v1.md";

const inspectedFiles = [
  lawPath,
  blueprintPath,
  manifestPath,
  selfPath,
  acceptancePath,
  packagePath,
  appShellLayoutPath,
  workbenchPick3SupportPath,
  playbookLoaderPath,
  aiExchangePath,
  scoringPath,
  failureReviewPath,
  promptVersioningPath,
  storageSchemaPath,
  playbookSystemPath,
  playbookGrammarPath,
  playbookHundredsPath,
  playbookTensPath,
  playbookOnesPath,
] as const;

const pluginRuntimePaths = [
  "src/plugins/pick3-is-blind-eval/index.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.official-api.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage-schema.ts",
] as const;

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");
const existsRepoPath = (repoPath: string): boolean => existsSync(resolveFromRepo(repoPath));

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireTokens = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  text: string,
  checkId: string,
  tokens: readonly string[],
): void => {
  for (const token of tokens) {
    if (!text.includes(token)) {
      addFinding(findings, lawId, filePath, checkId, `${filePath} must contain ${token}.`);
    }
  }
};

type LawRefs = {
  agentBrainLaw: string;
  blindBoundaryLaw: string;
  officialSourceLaw: string;
  primaryLaw: string;
  promptRepairLaw: string;
  promptExchangeLaw: string;
  statisticalHonestyLaw: string;
};

const buildLawRefs = (lawIds: readonly string[]): LawRefs => {
  const primaryLaw = lawIds[0] ?? "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1";
  return {
    primaryLaw,
    officialSourceLaw: lawIds.find((lawId) => lawId.endsWith("002-V1")) ?? primaryLaw,
    blindBoundaryLaw: lawIds.find((lawId) => lawId.endsWith("003-V1")) ?? primaryLaw,
    promptRepairLaw: lawIds.find((lawId) => lawId.endsWith("004-V1")) ?? primaryLaw,
    statisticalHonestyLaw: lawIds.find((lawId) => lawId.endsWith("005-V1")) ?? primaryLaw,
    agentBrainLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-IS-BRAIN-006-V1") ?? primaryLaw,
    promptExchangeLaw: lawIds.find((lawId) => lawId === "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1") ?? primaryLaw,
  };
};

const inspectFilesExist = (findings: InspectorFinding[], primaryLaw: string): void => {
  for (const repoPath of inspectedFiles) {
    if (!existsRepoPath(repoPath)) {
      addFinding(findings, primaryLaw, repoPath, "pick3-is-blind-eval/file-present", `${repoPath} must exist.`);
    }
  }
  if (existsRepoPath(misplacedLawPath)) {
    addFinding(
      findings,
      primaryLaw,
      misplacedLawPath,
      "pick3-is-blind-eval/misplaced-law-absent",
      "Pick3 active law must live under .github/instructions/agent-rules/modules, not docs/法案辅助文件.",
    );
  }
};

const inspectLawContract = (findings: InspectorFinding[], lawRefs: LawRefs, lawText: string): void => {
  requireTokens(findings, lawRefs.primaryLaw, lawPath, lawText, "pick3-is-blind-eval/law-contract", [
    "```apex-law",
    "\"capabilityDomain\": \"pick3-is-blind-eval\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1\"",
    "\"GRASSEYE-PICK3-IS-BRAIN-006-V1\"",
    "\"GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1\"",
    "full official coverage",
    "Success status with missing earliest history",
    "No betting",
    "No login",
    "No China lottery",
  ]);
};

const inspectBlueprintContract = (findings: InspectorFinding[], lawRefs: LawRefs, blueprintText: string): void => {
  requireTokens(findings, lawRefs.officialSourceLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/official-source", [
    "https://www.theuaelottery.ae/lottery/pick3",
    "https://www.theuaelottery.ae/lottery/pick3/results",
    "lotteryType=72",
    "command=660201",
    "command=660104",
    "command=660301",
    "260616",
    "4 2 7",
    "nums[0]",
    "officialStartTime",
    "officialEndTime",
    "verifyPick3FullHistoryCoverage",
    "pick3_full_history_missing_earliest",
    "pick3_full_history_missing_latest",
    "pick3_full_history_date_gap",
    "hundreds",
    "tens",
    "ones",
  ]);
  requireTokens(findings, lawRefs.blindBoundaryLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/blind-boundary", [
    "L=80",
    "one-image",
    "no text",
    "no Chart #",
    "no point-count text",
    "PredictionSeal",
    "prediction_hash",
    "Reveal And Scoring",
    "answer_digit",
  ]);
  requireTokens(findings, lawRefs.promptRepairLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/prompt-repair", [
    "Failure Review Flow",
    "Prompt Rewrite Flow",
    "Failure Replay Flow",
    "failure_replay",
    "not_valid_for_accuracy",
    "prompt_version",
  ]);
  requireTokens(findings, lawRefs.statisticalHonestyLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/statistical-honesty", [
    "model_id",
    "temperature",
    "image_detail",
    "system_prompt_version_id",
    "business_prompt_version_id",
    "confidence_is_probability",
    "subjective_model_strength_not_probability",
    "abstain",
    "coverageRate",
    "one-position baseline = 50%",
    "three-position combination baseline = 12.5%",
    "three-position hit rate > 25%",
    "approximate stable per-position hit rate > 63%",
    "confidence is not probability",
    "confidenceIsProbability: false",
  ]);
  requireTokens(findings, lawRefs.promptExchangeLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/prompt-exchange", [
    "Pick3 Prompt Exchange",
    "pick3_ai_interactions",
    "prompt_package_id",
    "prompt_contract_id",
    "raw_response_text",
    "raw_response_hash",
    "raw_output_ref",
    "provider_proof_json",
    "parse_status",
    "parse_failed_raw_available",
    "Pick3GatewaySender",
    "Manual GPT chat is allowed only as the capture surface",
    "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts",
    "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.ts",
  ]);
};

const inspectAgentBrainContract = (findings: InspectorFinding[], lawRefs: LawRefs, lawText: string, blueprintText: string): void => {
  requireTokens(findings, lawRefs.agentBrainLaw, lawPath, lawText, "pick3-is-blind-eval/agent-brain-law", [
    "The AGENT-owned Pick3 Playbook is the only IS brain source",
    "src/plugins/pick3-is-blind-eval/playbooks/",
    "No runtime dependency on `/Users/nexgen/Documents/trend-intuition-brain`",
    "No external Playbook fallback",
    "Playbook versions must be hash-addressed and persisted before prediction use",
  ]);
  requireTokens(findings, lawRefs.agentBrainLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/agent-brain-blueprint", [
    "## AGENT-Owned IS Brain",
    "src/plugins/pick3-is-blind-eval/playbooks/",
    "No /Users/nexgen/Documents/trend-intuition-brain runtime read.",
    "pick3_playbooks",
    "Pick3PlaybookPromptPackage",
    "confidenceIsProbability: false",
  ]);
};

const inspectPlaybookFiles = (findings: InspectorFinding[], agentBrainLaw: string): void => {
  for (const playbookPath of [playbookSystemPath, playbookGrammarPath, playbookHundredsPath, playbookTensPath, playbookOnesPath]) {
    const playbookText = existsRepoPath(playbookPath) ? readRepoText(playbookPath) : "";
    requireTokens(findings, agentBrainLaw, playbookPath, playbookText, "pick3-is-blind-eval/playbook-content", [
      "L80",
    ]);
    for (const forbidden of ["targetPhase", "answerDigit", "answerLabel", "expectedPrizeTime", "0-4", "5-9", "0-2", "7-9"]) {
      if (playbookText.includes(forbidden)) {
        addFinding(findings, agentBrainLaw, playbookPath, "pick3-is-blind-eval/playbook-no-answer-leak", `${playbookPath} must not contain ${forbidden}.`);
      }
    }
  }
};

const inspectRuntimeExternalBrain = (findings: InspectorFinding[], agentBrainLaw: string): void => {
  for (const runtimePath of pluginRuntimePaths) {
    const runtimeText = existsRepoPath(runtimePath) ? readRepoText(runtimePath) : "";
    if (runtimeText.includes("trend-intuition-brain")) {
      addFinding(
        findings,
        agentBrainLaw,
        runtimePath,
        "pick3-is-blind-eval/no-external-brain-runtime",
        "Pick3 runtime files must not depend on trend-intuition-brain.",
      );
    }
  }
};

const inspectPromptExchangeRuntime = (findings: InspectorFinding[], promptExchangeLaw: string): void => {
  const aiText = existsRepoPath(aiExchangePath) ? readRepoText(aiExchangePath) : "";
  const appShellLayoutText = existsRepoPath(appShellLayoutPath) ? readRepoText(appShellLayoutPath) : "";
  const workbenchPick3SupportText = existsRepoPath(workbenchPick3SupportPath) ? readRepoText(workbenchPick3SupportPath) : "";
  const storageSchemaText = existsRepoPath(storageSchemaPath) ? readRepoText(storageSchemaPath) : "";
  const storageText = existsRepoPath("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts")
    ? readRepoText("src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts")
    : "";
  requireTokens(findings, promptExchangeLaw, aiExchangePath, aiText, "pick3-is-blind-eval/prompt-exchange-runtime", [
    "Pick3GatewaySender",
    "buildPick3AiGatewayInput",
    "runPick3PromptExchange",
    "parse_failed_raw_available",
    "providerProofJson",
  ]);
  requireTokens(findings, promptExchangeLaw, storageSchemaPath, storageSchemaText, "pick3-is-blind-eval/interaction-storage-schema", [
    "CREATE TABLE IF NOT EXISTS pick3_ai_interactions",
  ]);
  requireTokens(findings, promptExchangeLaw, "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts", storageText, "pick3-is-blind-eval/interaction-storage", [
    "insertAiInteractions",
    "listAiInteractions",
  ]);
  requireTokens(findings, promptExchangeLaw, workbenchPick3SupportPath, workbenchPick3SupportText, "pick3-is-blind-eval/workbench-gateway-sender", [
    "assembly.aiInputGateway.execute",
    "pick3GatewaySender",
    "assembly.browserController",
  ]);
  requireTokens(findings, promptExchangeLaw, appShellLayoutPath, appShellLayoutText, "pick3-is-blind-eval/full-pipeline-ui", [
    "full_pipeline",
    "Full pipeline via GPT web chat",
  ]);
  if (aiText.includes("Pick3ManualAiResponse")) {
    addFinding(findings, promptExchangeLaw, aiExchangePath, "pick3-is-blind-eval/no-direct-manual-ingestion", "Pick3 AI exchange must not use direct manual response ingestion.");
  }
};

const inspectPackageScripts = (findings: InspectorFinding[], primaryLaw: string, packageText: string): void => {
  requireTokens(findings, primaryLaw, packagePath, packageText, "pick3-is-blind-eval/package-scripts", [
    "\"audit:pick3-is-blind-eval\"",
    "\"acceptance:pick3-is-blind-eval\"",
  ]);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = context.planEntry.lawIds;
  const lawRefs = buildLawRefs(lawIds);
  const findings: InspectorFinding[] = [];
  const selfSourceFile = context.project.getSourceFile(selfPath);
  if (!selfSourceFile) {
    addFinding(findings, lawRefs.primaryLaw, selfPath, "pick3-is-blind-eval/inspector-project-loaded", `${selfPath} must be loaded in the audit ts-morph project.`);
  }
  const lawText = existsRepoPath(lawPath) ? readRepoText(lawPath) : "";
  const blueprintText = existsRepoPath(blueprintPath) ? readRepoText(blueprintPath) : "";
  const packageText = existsRepoPath(packagePath) ? readRepoText(packagePath) : "";

  inspectFilesExist(findings, lawRefs.primaryLaw);
  inspectLawContract(findings, lawRefs, lawText);
  inspectBlueprintContract(findings, lawRefs, blueprintText);
  inspectAgentBrainContract(findings, lawRefs, lawText, blueprintText);
  inspectPlaybookFiles(findings, lawRefs.agentBrainLaw);
  inspectRuntimeExternalBrain(findings, lawRefs.agentBrainLaw);
  inspectPromptExchangeRuntime(findings, lawRefs.promptExchangeLaw);
  inspectPackageScripts(findings, lawRefs.primaryLaw, packageText);

  return {
    capabilityDomain: domain,
    reportedLawIds: lawIds,
    findings,
    inspectedFiles: inspectedFiles.filter(existsRepoPath),
  };
};
