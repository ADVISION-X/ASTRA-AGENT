import { SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

const getFirstCallPosition = (
  sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>,
  callName: string,
): number => {
  const match = sourceTextOwner
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((callExpression) => callExpression.getExpression().getText() === callName);
  return match?.getStart() ?? -1;
};

export function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  if (!executorSource) {
    return [createFinding({ lawId: LAW_IDS.PIPELINE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Nerve Bus executor file is missing." })];
  }

  const findings: Finding[] = [];
  for (const callee of [
    "enforceEnvelopeInputGate",
    "enforceChannelPolicyGate",
    "enforceEnvelopeIntegrityGate",
    "enforceTransportIdempotencyGate",
    "resolveTransportTimeoutGate",
    "enforceTransportSequencePolicy",
    "enforceTransportResultSemanticGate",
    "buildTransportProof",
    "buildSuccessTransportResult",
  ]) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Nerve Bus executor must call ${callee}.` }));
    }
  }

  const bindInputPayloadPosition = getFirstCallPosition(executorSource, "input.context.transport.bindInputPayload");
  const postReservationPosition = getFirstCallPosition(executorSource, "resolvePostReservationFailure");
  if (bindInputPayloadPosition !== -1 && postReservationPosition !== -1 && bindInputPayloadPosition < postReservationPosition) {
    findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Nerve Bus must bind input payload only after post-idempotency gates pass." }));
  }

  return findings;
}