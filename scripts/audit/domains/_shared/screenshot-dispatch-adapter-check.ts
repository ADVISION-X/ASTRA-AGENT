import { Node, SyntaxKind, type ObjectLiteralExpression, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "./ast-helpers.js";
import { getFunctionLike } from "./ast-schema-queries.js";
import {
  getMissingScreenshotShortChainFinding,
  hasBinding,
  getScreenshotShortChainBindingFindings,
} from "./screenshot-dispatch-short-chain-check.js";
import { getSourceProofPollutionFindings } from "./screenshot-source-proof-pollution-check.js";

const DISPATCH_FILE = "src/lib/local-runtime/workbench-screenshot-dispatch-input.ts";
const RESULT_ENVELOPE_FILE = "src/lib/local-runtime/workbench-ability-result-envelope.ts";
const RESULT_PROOF_SUMMARY_FILE = "src/lib/local-runtime/workbench-ability-result-proof-summary.ts";
const RESULT_PREPARE_AI_PROOF_SUMMARY_FILE = "src/lib/local-runtime/workbench-ability-result-proof-summary-prepare-ai-input.ts";
const HANDOFF_FILE = "src/lib/local-runtime/workbench-screenshot-source-handoff.ts";
const AI_INPUT_PROOF_REGISTRY_FILE = "src/capabilities/ai/shared/ai-input-proof-registry.ts";
const PREPARE_AI_INPUT_SNIPPETS = [
  "const source = resolvePrepareAiInputSource(envelope, payload);",
  "PREPARE_AI_INPUT_SOURCE_KEYS_BY_STEP_ID",
  "payloadValueToString(payload.abilityResultRef)",
  "envelope.inputRef",
  "...(source ? { source } : {})",
] as const;

const RESULT_HANDOFF_SNIPPETS = [
  "recordScreenshotSourceHandoff({ outputRef: outputPayload.documentRef, result: input.result });",
] as const;

const HANDOFF_SNIPPETS = [
  "const screenshotSourceHandoffs = new Map<string, ScreenshotStoredImageSourceHandoff>();",
  "result.abilityGroupId !== \"screenshot\" || result.status !== \"success\"",
  "const sourceStorageRef = readString(artifactRef, \"storageRef\");",
  "const sourceHash = readString(artifactRef, \"sha256\");",
  "sourceArtifactRef: artifactRef",
  "sourceProof: buildSourceProof",
  "screenshotSourceHandoffs.set(input.outputRef, handoff);",
  "screenshotSourceHandoffs.set(evidenceId, handoff);",
  "export function resolveScreenshotSourceHandoff",
] as const;

const SCREENSHOT_PROOF_SUMMARY_FIELDS = [
  "screenshotEvidenceId",
  "artifactRef",
  "artifactStorageRef",
  "outputHash",
  "artifactHash",
  "byteSize",
  "width",
  "height",
  "coordinateSpace",
  "runtimeProofRef",
] as const;

const PREPARE_AI_PROOF_SUMMARY_FIELDS = [
  "promptInputRef",
  "aiInputArtifactRef",
  "sourceScreenshotEvidenceId",
  "sourceStorageRef",
  "preparedImageHash",
  "preparedImageWidth",
  "preparedImageHeight",
  "coordinateSpace",
] as const;

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function sourceContainsAll(project: Project, filePath: string, snippets: readonly string[]) {
  const source = getSourceFileOrThrow(project, filePath);
  const text = normalize(source.getFullText());
  return snippets.every((snippet) => text.includes(normalize(snippet)));
}

function getReturnedObjectLiteral(project: Project, functionName: string): ObjectLiteralExpression | null {
  const source = getSourceFileOrThrow(project, DISPATCH_FILE);
  const functionLike = getFunctionLike(source, functionName);
  if (!functionLike) {
    return null;
  }
  const body = Node.isArrowFunction(functionLike) || Node.isFunctionDeclaration(functionLike) || Node.isFunctionExpression(functionLike)
    ? functionLike.getBody()
    : undefined;
  return getReturnedObjectLiteralFromBody(body);
}

function getReturnedObjectLiteralFromBody(body: import("ts-morph").Node | null | undefined): ObjectLiteralExpression | null {
  if (body && Node.isObjectLiteralExpression(body)) {
    return body;
  }
  if (!body || !Node.isBlock(body)) {
    return null;
  }
  const returnStatement = body.getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => {
    const expression = statement.getExpression();
    return Boolean(expression && Node.isObjectLiteralExpression(expression));
  });
  const expression = returnStatement?.getExpression();
  return expression && Node.isObjectLiteralExpression(expression) ? expression : null;
}

function getObjectPropertyLiteral(objectLiteral: ObjectLiteralExpression, propertyName: string): ObjectLiteralExpression | null {
  const property = objectLiteral.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) {
    return null;
  }

  const initializer = property.getInitializer();
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : null;
}

