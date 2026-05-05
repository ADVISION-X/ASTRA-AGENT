import { Node, SyntaxKind, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getFunctionLike, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getSource } from "./project-access.js";

const EXPECTED_PROOF_REQUIRED_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const EXPECTED_PROOF_OPTIONAL_FIELDS = ["roundId", "videoVisitId"] as const;
const EXPECTED_RESULT_OPTIONAL_FIELDS = [...EXPECTED_PROOF_OPTIONAL_FIELDS, "diagnosticPayloadRef"] as const;

const unwrapExpression = (node: import("ts-morph").Node | undefined): import("ts-morph").Node | undefined => {
  if (!node) {
    return undefined;
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
};

const getConstStringArrayValues = (project: Project, path: string, declarationName: string): string[] => {
  const source = getSource(project, path);
  const declaration = source.getVariableDeclaration(declarationName);
  const initializer = unwrapExpression(declaration?.getInitializer());
  if (!initializer) {
    return [];
  }

  if (Node.isArrayLiteralExpression(initializer)) {
    return initializer.getElements().flatMap((element) => {
      if (Node.isStringLiteral(element)) {
        return [element.getLiteralText()];
      }
      if (Node.isSpreadElement(element)) {
        return getIdentifierArrayValues(element.getExpression());
      }
      return [];
    });
  }

  return getIdentifierArrayValues(initializer);

  function getIdentifierArrayValues(node: import("ts-morph").Node): string[] {
    if (!Node.isIdentifier(node)) {
      return [];
    }

    const symbol = node.getSymbol()?.getAliasedSymbol() ?? node.getSymbol();
    for (const symbolDeclaration of symbol?.getDeclarations() ?? []) {
      if (!Node.isVariableDeclaration(symbolDeclaration)) {
        continue;
      }
      const nestedInitializer = unwrapExpression(symbolDeclaration.getInitializer());
      if (!nestedInitializer) {
        continue;
      }
      if (Node.isArrayLiteralExpression(nestedInitializer)) {
        return nestedInitializer.getElements().flatMap((element) => {
          if (Node.isStringLiteral(element)) {
            return [element.getLiteralText()];
          }
          if (Node.isSpreadElement(element)) {
            return getIdentifierArrayValues(element.getExpression());
          }
          return [];
        });
      }
    }

    return [];
  }
};

const sameFields = (actual: string[], expected: readonly string[]): boolean => {
  return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
};

export function inspectScreenshotRuntimeProofParity(project: Project): Finding[] {
  const findings: Finding[] = [];
  const proofRequiredFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES");
  const proofOptionalFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES");
  const resultRequiredFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES");
  const resultOptionalFields = getConstStringArrayValues(project, PATHS.GOVERNANCE, "SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES");
  const schemaSource = getSource(project, PATHS.SCHEMA);
  const proofIdentityProperties = getZodObjectPropertyNames(schemaSource, "ScreenshotRuntimeProofIdentitySchema");
  const capturePolicyProperties = getZodObjectPropertyNames(schemaSource, "ScreenshotCapturePolicySchema");
  const refinementsSource = getSource(project, PATHS.SCHEMA_REFINEMENTS ?? "src/capabilities/screenshot/screenshot-schema-refinements.ts");
  const runtimeProofChain = getFunctionLike(refinementsSource, "validateScreenshotRuntimeProofChain");
  const resultChain = getFunctionLike(refinementsSource, "validateResultChainFields");

  if (!sameFields(proofRequiredFields, EXPECTED_PROOF_REQUIRED_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot governance must keep videoVisitId out of runtimeProof required chain fields." }));
  }

  if (!sameFields(proofOptionalFields, EXPECTED_PROOF_OPTIONAL_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot governance must keep roundId/videoVisitId inside optional runtimeProof chain fields." }));
  }

  if (!sameFields(resultRequiredFields, EXPECTED_PROOF_REQUIRED_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot result required chain fields must match runtimeProof required chain fields." }));
  }

  if (!sameFields(resultOptionalFields, EXPECTED_RESULT_OPTIONAL_FIELDS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot result optional chain fields must keep roundId, videoVisitId, and diagnosticPayloadRef nullable." }));
  }

  if (!proofIdentityProperties.has("videoVisitId") || !capturePolicyProperties.has("allowMissingVideoVisitId")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema must declare nullable videoVisitId and allowMissingVideoVisitId policy together." }));
  }

  const runtimeProofIdentifiers = runtimeProofChain?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? [];
  if (!runtimeProofIdentifiers.includes("SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES") || runtimeProofIdentifiers.includes("SCREENSHOT_PROOF_CHAIN_FIELD_NAMES")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: "src/capabilities/screenshot/screenshot-schema-refinements.ts", line: 1, severity: "fatal", message: "Screenshot runtimeProof refine must require only the governed required chain fields, not nullable videoVisitId." }));
  }

  const resultChainIdentifiers = resultChain?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? [];
  if (!resultChainIdentifiers.includes("SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES") || !resultChainIdentifiers.includes("SCREENSHOT_RESULT_CHAIN_FIELD_NAMES")) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: "src/capabilities/screenshot/screenshot-schema-refinements.ts", line: 1, severity: "fatal", message: "Screenshot result refine must separate required chain fields from nullable parity-only fields." }));
  }

  return findings;
}