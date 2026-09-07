export type {
  BrowserAtomicStepIdentity,
  BrowserAtomicStepRecovery,
  BrowserTargetLease,
} from "./exact-target/browser-target-lease.js";
export type {
  BrowserExactCallMutationFact,
  BrowserMutationReconciliationScope,
} from "./exact-target/browser-mutation-store.js";
export type {
  BrowserDomIntent,
  BrowserDomObservationField,
  BrowserDomObservationPacketV2,
  BrowserDomObservationQuery,
  BrowserDomPostconditionQuery,
  BrowserExactAssistantTurnReplyV2,
} from "./exact-target/browser-dom-intent.js";
export type { BrowserFileArtifactGrantV1 } from "./exact-target/browser-file-artifact-grant.js";
export type {
  BrowserExecutionBinding,
  BrowserConfirmedProviderSourceReadbackAuthorization,
  BrowserConfirmedProviderReadbackAuthorization,
  BrowserExecutionArtifact,
  BrowserExecutionArtifactBinding,
  BrowserExecutionArtifactLease,
} from "./infrastructure/browser-authority-broker.js";
export { BrowserAuthorityBroker } from "./infrastructure/browser-authority-broker.js";
export { confirmedSourceReadbackDocumentMatches } from
  "./infrastructure/browser-confirmed-readback-source.js";
export {
  browserExecutionFailure,
  typedBrowserExecutionFailure,
} from "./browser-failure.js";
export type {
  BrowserEffectFailureFacts,
  MutationOutcome,
} from "./browser-failure.js";
