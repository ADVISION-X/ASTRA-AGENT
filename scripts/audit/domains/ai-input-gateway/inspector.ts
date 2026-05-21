import { existsSync, readFileSync } from "node:fs";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorResult } from "../../core/schema.js";
import { collectAiInputGatewayAstEvidenceFindings } from "./ai-input-gateway-ast-evidence.js";

const LAW_FILE = ".github/instructions/cursor-rules/modules/module-ai-input-gateway.instructions.md";
const BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md";

const REQUIRED_LAW_IDS = [
  "GRASSEYE-AI-FEED-001-V1",
  "GRASSEYE-AI-FEED-002-V1",
  "GRASSEYE-AI-FEED-003-V1",
  "GRASSEYE-AI-FEED-004-V1",
  "GRASSEYE-AI-FEED-005-V1",
  "GRASSEYE-AI-FEED-006-V1",
  "GRASSEYE-AI-FEED-007-V1",
  "GRASSEYE-AI-FEED-008-V1",
  "GRASSEYE-AI-FEED-009-V1",
  "GRASSEYE-AI-FEED-010-V1",
] as const;

const REQUIRED_PATHS = [
  LAW_FILE,
  BLUEPRINT_FILE,
  "src/capabilities/ai-input-gateway/index.ts",
  "src/capabilities/ai-input-gateway/schema.ts",
  "src/capabilities/ai-input-gateway/contract.ts",
  "src/capabilities/ai-input-gateway/ability-group.ts",
  "src/capabilities/ai-input-gateway/manifest.ts",
  "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts",
  "src/capabilities/ai-input-gateway/providers/gemini-api.adapter.ts",
  "src/capabilities/ai-input-gateway/providers/gemini-web-chat.adapter.ts",
  "src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts",
  "src/capabilities/ai-input-gateway/runtime/ai-feed-proof.ts",
  "src/capabilities/ai-input-gateway/runtime/ai-feed-output-parser.ts",
  "scripts/audit/domains/ai-input-gateway/manifest.json",
  "scripts/audit/domains/ai-input-gateway/inspector.ts",
  "scripts/audit/domains/ai-input-gateway/ai-input-gateway-ast-evidence.ts",
] as const;

const fileExists = (relativePath: string): boolean =>
  existsSync(pathFromRepoRoot(relativePath));

const readRepoFile = (relativePath: string): string =>
  readFileSync(pathFromRepoRoot(relativePath), "utf8");

const gatewayFinding = (
  lawId: string,
  file: string,
  message: string,
  hint: string,
): Finding => createFinding({
    lawId,
    file,
    line: 1,
    severity: "fatal",
    message,
    hint,
  });

const collectRequiredPathFindings = (): Finding[] =>
  REQUIRED_PATHS
    .filter((relativePath) => !fileExists(relativePath))
    .map((relativePath) => gatewayFinding(
      "GRASSEYE-AI-FEED-001-V1",
      relativePath,
      "AI Input Gateway required path is missing",
      "Create the required law, blueprint, runtime, provider, or inspector path.",
    ));

const collectLawDocumentFindings = (): Finding[] => {
  if (!fileExists(LAW_FILE)) {
    return [gatewayFinding(
      "GRASSEYE-AI-FEED-001-V1",
      LAW_FILE,
      "AI Input Gateway law file is missing",
      "Create the active law file before runtime construction.",
    )];
  }
  const lawText = readRepoFile(LAW_FILE);
  return REQUIRED_LAW_IDS
    .filter((lawId) => !lawText.includes(lawId))
    .map((lawId) => gatewayFinding(
      lawId,
      LAW_FILE,
      "AI Input Gateway law id is missing from law file",
      "Restore the complete AI Input Gateway law set.",
    ));
};

export const runAiInputGatewayInspector = async (
  _context: InspectorContext,
): Promise<InspectorResult> => {
  const findings = [
    ...collectRequiredPathFindings(),
    ...collectLawDocumentFindings(),
    ...collectAiInputGatewayAstEvidenceFindings(),
  ];
  const passed = findings.length === 0;
  return finalizeInspectorResult({
    inspector: "ai-input-gateway",
    inspectorId: "ai-input-gateway-owner",
    capabilityDomain: "ai-input-gateway",
    findings,
    phases: [
      createPhase("documents", passed ? "PASS" : "CODE VIOLATION", passed, "law and blueprint presence checked."),
      createPhase("runtime-shape", passed ? "PASS" : "CODE VIOLATION", passed, "runtime required paths checked."),
      createPhase("ast-symbols", passed ? "PASS" : "CODE VIOLATION", passed, "exported symbols checked with ts-morph."),
      createPhase("anti-escape", passed ? "PASS" : "CODE VIOLATION", passed, "provider and plugin escape paths checked with ts-morph."),
    ],
    summary: passed
      ? "AI Input Gateway governance is ready."
      : "AI Input Gateway governance has blocking findings.",
  });
};
