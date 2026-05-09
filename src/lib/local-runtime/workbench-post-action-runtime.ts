import { createPostActionVerificationAbilityGroup } from "../../capabilities/post-action-verification/index.js";

export const createPostActionRuntime = () => ({
  postActionVerificationAbilityGroup: createPostActionVerificationAbilityGroup({
    clock: {
      portKind: "post-action-verification-clock",
      now: () => ({
        isoTimestamp: new Date().toISOString(),
        monotonicMs: typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now(),
      }),
    },
    evidenceReadPort: {
      listObservations: (request) => request.observationSet.observations,
      getObservationByRef: (request, ref) => request.observationSet.observations.find((observation) => observation.ref === ref) ?? null,
      getEvidenceByRef: (request, ref) => [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].find((evidence) => evidence?.evidenceRef === ref) ?? null,
      getActionLogByRef: (request, ref) => {
        const actionLogRef = request.actionProof.actionLogRef ?? request.actionProof.actionRecordRef;
        return actionLogRef === ref && request.actionProof.sourceRuntimeProofRef
          ? {
              actionLogRef: ref,
              sourceRuntimeProofRef: request.actionProof.sourceRuntimeProofRef,
              sourceActionResultRef: request.actionProof.sourceActionResultRef,
              sourceActionOutputRef: request.actionProof.sourceActionOutputRef,
            }
          : null;
      },
      verifyProofRef: (request, ref) => request.actionProof.sourceRuntimeProofRef === ref
        || request.observationSet.observations.some((observation) => observation.source.sourceProofRef === ref)
        || [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].some((evidence) => evidence?.sourceProofRef === ref),
      verifyEvidenceBinding: (request, evidenceRef) => [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].some((evidence) => evidence?.evidenceRef === evidenceRef && evidence.sessionId === request.sessionId && evidence.roundId === request.roundId && evidence.videoVisitId === request.videoVisitId),
    },
  }),
});