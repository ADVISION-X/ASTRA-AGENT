import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CommandStatus = {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number | null;
  evidencePath: string;
};

type CoverageLaw = {
  lawId: string;
  capabilityDomain: string;
  ownerAuditScript: string | null;
  ownerAuditScriptDeclared: boolean;
  coverageStatus: string;
  ownerAuditPassed: boolean;
  globalChainPassed: boolean;
  blockers: string[];
  sourceEvidence: Array<{ checkPhase: string; checkFunction: string; sourceFile: string; checkKind: string }>;
};

type StaticClauseCoverageArtifact = {
  generatedAt: string;
  abilityGroupCount: number;
  abilityGroupDomains: string[];
  totalActiveLaws: number;
  globalChain: {
    observed: boolean;
    passed: boolean;
    commands: CommandStatus[];
    blockers: string[];
  };
  laws: CoverageLaw[];
};

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp/audit/ability-law-census/static-clause-coverage-gate");
const ARTIFACT_PATH = path.join(ROOT, "scripts/audit/generated/static-clause-coverage.generated.json");
const PROOF_SUMMARY_PATH = path.join(ROOT, "tmp/audit/ability-law-census/regression-proofs/audit-system-static-clause-coverage/proof-summary.md");
const NON_AI_BLOCKERS_PATH = path.join(ROOT, "tmp/audit/ability-law-census/loops/01-ai-proof-closure/non-ai-ci-blockers.md");
const LOOP_REPORT_PATH = path.join(ROOT, "tmp/audit/ability-law-census/loops/01-ai-proof-closure/loop-report.md");
const ONE_WAY_VALVE_PATH = path.join(ROOT, "tmp/audit/ability-law-census/loops/01-ai-proof-closure/one-way-valve-check.md");
const TOP_LEVEL_VALVE_STATE = path.join(ROOT, "tmp/audit/ability-law-census/one-way-valve-state.json");

const readText = async (filePath: string): Promise<string> => {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
};

const writeText = async (fileName: string, content: string): Promise<void> => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, fileName), content, "utf8");
};

