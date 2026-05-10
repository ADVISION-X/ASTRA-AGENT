import { Node } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

const PROOF_FIELDS = [
  "missionId",
  "runId",
  "stepId",
  "capabilityCallId",
  "promptContractId",
  "outputSchemaRef",
  "status",
  "outputRef",
  "semanticDecision",
  "handlerCallId",
  "sequenceDecision",
  "queueDecision",
] as const;

const getPropertyNames = (sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>): Set<string> => {
  return new Set(
    sourceTextOwner.getDescendants().flatMap((node) => {
      if (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) {
        return [node.getName()];
      }
      return [];
    }),
  );
};

const sourceHasProperties = (sourceTextOwner: ReturnType<typeof getSourceFile>, propertyNames: readonly string[]): boolean => {
  if (!sourceTextOwner) {
    return false;
  }

  const names = getPropertyNames(sourceTextOwner);
  return propertyNames.every((propertyName) => names.has(propertyName));
};

const sourceTextIncludesAll = (sourceTextOwner: ReturnType<typeof getSourceFile>, tokens: readonly string[]): boolean => {
  if (!sourceTextOwner) {
    return false;
  }

  const text = sourceTextOwner.getFullText();
  return tokens.every((token) => text.includes(token));
};

function collectProofBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  return !proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["NerveBusTransportProofSchema", "parse"]) || !sourceHasProperties(proofBuilderSource, PROOF_FIELDS)
    ? [createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Nerve Bus proof builder must parse and preserve governed short-chain proof fields." })]
    : [];
}

function hasFailureEnvelopeResultParsers(sourceTextOwner: ReturnType<typeof getSourceFile>): boolean {
  if (!sourceTextOwner) {
    return false;
  }

  return hasCallExpressionPath(sourceTextOwner, ["AbilityResultEnvelopeSchema", "parse"])
    && hasCallExpressionPath(sourceTextOwner, ["AiResponseEnvelopeSchema", "parse"])
    && hasCallExpressionPath(sourceTextOwner, ["HumanCommandResultEnvelopeSchema", "parse"]);
}

function hasFailureTransportResultParsers(sourceTextOwner: ReturnType<typeof getSourceFile>): boolean {
  if (!sourceTextOwner) {
    return false;
  }

  return hasCallExpressionPath(sourceTextOwner, ["AbilityTransportResultSchema", "parse"])
    && hasCallExpressionPath(sourceTextOwner, ["AiTransportResultSchema", "parse"])
    && hasCallExpressionPath(sourceTextOwner, ["HumanCommandTransportResultSchema", "parse"])
    && hasCallExpressionPath(sourceTextOwner, ["NerveBusMirroredTransportResultSchema", "parse"]);
}

function collectResultBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const resultFailureEnvelopeSource = getSourceFile(project, PATHS.RESULT_FAILURE_ENVELOPE);
  const resultFailureResultSource = getSourceFile(project, PATHS.RESULT_FAILURE_RESULT);
  return !hasFailureEnvelopeResultParsers(resultFailureEnvelopeSource) || !hasFailureTransportResultParsers(resultFailureResultSource)
    ? [createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Nerve Bus result builder must parse governed forward and mirrored transport results." })]
    : [];
}

function collectSemanticGateBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const semanticGateSource = getSourceFile(project, PATHS.SEMANTIC_GATE);
  return !semanticGateSource || !sourceTextIncludesAll(semanticGateSource, ["correlationEnvelopeId", "correlationCapabilityCallId", "proofRef"])
    ? [createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.SEMANTIC_GATE, line: 1, severity: "fatal", message: "Nerve Bus semantic gate must enforce correlation/proof parity." })]
    : [];
}

export function collectBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [
    ...collectProofBuilderFindings(project),
    ...collectResultBuilderFindings(project),
    ...collectSemanticGateBuilderFindings(project),
  ];
}