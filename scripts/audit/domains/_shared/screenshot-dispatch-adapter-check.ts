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

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
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

  return findings;
}