const mdTable = (headers: string[], rows: string[][]): string => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map((cell) => cell.replaceAll("\n", "<br>").replaceAll("|", "\\|")).join(" | ")} |`),
].join("\n");

const countByStatus = (artifact: StaticClauseCoverageArtifact): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const law of artifact.laws) {
    counts.set(law.coverageStatus, (counts.get(law.coverageStatus) ?? 0) + 1);
  }
  return counts;
};

const buildStaticCoverageMarkdown = (artifact: StaticClauseCoverageArtifact): string => {
  return [
    "# Static Clause Coverage",
    "",
    `generatedAt: ${artifact.generatedAt}`,
    `abilityGroupCount: ${artifact.abilityGroupCount}`,
    `totalActiveLaws: ${artifact.totalActiveLaws}`,
    "",
    mdTable(
      ["lawId", "capabilityDomain", "coverageStatus", "ownerAuditScript", "ownerAuditPassed", "globalChainPassed"],
      artifact.laws.map((law) => [
        law.lawId,
        law.capabilityDomain,
        law.coverageStatus,
        law.ownerAuditScript ?? "NONE",
        String(law.ownerAuditPassed),
        String(law.globalChainPassed),
      ]),
    ),
    "",
  ].join("\n");
};

const buildStatusModel = (): string => [
  "# Status Model",
  "",
  "- NOT_COVERED: 没有 owner inspector source evidence。",
  "- INSPECTOR_MAPPED: 有 owner source evidence，但 negative proof 还没接上。",
  "- NEGATIVE_PROOF_MAPPED: negative proof 已接上，但还没有 production mutation proof。",
  "- MUTATION_PROOF_CAPTURED: mutation proof 已有，但 owner-binding proof 还缺。",
  "- OWNER_BINDING_PROOF_CAPTURED: owner-binding proof 已有，但 owner audit 还没通过或脚本缺失。",
  "- OWNER_AUDIT_PASS: owner audit 已通过，但全局链路结果还未完整观测。",
  "- OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED: owner proof 完整，但 typecheck/lint/audit/ci/capability-group-governance 中仍有阻塞。",
  "- ENFORCED: 只有 owner proof 完整且全局链路全部通过时才允许。",
  "",
].join("\n");

const buildCorrectedAiStatus = (artifact: StaticClauseCoverageArtifact): string => {
  const aiLaws = artifact.laws.filter((law) => law.capabilityDomain === "ai-capability");
  return [
    "# Corrected AI Status",
    "",
    artifact.globalChain.passed
      ? "AI laws may enter ENFORCED only because the global chain is currently passing."
      : "AI laws must not be marked ENFORCED because the global chain is still blocked.",
    "",
    mdTable(
      ["lawId", "coverageStatus", "ownerAuditPassed", "globalChainPassed", "why"],
      aiLaws.map((law) => [
        law.lawId,
        law.coverageStatus,
        String(law.ownerAuditPassed),
        String(law.globalChainPassed),
        law.blockers[0] ?? "none",
      ]),
    ),
    "",
  ].join("\n");
};

const buildGlobalChainBlockers = async (artifact: StaticClauseCoverageArtifact): Promise<string> => {
  const nonAiBlockers = await readText(NON_AI_BLOCKERS_PATH);
  return [
    "# Global Chain Blockers",
    "",
    mdTable(
      ["command", "passed", "exitCode", "evidencePath"],
      artifact.globalChain.commands.map((command) => [
        command.name,
        String(command.passed),
        String(command.exitCode),
        command.evidencePath,
      ]),
    ),
    "",
    "## Legacy Non-AI Blockers",
    "",
    nonAiBlockers || "NONE",
    "",
  ].join("\n");
};

const buildOneWayValveCorrection = async (artifact: StaticClauseCoverageArtifact): Promise<string> => {
  const priorValve = await readText(ONE_WAY_VALVE_PATH);
  const enforcedWhileBlocked = artifact.laws.filter((law) => law.coverageStatus === "ENFORCED" && !artifact.globalChain.passed);
  const valvePassed = artifact.globalChain.passed && enforcedWhileBlocked.length === 0 && artifact.abilityGroupCount === 14;
  const state = {
    generatedAt: artifact.generatedAt,
    totalActiveLaws: artifact.totalActiveLaws,
    enforcedCount: artifact.laws.filter((law) => law.coverageStatus === "ENFORCED").length,
    ownerProofCompleteButGlobalChainBlocked: artifact.laws.filter((law) => law.coverageStatus === "OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED").length,
    globalChainPassed: artifact.globalChain.passed,
    regressionDetected: !valvePassed,
    fakePassDetected: enforcedWhileBlocked.length > 0,
  };

  await writeFile(TOP_LEVEL_VALVE_STATE, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return [
    "# One Way Valve Correction",
    "",
    valvePassed ? "ONE_WAY_VALVE_PASS" : "ONE_WAY_VALVE_FAIL",
    "",
    "## Why",
    "",
    ...artifact.globalChain.blockers.map((blocker) => `- ${blocker}`),
    ...(enforcedWhileBlocked.length === 0 ? [] : ["- At least one law is marked ENFORCED while the global chain is still failing."]),
    "",
    "## Historical Evidence",
    "",
    priorValve || "NONE",
    "",
  ].join("\n");
};

const buildAntiEscapeProof = async (): Promise<string> => {
  const proofSummary = await readText(PROOF_SUMMARY_PATH);
  return [
    "# Anti Escape Proof",
    "",
    proofSummary || "Missing audit-system static-clause-coverage proof summary.",
    "",
  ].join("\n");
};

const buildMutationProofSummary = async (): Promise<string> => {
  const proofSummary = await readText(PROOF_SUMMARY_PATH);
  return [
    "# Mutation Proof Summary",
    "",
    proofSummary || "Missing mutation proof summary.",
    "",
  ].join("\n");
};

const buildGapAnalysis = async (artifact: StaticClauseCoverageArtifact): Promise<string> => {
  const loopReport = await readText(LOOP_REPORT_PATH);
  return [
    "# APEX Style Gap Analysis",
    "",
    "## 1. APEX-style 链路",
    "",
    "APEX-style 的关键不是出一份 coverage 报告，而是让 static-clause-coverage 进入 audit-system 的 machine-blocking phase，并绑定 generated registry、enforcement matrix、audit plan、owner manifest、owner inspector source、negative proof、mutation proof、owner-binding proof 以及全局链路结果。",
    "",
    "## 2. GrassEye 之前缺什么",
    "",
    "之前 tmp ability-law-census 直接从 proof 文件和 inspector 存在性推导 ENFORCED，audit-system 自身并没有 clause 级 gate，也没有把全局 typecheck/lint/audit/ci 失败纳入 ENFORCED 硬门槛。",
    "",
    "## 3. 为什么 AI 15 条 law 之前不能算 ENFORCED",
    "",
    artifact.globalChain.passed
      ? "当前全局链路已通过，因此 AI law 可以依据当前 artifact 进入最终 ENFORCED 判定。"
      : "当前全局链路未通过，因此 AI law 最多只能停留在 OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED 或更早状态。",
    "",
    "## 4. 哪些检查已上升到 audit-system meta inspector",
    "",
    "- static-clause-coverage artifact 是否存在且未手改。",
    "- 14 ability groups active law 是否全部进入 generated ledger。",
    "- 每条 law 是否有 owner inspector source evidence。",
    "- mutation proof / owner-binding proof / owner audit script 是否齐全。",
    "- 全局链路失败时是否仍有人为标 ENFORCED。",
    "",
    "## 5. tmp 报告的地位",
    "",
    "tmp 报告现在只作为 evidence 输出；真正的判定来源是 audit-system phase 和 static-clause-coverage.generated.json。",
    "",
    "## Historical Loop Evidence",
    "",
    loopReport || "NONE",
    "",
  ].join("\n");
};

const buildFinalReport = async (artifact: StaticClauseCoverageArtifact): Promise<string> => {
  const counts = countByStatus(artifact);
  return [
    "# Final Report",
    "",
    artifact.globalChain.passed ? "STATIC_CLAUSE_COVERAGE_GATE_READY" : "STATIC_CLAUSE_COVERAGE_GATE_NOT_READY",
    "",
    "## 1. 为什么旧提示词没有实现全面执法",
    "",
    "旧链路把 tmp/audit/ability-law-census 当成了状态判定者，导致 proof bundle 存在即可推高到 ENFORCED，而 audit-system 并没有 clause 级 fail-closed gate。",
    "",
    "## 2. APEX-style 执法链如何落到 GrassEye",
    "",
    "现在 static-clause-coverage 作为 audit-system phase 执行，artifact 由审计生成链写出，audit-system 自己验证 artifact、writer wiring、source evidence、proof bundle 和全局链路。",
    "",
    "## 3. 新增 gate",
    "",
    "- generated artifact: scripts/audit/generated/static-clause-coverage.generated.json",
    "- audit-system phase: static-clause-coverage",
    "- anti-escape proof: audit-system static-clause-coverage negative-proof bundle",
    "",
    "## 4. static-clause-coverage 如何校验",
    "",
    "它逐条读取 14 个能力组 active laws，验证 matrix/plan/manifest/source evidence/proof bundle/global chain，并阻止全局链路失败时的 ENFORCED 假绿。",
    "",
    "## 5. 当前 AI 状态",
    "",
    `AI law counts by status: ${Array.from(counts.entries()).map(([status, value]) => `${status}=${value}`).join(", ")}`,
    "",
    "## 6. one-way valve 修正",
    "",
    artifact.globalChain.passed
      ? "one-way valve 现在允许 PASS，因为全局链路已通过且没有 ENFORCED 假绿。"
      : "one-way valve 现在必须 FAIL，因为全局链路仍阻塞。",
    "",
    "## 7. 当前全局阻塞",
    "",
    ...artifact.globalChain.blockers.map((blocker) => `- ${blocker}`),
    "",
    "## 8. 下一轮最小修复顺序",
    "",
    "1. 修全局 typecheck/lint/audit/ci blocker。",
    "2. 让当前 owner audit 状态全部刷新到真实 PASS/FAIL 结果。",
    "3. 继续补齐缺失 source evidence 或 proof bundle 的 ability owner。",
    "4. 全局链路通过后，再允许 law 进入 ENFORCED。",
    "",
  ].join("\n");
};

async function main(): Promise<void> {
  const artifact = JSON.parse(await readText(ARTIFACT_PATH)) as StaticClauseCoverageArtifact;
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeText("static-clause-coverage.generated.json", `${JSON.stringify(artifact, null, 2)}\n`);
  await writeText("static-clause-coverage.generated.md", buildStaticCoverageMarkdown(artifact));
  await writeText("status-model.md", buildStatusModel());
  await writeText("corrected-ai-status.md", buildCorrectedAiStatus(artifact));
  await writeText("global-chain-blockers.md", await buildGlobalChainBlockers(artifact));
  await writeText("one-way-valve-correction.md", await buildOneWayValveCorrection(artifact));
  await writeText("anti-escape-proof.md", await buildAntiEscapeProof());
  await writeText("mutation-proof-summary.md", await buildMutationProofSummary());
  await writeText("apex-style-gap-analysis.md", await buildGapAnalysis(artifact));
  await writeText("final-report.md", await buildFinalReport(artifact));
  process.stdout.write(`[STATIC-CLAUSE-COVERAGE-GATE] wrote reports to ${OUTPUT_DIR}\n`);
}

void main();