import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { LOCAL_AI_RUNTIME_AUDIT_CONFIG as CONFIG } from "./config.js";

const buildFinding = (lawId: string, file: string, message: string, hint: string): Finding =>
  createFinding({ lawId: lawId, file, line: 1, severity: "error", message, hint });

const buildPhase = (name: string, findings: Finding[], passSummary: string, failSummary: string): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary);
};

const runLocalAiRuntimeChecks = async (_context: InspectorContext) => {
  const allFindings: Finding[] = [];
  const phases: InspectorPhase[] = [];

  const localAiRoot = pathFromRepoRoot(CONFIG.sourceRoot);

  // Q1: src/lib/local-ai 文件数是否 ≤ 9？
  const q1Files = await listFilesRecursive(localAiRoot, {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
  });
  const q1Findings: Finding[] =
    q1Files.length <= CONFIG.maxFileCount
      ? []
      : [buildFinding(
          "LOCAL-AI-RUNTIME-001",
          CONFIG.sourceRoot,
          `src/lib/local-ai contains ${q1Files.length} files, exceeds ≤${CONFIG.maxFileCount} limit.`,
          "Delete non-essential files until the module is ≤9 source files.",
        )];
  allFindings.push(...q1Findings);
  phases.push(buildPhase(
    "Q1-file-count",
    q1Findings,
    `src/lib/local-ai file count (${q1Files.length}) within ≤${CONFIG.maxFileCount} limit.`,
    `src/lib/local-ai file count (${q1Files.length}) exceeds ≤${CONFIG.maxFileCount} limit.`,
  ));

  // Q2: index.ts 是否只暴露 callLocalModel / checkLocalAiReadiness / loadLocalAiConfig？
  const indexPath = pathFromRepoRoot(`${CONFIG.sourceRoot}/index.ts`);
  const indexExists = await fileExists(indexPath);
  let q2Findings: Finding[] = [];
  if (!indexExists) {
    q2Findings = [buildFinding(
      "LOCAL-AI-RUNTIME-002",
      `${CONFIG.sourceRoot}/index.ts`,
      "src/lib/local-ai/index.ts does not exist.",
      "Create index.ts exporting only callLocalModel, checkLocalAiReadiness, loadLocalAiConfig.",
    )];
  } else {
    const indexSource = await readTextFile(indexPath);
    const exportedFunctions = CONFIG.allowedPublicExports.filter((name) => indexSource.includes(name));
    const illegalExports = indexSource.match(/^export\s+(?:function|const|class|type|interface)\s+(\w+)/gm) ?? [];
    const illegalImplementationExports = illegalExports
      .map((line) => {
        const match = /export\s+(?:function|const|class)\s+(\w+)/.exec(line);
        return match ? (match[1] ?? null) : null;
      })
      .filter((name): name is string =>
        name !== null &&
        !(CONFIG.allowedPublicExports as readonly string[]).includes(name),
      );

    const missingAllowed = CONFIG.allowedPublicExports.filter((name) => !exportedFunctions.includes(name));
    if (missingAllowed.length > 0 || illegalImplementationExports.length > 0) {
      q2Findings = [buildFinding(
        "LOCAL-AI-RUNTIME-002",
        `${CONFIG.sourceRoot}/index.ts`,
        `index.ts must only expose [${CONFIG.allowedPublicExports.join(", ")}]. Missing: [${missingAllowed.join(", ")}]. Extra: [${illegalImplementationExports.join(", ")}].`,
        "Remove all extra exports and ensure only callLocalModel, checkLocalAiReadiness, loadLocalAiConfig are exported as functions/consts.",
      )];
    }
  }
  allFindings.push(...q2Findings);
  phases.push(buildPhase(
    "Q2-public-exports",
    q2Findings,
    "index.ts exposes exactly the 3 allowed public functions.",
    "index.ts exposes disallowed or missing public functions.",
  ));

  // Q3: 是否不存在 prompt-registry / prompts 目录？
  const q3BadDirs = CONFIG.forbiddenDirectories.filter((dir) => dir.includes("prompt"));
  const q3Findings: Finding[] = [];
  for (const dir of q3BadDirs) {
    if (await fileExists(pathFromRepoRoot(dir))) {
      q3Findings.push(buildFinding(
        "LOCAL-AI-RUNTIME-003",
        dir,
        `Forbidden prompt subsystem directory still exists: ${dir}`,
        "Delete the prompt registry / prompts directory entirely from local-ai.",
      ));
    }
  }
  allFindings.push(...q3Findings);
  phases.push(buildPhase(
    "Q3-no-prompt-registry",
    q3Findings,
    "No prompt-registry or prompts directory in local-ai.",
    "Prompt-registry or prompts subsystem directories still exist in local-ai.",
  ));

  // Q4: 是否不存在 runtime-adapters 目录？
  const q4Findings: Finding[] = [];
  for (const dir of CONFIG.forbiddenDirectories) {
    if (dir.includes("adapter") && (await fileExists(pathFromRepoRoot(dir)))) {
      q4Findings.push(buildFinding(
        "LOCAL-AI-RUNTIME-004",
        dir,
        `Forbidden runtime-adapters directory still exists: ${dir}`,
        "Delete the runtime-adapters directory entirely from local-ai.",
      ));
    }
  }
  allFindings.push(...q4Findings);
  phases.push(buildPhase(
    "Q4-no-runtime-adapters",
    q4Findings,
    "No runtime-adapters directory in local-ai.",
    "runtime-adapters subsystem directory still exists in local-ai.",
  ));

  // Q5: 是否不存在旧 task handlers？
  const q5Findings: Finding[] = [];
  for (const dir of CONFIG.forbiddenDirectories) {
    if (["page-preparation", "next-item", "comments-target", "ocr", "task-handlers"].some((k) => dir.includes(k))) {
      if (await fileExists(pathFromRepoRoot(dir))) {
        q5Findings.push(buildFinding(
          "LOCAL-AI-RUNTIME-005",
          dir,
          `Forbidden old task handler directory still exists: ${dir}`,
          "Delete page-preparation, next-item, comments-target, OCR, task-handler directories from local-ai.",
        ));
      }
    }
  }
  for (const fragment of CONFIG.forbiddenFileFragments) {
    if (["page-prep", "next-item", "comments-target", "ocr", "visionTask"].includes(fragment)) {
      const badFiles = q1Files.filter((f) => f.toLowerCase().includes(fragment.toLowerCase()));
      for (const badFile of badFiles) {
        q5Findings.push(buildFinding(
          "LOCAL-AI-RUNTIME-005",
          badFile,
          `Forbidden old task handler file: ${badFile} (contains fragment "${fragment}")`,
          "Delete old task handler files from local-ai.",
        ));
      }
    }
  }
  allFindings.push(...q5Findings);
  phases.push(buildPhase(
    "Q5-no-task-handlers",
    q5Findings,
    "No old task handler files (page-prep, next-item, comments-target, OCR, visionTask) in local-ai.",
    "Old task handler files still exist in local-ai.",
  ));

  // Q6: 是否不存在 provider routing / fallback / paid / future / cloud？
  const q6Findings: Finding[] = [];
  for (const fragment of CONFIG.forbiddenFileFragments) {
    if (["provider-router", "cloudFallback", "modelRoster", "roleControl", "paidModel", "futureModel", "runtime-adapter"].includes(fragment)) {
      const badFiles = q1Files.filter((f) => f.toLowerCase().includes(fragment.toLowerCase()));
      for (const badFile of badFiles) {
        q6Findings.push(buildFinding(
          "LOCAL-AI-RUNTIME-006",
          badFile,
          `Forbidden provider routing / fallback file: ${badFile}`,
          "Delete provider routing, fallback, paid/future/cloud model config files from local-ai.",
        ));
      }
    }
  }
  for (const dir of CONFIG.forbiddenDirectories) {
    if (["providers"].includes(dir.split("/").pop() ?? "")) {
      if (await fileExists(pathFromRepoRoot(dir))) {
        q6Findings.push(buildFinding(
          "LOCAL-AI-RUNTIME-006",
          dir,
          `Forbidden provider routing directory: ${dir}`,
          "Delete providers directory from local-ai.",
        ));
      }
    }
  }
  allFindings.push(...q6Findings);
  phases.push(buildPhase(
    "Q6-no-provider-routing",
    q6Findings,
    "No provider routing, fallback, paid/cloud model config in local-ai.",
    "Provider routing or fallback infrastructure still exists in local-ai.",
  ));

  // Q7: local-ai 是否不 import Nerve Bus / Forensics / Browser / Orchestration / MuscleMemory？
  const q7Findings: Finding[] = [];
  for (const filePath of q1Files) {
    const source = await readTextFile(filePath);
    for (const importFragment of CONFIG.forbiddenImportFragments) {
      if (source.includes(importFragment)) {
        q7Findings.push(buildFinding(
          "LOCAL-AI-RUNTIME-007",
          filePath,
          `Local AI file imports forbidden module "${importFragment}": ${filePath}`,
          "Remove the import. Local AI must not import Nerve Bus, Forensics, Browser, Orchestration, or MuscleMemory.",
        ));
      }
    }
  }
  allFindings.push(...q7Findings);
  phases.push(buildPhase(
    "Q7-no-forbidden-imports",
    q7Findings,
    "local-ai does not import Nerve Bus, Forensics, Browser, Orchestration, or MuscleMemory.",
    "local-ai imports forbidden modules (Nerve Bus, Forensics, Browser, Orchestration, or MuscleMemory).",
  ));

  // Q8: local-ai 是否只返回 raw model output，不做 JSON extraction / schema validation / action planning？
  const q8Findings: Finding[] = [];
  const skipForZodConfig = new Set(["config.ts"]);
  for (const filePath of q1Files) {
    const fileName = filePath.split("/").pop() ?? "";
    if (skipForZodConfig.has(fileName)) continue;
    const source = await readTextFile(filePath);
    for (const codeFragment of CONFIG.forbiddenCodeFragments) {
      if (source.includes(codeFragment)) {
        q8Findings.push(buildFinding(
          "LOCAL-AI-RUNTIME-008",
          filePath,
          `Local AI file contains forbidden code fragment "${codeFragment}": ${filePath}`,
          "Remove JSON extraction, schema validation, and action planning from local-ai. Only return raw model output.",
        ));
      }
    }
  }
  allFindings.push(...q8Findings);
  phases.push(buildPhase(
    "Q8-raw-output-only",
    q8Findings,
    "local-ai returns only raw model output — no JSON extraction, schema validation, or action planning.",
    "local-ai still performs JSON extraction, schema validation, or action planning.",
  ));

  return { findings: allFindings, phases };
};

export const localAiRuntimeInspector = createPendingDomainInspector({
  inspector: "GrassEye Local AI Runtime Owner Inspector",
  inspectorId: CONFIG.inspectorId,
  capabilityDomain: CONFIG.capabilityDomain,
  inspectorEntry: CONFIG.inspectorEntry,
  ownedPaths: [CONFIG.sourceRoot, "scripts/audit/domains/local-ai-runtime"],
  pendingSummary: "local-ai must be rebuilt as a minimal module with ≤9 files and 3 public exports.",
  implementedSummary: "local-ai is implemented as a minimal module: ≤9 files, 3 public exports, no forbidden subsystems.",
  extraChecks: runLocalAiRuntimeChecks,
});
