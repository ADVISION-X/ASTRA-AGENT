import { Node, SyntaxKind, type ObjectLiteralExpression, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "./ast-helpers.js";
import { getFunctionLike } from "./ast-schema-queries.js";
import {
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
} from "./retired-map-chain-field-names.js";

const FORBIDDEN_SOURCE_PROOF_FIELDS = [
  "missionId",
  "runId",
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
  RETIRED_ACTIVATION_REF_FIELD,
  "nerveBusEnvelopeId",
  "idempotencyKey",
  "timeoutMs",
] as const;

const getReturnedObjectLiteralFromBody = (body: Node | null | undefined): ObjectLiteralExpression | null => {
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
};

const getFunctionBody = (functionLike: Node | null): Node | undefined => {
  if (!functionLike) {
    return undefined;
  }
  return Node.isArrowFunction(functionLike) || Node.isFunctionDeclaration(functionLike) || Node.isFunctionExpression(functionLike)
    ? functionLike.getBody()
    : undefined;
};

const getObjectPropertyNames = (objectLiteral: ObjectLiteralExpression): Set<string> => {
  const propertyNames = objectLiteral.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      return [property.getName()];
    }
    return [];
  });
  return new Set(propertyNames);
};

const getReturnedObjectPropertyNames = (project: Project, filePath: string, functionName: string): Set<string> => {
  const source = getSourceFileOrThrow(project, filePath);
  const functionLike = getFunctionLike(source, functionName);
  const returnedObject = getReturnedObjectLiteralFromBody(getFunctionBody(functionLike));
  return returnedObject ? getObjectPropertyNames(returnedObject) : new Set();
};

export function getSourceProofPollutionFindings(project: Project, lawId: string, handoffFile: string): Finding[] {
  const sourceProofFields = getReturnedObjectPropertyNames(project, handoffFile, "buildSourceProof");
  const pollutedFields = FORBIDDEN_SOURCE_PROOF_FIELDS.filter((field) => sourceProofFields.has(field));
  if (pollutedFields.length === 0) {
    return [];
  }

  return [createFinding({
    lawId,
    file: handoffFile,
    line: 1,
    severity: "fatal",
    message: `Screenshot stored_image sourceProof must not carry outer governed runtime chain fields: ${pollutedFields.join(", ")}.`,
  })];
}