function getFunctionPropertyNames(project: Project, filePath: string, functionName: string): Set<string> {
  const source = getSourceFileOrThrow(project, filePath);
  const functionLike = getFunctionLike(source, functionName);
  if (!functionLike) {
    return new Set();
  }
  return new Set([
    ...functionLike.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()),
    ...functionLike.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment).map((property) => property.getName()),
  ]);
}

function getNormalizedFunctionText(project: Project, filePath: string, functionName: string): string {
  const source = getSourceFileOrThrow(project, filePath);
  const functionLike = getFunctionLike(source, functionName);
  return normalize(functionLike?.getText() ?? "");
}

function functionHasFields(project: Project, filePath: string, functionName: string, fields: readonly string[]): boolean {
  const propertyNames = getFunctionPropertyNames(project, filePath, functionName);
  return fields.every((field) => propertyNames.has(field));
}

function hasCallExpressionNamed(project: Project, filePath: string, callName: string): boolean {
  const source = getSourceFileOrThrow(project, filePath);
  return source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => call.getExpression().getText() === callName);
}

const getMissingCommonFieldsFinding = (commonFields: ObjectLiteralExpression | null, lawId: string): Finding[] =>
  getMissingScreenshotShortChainFinding(commonFields, lawId, DISPATCH_FILE);

const getCommonBindingFindings = (commonFields: ObjectLiteralExpression, lawId: string): Finding[] =>
  getScreenshotShortChainBindingFindings(commonFields, lawId, DISPATCH_FILE);

const hasViewportSourceBindings = (captureBrowserViewport: ObjectLiteralExpression): boolean => {
  const sourceLiteral = getObjectPropertyLiteral(captureBrowserViewport, "source");
  return sourceLiteral !== null
    && hasBinding(sourceLiteral, { name: "kind", initializer: '"browser_viewport"' })
    && hasBinding(sourceLiteral, { name: "pageUrl", initializer: "payloadValueToString(payload.targetUrl)" })
    && hasBinding(sourceLiteral, { name: "pageTitle", initializer: "payloadValueToString(payload.targetTitle)" })
    && hasBinding(sourceLiteral, { name: "browserSessionRef", initializer: "null" });
};

const hasViewportPageStateProofHandoff = (
  project: Project,
  captureBrowserViewport: ObjectLiteralExpression,
): boolean => {
  const pageStateProofProperty = captureBrowserViewport.getProperty("pageStateProof");
  const hasDirectPageStateProofBinding = hasBinding(captureBrowserViewport, {
    name: "pageStateProof",
    initializer: "buildScreenshotPageStateProof(envelope, payload)",
  });
  const hasShorthandPageStateProofBinding = Boolean(pageStateProofProperty && Node.isShorthandPropertyAssignment(pageStateProofProperty));
  const captureViewportFunctionText = getNormalizedFunctionText(project, DISPATCH_FILE, "buildCaptureBrowserViewportCommand");
  return (hasDirectPageStateProofBinding || hasShorthandPageStateProofBinding)
    && captureViewportFunctionText.includes(normalize("const pageStateProof = buildScreenshotPageStateProof(envelope, payload);"));
};

const hasBootstrapCapturePolicyException = (project: Project): boolean => {
  const bootstrapCapturePolicyFunctionText = getNormalizedFunctionText(project, DISPATCH_FILE, "buildBootstrapCapturePolicy");
  return bootstrapCapturePolicyFunctionText.includes(normalize("payloadValueToString(input.payload.sourceEvidenceRef)"))
    && bootstrapCapturePolicyFunctionText.includes(normalize("allowFirstCaptureWithoutPageStateProof: true"))
    && bootstrapCapturePolicyFunctionText.includes(normalize("if (input.pageStateProof) { return undefined; }"));
};

const getViewportDispatchFindings = (project: Project, captureBrowserViewport: ObjectLiteralExpression | null, lawId: string): Finding[] => {
  const findings: Finding[] = [];
  if (!captureBrowserViewport) {
    return [createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot browser viewport dispatch adapter must remain explicit and owner-auditable.",
    })];
  }

  const hasViewportSource = hasViewportSourceBindings(captureBrowserViewport);
  const hasPageStateProofHandoff = hasViewportPageStateProofHandoff(project, captureBrowserViewport);
  const hasBootstrapCaptureException = hasBootstrapCapturePolicyException(project);

  if (!hasViewportSource || !hasPageStateProofHandoff || !hasBootstrapCaptureException) {
    findings.push(createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot browser viewport dispatch adapter must derive browser_viewport source and governed pageStateProof, or a lawful startup bootstrap capturePolicy exception, from governed transport payload refs.",
    }));
  }
  return findings;
};

