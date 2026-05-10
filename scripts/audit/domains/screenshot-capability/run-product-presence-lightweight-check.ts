import { Node, type Project, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getSource } from "./project-access.js";

function getNumericConst(sourceFile: SourceFile, declarationName: string): number | null {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializer();
  return initializer && Node.isNumericLiteral(initializer) ? Number(initializer.getLiteralText()) : null;
}

function sourceIncludesAll(sourceFile: SourceFile, snippets: readonly string[]): boolean {
  const text = sourceFile.getFullText();
  return snippets.every((snippet) => text.includes(snippet));
}

function collectDispatchFindings(project: Project): Finding[] {
  const sourceFile = getSource(project, PATHS.WORKBENCH_DISPATCH_INPUT);
  const findings: Finding[] = [];
  const timeoutMs = getNumericConst(sourceFile, "PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_TIMEOUT_MS");
  const maxAiWidth = getNumericConst(sourceFile, "PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_MAX_AI_WIDTH");

  if (timeoutMs !== 1500) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.WORKBENCH_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Product-presence lightweight screenshot dispatch must freeze timeout at 1500ms." }));
  }
  if (maxAiWidth !== 720) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.WORKBENCH_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Product-presence lightweight screenshot dispatch must freeze maxAiWidth at 720." }));
  }
  if (!sourceIncludesAll(sourceFile, [
    'capture-current-video-viewport',
    'prepare-current-video-ai-input',
    'preservePixels: false',
    'evidencePolicy: "ai_input"',
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.WORKBENCH_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Product-presence lightweight screenshot dispatch must keep ai_input evidencePolicy, preservePixels=false, and current-video step bindings." }));
  }

  return findings;
}

function collectRuntimeProfileFindings(project: Project): Finding[] {
  const sourceFile = getSource(project, PATHS.LIGHTWEIGHT_OBSERVATION);
  const findings: Finding[] = [];
  const expectedFunctions = [
    "isProductPresenceLightweightObservation",
    "resolveScreenshotCaptureProfile",
    "resolveScreenshotAiInputEncodeProfile",
  ] as const;

  for (const functionName of expectedFunctions) {
    if (!sourceFile.getFunction(functionName)) {
      findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.LIGHTWEIGHT_OBSERVATION, line: 1, severity: "fatal", message: `Screenshot lightweight observation runtime must export ${functionName}.` }));
    }
  }

  if (!sourceIncludesAll(sourceFile, [
    'capture-current-video-viewport',
    'prepare-current-video-ai-input',
    'request.capturePolicy.evidencePolicy === "ai_input"',
    'request.capturePolicy.preservePixels === false',
    'request.capturePolicy.maxDurationMs <= PRODUCT_PRESENCE_LIGHTWEIGHT_MAX_DURATION_MS',
    'requestedMaxAiWidth <= PRODUCT_PRESENCE_LIGHTWEIGHT_MAX_AI_WIDTH',
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.LIGHTWEIGHT_OBSERVATION, line: 1, severity: "fatal", message: "Screenshot lightweight observation runtime must bind current-video step ids to ai_input, preservePixels=false, timeout<=1500ms, and maxAiWidth<=720." }));
  }

  return findings;
}

function collectBrowserCaptureFindings(project: Project): Finding[] {
  const controllerSource = getSource(project, PATHS.CURRENT_CHROME_CONTROLLER);
  const screenshotSource = getSource(project, PATHS.CURRENT_CHROME_SCREENSHOT);
  const findings: Finding[] = [];

  if (!sourceIncludesAll(controllerSource, [
    'captureProfile?: "default" | "observation_lightweight"',
    'allowFullscreenFallback: input.captureProfile !== "observation_lightweight"',
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.CURRENT_CHROME_CONTROLLER, line: 1, severity: "fatal", message: "Current Chrome screenshotRegion must forward the observation_lightweight profile and disable full-screen fallback for it." }));
  }

  if (!sourceIncludesAll(screenshotSource, [
    'allowFullscreenFallback?: boolean',
    'if (input.allowFullscreenFallback === false)',
    '`-R${captureRegion.left},${captureRegion.top},${captureRegion.width},${captureRegion.height}`',
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.CURRENT_CHROME_SCREENSHOT, line: 1, severity: "fatal", message: "Current Chrome screenshot capture must prefer direct region screencapture and block full-screen fallback for lightweight observation." }));
  }

  return findings;
}

function collectEncoderFindings(project: Project): Finding[] {
  const sourceFile = getSource(project, PATHS.IMAGE_PROCESSING_ADAPTER);
  const findings: Finding[] = [];
  const quality = getNumericConst(sourceFile, "LIGHTWEIGHT_AI_INPUT_JPEG_QUALITY");

  if (quality === null || quality < 60 || quality > 70) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.IMAGE_PROCESSING_ADAPTER, line: 1, severity: "fatal", message: "Lightweight ai_input JPEG quality must stay in the 60-70 range." }));
  }

  if (!sourceIncludesAll(sourceFile, [
    'const useLightweightProfile = portInput.encodeProfile === "observation_lightweight"',
    'mozjpeg: useLightweightProfile ? false : true',
  ])) {
    findings.push(createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.IMAGE_PROCESSING_ADAPTER, line: 1, severity: "fatal", message: "prepare-ai-input must disable mozjpeg only for the lightweight observation profile." }));
  }

  return findings;
}

function collectTimingFindings(project: Project): Finding[] {
  const schemaSource = getSource(project, PATHS.SCHEMA);
  const executionPhasesSource = getSource(project, PATHS.EXECUTION_PHASES);
  const executionSuccessSource = getSource(project, PATHS.EXECUTION_SUCCESS);
  const successResultSource = getSource(project, PATHS.EXECUTION_SUCCESS_RESULT);

  return sourceIncludesAll(schemaSource, [
    'capturePhaseMs:',
    'imageProcessingPhaseMs:',
    'artifactStoragePhaseMs:',
    'outputBoundaryPhaseMs:',
    'totalScreenshotStepMs:',
  ]) && sourceIncludesAll(executionPhasesSource, [
    'measureScreenshotPhaseMs',
    'capturePhaseMs: captureMeasurement.durationMs',
    'imageProcessingPhaseMs: imageMeasurement.durationMs',
    'artifactStoragePhaseMs: artifactStorageMeasurement.durationMs',
  ]) && sourceIncludesAll(executionSuccessSource, [
    'outputBoundaryPhaseMs: outputBoundaryMeasurement.durationMs',
  ]) && sourceIncludesAll(successResultSource, [
    'totalScreenshotStepMs: input.finished.durationMs',
  ])
    ? []
    : [createFinding({ lawId: LAW_IDS.REAL_CODE_INSPECTION, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot runtime proof must expose capture/image/artifact/boundary/total timing fields for lightweight observation diagnostics." })];
}

export function runProductPresenceLightweightCheck(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectDispatchFindings(project),
    ...collectRuntimeProfileFindings(project),
    ...collectBrowserCaptureFindings(project),
    ...collectEncoderFindings(project),
    ...collectTimingFindings(project),
  ];
  const passed = findings.length === 0;

  return {
    findings,
    phase: createPhase(
      "product-presence-lightweight-check",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Product-presence lightweight screenshot mode stays frozen across dispatch, runtime profile, browser capture, ai-input encoding, and timing proof."
        : "Product-presence lightweight screenshot mode drifted away from the governed runtime contract.",
    ),
  };
}