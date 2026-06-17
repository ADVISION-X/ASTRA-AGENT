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

const inspectedFiles = [
  lawPath,
  blueprintPath,
  manifestPath,
  selfPath,
  acceptancePath,
  packagePath,
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

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = context.planEntry.lawIds;
  const primaryLaw = lawIds[0] ?? "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1";
  const officialSourceLaw = lawIds.find((lawId) => lawId.endsWith("002-V1")) ?? primaryLaw;
  const blindBoundaryLaw = lawIds.find((lawId) => lawId.endsWith("003-V1")) ?? primaryLaw;
  const promptRepairLaw = lawIds.find((lawId) => lawId.endsWith("004-V1")) ?? primaryLaw;
  const statisticalHonestyLaw = lawIds.find((lawId) => lawId.endsWith("005-V1")) ?? primaryLaw;
  const findings: InspectorFinding[] = [];

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

  const lawText = existsRepoPath(lawPath) ? readRepoText(lawPath) : "";
  const blueprintText = existsRepoPath(blueprintPath) ? readRepoText(blueprintPath) : "";
  const packageText = existsRepoPath(packagePath) ? readRepoText(packagePath) : "";

  requireTokens(findings, primaryLaw, lawPath, lawText, "pick3-is-blind-eval/law-contract", [
    "```apex-law",
    "\"capabilityDomain\": \"pick3-is-blind-eval\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1\"",
    "\"GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1\"",
    "No betting",
    "No login",
    "No China lottery",
  ]);

  requireTokens(findings, officialSourceLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/official-source", [
    "https://www.theuaelottery.ae/lottery/pick3",
    "https://www.theuaelottery.ae/lottery/pick3/results",
    "lotteryType=72",
    "command=660201",
    "command=660104",
    "command=660301",
    "260616",
    "4 2 7",
    "nums[0]",
    "hundreds",
    "tens",
    "ones",
  ]);

  requireTokens(findings, blindBoundaryLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/blind-boundary", [
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

  requireTokens(findings, promptRepairLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/prompt-repair", [
    "Failure Review Flow",
    "Prompt Rewrite Flow",
    "Failure Replay Flow",
    "failure_replay",
    "not_valid_for_accuracy",
    "prompt_version",
  ]);

  requireTokens(findings, statisticalHonestyLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/statistical-honesty", [
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

  requireTokens(findings, primaryLaw, packagePath, packageText, "pick3-is-blind-eval/package-scripts", [
    "\"audit:pick3-is-blind-eval\"",
    "\"acceptance:pick3-is-blind-eval\"",
  ]);

  return {
    capabilityDomain: domain,
    reportedLawIds: lawIds,
    findings,
    inspectedFiles: inspectedFiles.filter(existsRepoPath),
  };
};
