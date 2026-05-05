import { Node, SyntaxKind, type ObjectLiteralExpression, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "./ast-helpers.js";
import { getFunctionLike } from "./ast-schema-queries.js";

type PropertyBinding = {
  name: string;
  initializer: string;
};

const DISPATCH_FILE = "src/lib/local-runtime/workbench-screenshot-dispatch-input.ts";
const RESULT_ENVELOPE_FILE = "src/lib/local-runtime/workbench-ability-result-envelope.ts";
const HANDOFF_FILE = "src/lib/local-runtime/workbench-screenshot-source-handoff.ts";
const COMMON_BINDINGS: PropertyBinding[] = [
  { name: "missionId", initializer: "envelope.missionId" },
  { name: "runId", initializer: "envelope.runId" },
  { name: "sessionId", initializer: "envelope.sessionId" },
  { name: "roundId", initializer: "envelope.roundId" },
  { name: "videoVisitId", initializer: "envelope.videoVisitId" },
  { name: "stepId", initializer: "envelope.stepId" },
  { name: "mapPackageId", initializer: "envelope.mapPackageId" },
  { name: "mapPackageVersion", initializer: "envelope.mapPackageVersion" },
  { name: "selectedMapId", initializer: "envelope.selectedMapId" },
  { name: "selectedMapVersion", initializer: "envelope.selectedMapVersion" },
  { name: "activationSnapshotRef", initializer: "envelope.activationSnapshotRef" },
  { name: "capabilityCallId", initializer: "envelope.capabilityCallId" },
  { name: "nerveBusEnvelopeId", initializer: "envelope.nerveBusEnvelopeId" },
  { name: "inputRef", initializer: "envelope.inputRef" },
  { name: "idempotencyKey", initializer: "envelope.idempotencyKey" },
  { name: "timeoutMs", initializer: "resolveTransportTimeoutMs(envelope)" },
] as const;

const PREPARE_AI_INPUT_SNIPPETS = [
  "const source = resolveScreenshotSourceHandoff([",
  "payloadValueToString(payload.screenshotEvidenceRef)",
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
  if (!functionLike || (!Node.isArrowFunction(functionLike) && !Node.isFunctionDeclaration(functionLike) && !Node.isFunctionExpression(functionLike))) {
    return null;
  }

  const body = functionLike.getBody();
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

function hasBinding(objectLiteral: ObjectLiteralExpression, binding: PropertyBinding) {
  const property = objectLiteral.getProperty(binding.name);
  if (!property || !Node.isPropertyAssignment(property)) {
    return false;
  }

  return normalize(property.getInitializer()?.getText() ?? "") === normalize(binding.initializer);
}

function getObjectPropertyLiteral(objectLiteral: ObjectLiteralExpression, propertyName: string): ObjectLiteralExpression | null {
  const property = objectLiteral.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) {
    return null;
  }

  const initializer = property.getInitializer();
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : null;
}

export function inspectScreenshotDispatchAdapter(project: Project, lawId: string): Finding[] {
  const commonFields = getReturnedObjectLiteral(project, "buildScreenshotCommonFields");
  const captureBrowserViewport = getReturnedObjectLiteral(project, "buildCaptureBrowserViewportCommand");

  if (!commonFields) {
    return [createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot local-runtime dispatch adapter must expose a dedicated governed common-field builder.",
    })];
  }

  const findings: Finding[] = [];
  if (!COMMON_BINDINGS.every((binding) => hasBinding(commonFields, binding))) {
    findings.push(createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot local-runtime dispatch adapter must preserve governed chain fields, inputRef, idempotencyKey, and timeoutMs before entering the Screenshot owner boundary.",
    }));
  }

  if (!captureBrowserViewport) {
    findings.push(createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot browser viewport dispatch adapter must remain explicit and owner-auditable.",
    }));
    return findings;
  }

  const sourceLiteral = getObjectPropertyLiteral(captureBrowserViewport, "source");
  const hasViewportSource = sourceLiteral !== null
    && hasBinding(sourceLiteral, { name: "kind", initializer: '"browser_viewport"' })
    && hasBinding(sourceLiteral, { name: "pageUrl", initializer: "payloadValueToString(payload.targetUrl)" })
    && hasBinding(sourceLiteral, { name: "pageTitle", initializer: "payloadValueToString(payload.targetTitle)" })
    && hasBinding(sourceLiteral, { name: "browserSessionRef", initializer: "null" });
  const hasPageStateProof = hasBinding(captureBrowserViewport, {
    name: "pageStateProof",
    initializer: "buildScreenshotPageStateProof(envelope, payload)",
  });

  if (!hasViewportSource || !hasPageStateProof) {
    findings.push(createFinding({
      lawId,
      file: DISPATCH_FILE,
      line: 1,
      severity: "fatal",
      message: "Screenshot browser viewport dispatch adapter must derive browser_viewport source and pageStateProof from governed transport payload refs.",
    }));
  }

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

  return findings;
}