const getSourceHandoffFindings = (project: Project, lawId: string): Finding[] => {
  const findings: Finding[] = [];
  if (!sourceContainsAll(project, DISPATCH_FILE, PREPARE_AI_INPUT_SNIPPETS)) {
    findings.push(createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot prepare-ai-input dispatch adapter must resolve governed stored_image source handoff refs from screenshotEvidenceRef, abilityResultRef, or inputRef before entering the Screenshot owner boundary.",
    }));
  }
  if (!sourceContainsAll(project, RESULT_ENVELOPE_FILE, RESULT_HANDOFF_SNIPPETS)) {
    findings.push(createFinding({
      lawId,
      file: RESULT_ENVELOPE_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot ability result envelopes must record successful screenshot source handoffs by outputRef before orchestration consumes the result.",
    }));
  }

  if (!sourceContainsAll(project, HANDOFF_FILE, HANDOFF_SNIPPETS)) {
    findings.push(createFinding({
      lawId,
      file: HANDOFF_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot local-runtime source handoff helper must cache governed screenshot artifacts by outputRef or evidenceId and rebuild stored_image proof from artifact hash and runtime proof fields.",
    }));
  }

  return [
    ...findings,
    ...getSourceProofPollutionFindings(project, lawId, HANDOFF_FILE),
  ];
};

const hasPrepareAiInputTerminalProofSummary = (project: Project): boolean => {
  return functionHasFields(project, RESULT_PREPARE_AI_PROOF_SUMMARY_FILE, "buildPrepareAiInputProofSummarySummary", PREPARE_AI_PROOF_SUMMARY_FIELDS)
    && hasCallExpressionNamed(project, RESULT_PREPARE_AI_PROOF_SUMMARY_FILE, "recordAiInputProofSummary")
    && hasCallExpressionNamed(project, RESULT_PROOF_SUMMARY_FILE, "buildPrepareAiInputProofSummary");
};

const hasAiInputProofRegistryShape = (project: Project): boolean => {
  const registrySource = getSourceFileOrThrow(project, AI_INPUT_PROOF_REGISTRY_FILE);
  return Boolean(registrySource.getTypeAlias("AiInputProofSummary"))
    && Boolean(registrySource.getFunction("recordAiInputProofSummary"));
};

const hasTerminalProofSummaryProjection = (project: Project): boolean => {
  return functionHasFields(project, RESULT_PROOF_SUMMARY_FILE, "buildScreenshotProofSummary", SCREENSHOT_PROOF_SUMMARY_FIELDS)
    && hasPrepareAiInputTerminalProofSummary(project)
    && hasCallExpressionNamed(project, RESULT_PROOF_SUMMARY_FILE, "recordAbilityResultProofSummary")
    && hasCallExpressionNamed(project, RESULT_ENVELOPE_FILE, "buildAbilityResultProofSummary")
    && hasAiInputProofRegistryShape(project);
};

const createTerminalProofSummaryFinding = (lawId: string): Finding => {
  return createFinding({
    lawId,
    file: RESULT_PROOF_SUMMARY_FILE,
    line: 1,
    severity: "fatal",
    message: "Screenshot success and prepare-ai-input success must project terminal-auditable artifact, hash, dimension, promptInputRef, and aiInputArtifactRef proof fields without raw image payloads.",
  });
};

const getTerminalProofSummaryFindings = (project: Project, lawId: string): Finding[] => {
  return hasTerminalProofSummaryProjection(project) ? [] : [createTerminalProofSummaryFinding(lawId)];
};

const getLightweightCurrentVideoFindings = (project: Project, lawId: string): Finding[] => sourceContainsAll(project, DISPATCH_FILE, [
  '"capture-current-video-viewport": 250',
  'return Math.min(resolveTransportTimeoutMs(envelope), PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_TIMEOUT_MS);',
  'maxAiWidth: PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_MAX_AI_WIDTH', 'preservePixels: false', 'evidencePolicy: "ai_input" as const',
  'maxDurationMs: PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_TIMEOUT_MS', 'timeoutMs: isLightweightPrepare ? resolveLightweightScreenshotTimeoutMs(envelope) : resolveTransportTimeoutMs(envelope)',
]) ? [] : [createFinding({ lawId, file: DISPATCH_FILE, line: 1, severity: "fatal", message: "Screenshot dispatch adapter must keep current-video product-presence capture on the lightweight policy path: 250ms sample delay, <=720px AI width, preservePixels=false, ai_input evidence policy, and <=1500ms timeout/budget." })];

export function inspectScreenshotDispatchAdapter(project: Project, lawId: string): Finding[] {
  const commonFields = getReturnedObjectLiteral(project, "buildScreenshotCommonFields");
  const captureBrowserViewport = getReturnedObjectLiteral(project, "buildCaptureBrowserViewportCommand");
  const missingCommonFields = getMissingCommonFieldsFinding(commonFields, lawId);

  return commonFields
    ? [
      ...getCommonBindingFindings(commonFields, lawId),
      ...getViewportDispatchFindings(project, captureBrowserViewport, lawId),
      ...getSourceHandoffFindings(project, lawId),
      ...getTerminalProofSummaryFindings(project, lawId),
      ...getLightweightCurrentVideoFindings(project, lawId),
    ]
    : missingCommonFields;
}
