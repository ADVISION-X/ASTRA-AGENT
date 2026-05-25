import { inspectSmokeAcceptance } from "./inspector-smoke.js";
import { inspectConfidenceContract } from "./components/scan-confidence-contract.js";
import { inspectDecompositionPromptV2 } from "./components/scan-decomposition-prompt-v2.js";
import { inspectCaptureAndParseResilience } from "./components/scan-capture-and-parse-resilience.js";
import { inspectGatewayRawCaptureBoundary } from "./components/scan-gateway-raw-capture-boundary.js";
import { inspectSubQuestionFaultIsolation } from "./components/scan-sub-question-fault-isolation.js";
import { inspectSubQuestionPersistenceIdentity } from "./components/scan-sub-question-persistence-identity.js";
import { inspectWebChatProviderHandoff } from "./components/scan-web-chat-provider-handoff.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import type { DeepResearchAuditFiles } from "./inspector-file-map.js";

type DeepResearchCaptureAndSmokeInput = {
  context: InspectorContext;
  files: DeepResearchAuditFiles;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  captureLawId: string;
  smokeLawId: string;
};

export const inspectCaptureAndSmokeRules = (input: DeepResearchCaptureAndSmokeInput): void => {
  inspectCaptureAndParseResilience({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });
  inspectWebChatProviderHandoff({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.captureLawId,
  });
  inspectSubQuestionPersistenceIdentity({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.captureLawId,
  });
  inspectGatewayRawCaptureBoundary({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.captureLawId,
  });
  inspectSubQuestionFaultIsolation({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });
  inspectConfidenceContract({
    promptsFile: input.files.promptsFile,
    finalAdjudicationPromptFile: input.files.finalAdjudicationPromptFile,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });
  inspectDecompositionPromptV2({
    promptFile: input.files.promptFile,
    promptsFile: input.files.promptsFile,
    acceptanceFile: input.files.decompositionAcceptanceFile,
    qualityFile: input.files.qualityFile,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });
  inspectSmokeAcceptance({
    smokeFile: input.files.smokeFile,
    ciFullFile: input.files.ciFullFile,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.smokeLawId,
  });
};