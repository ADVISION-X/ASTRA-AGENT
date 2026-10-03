import { createHash } from "node:crypto";
import { withRuntimeLogCause, type RuntimeLogger } from "../../runtime-logs/index.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { completeBrowserCommandSpan, emitBrowserMutationEvent, failBrowserCommandSpan, startBrowserCommandSpan } from "./browser-command-runtime-logging.js";
import type { BrowserMutationStore } from "./browser-mutation-store.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";

export type BrowserCommandExecutionState = { budgetEntered: boolean; prepared: boolean; dispatched: boolean; terminalized: boolean };
export type AuthenticatedTerminalReplyFailure = Readonly<{ failureCode: string; permitSequence: number; replyChannelToken: string; transportSequence: number }>;
export const hashBrowserCommandValue = (value: unknown): `sha256:${string}` => {
  try { return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }
  catch { return `sha256:${createHash("sha256").update("unserializable").digest("hex")}`; }
};
const causalBrowserFailureCode = (error: unknown): string => error instanceof Error && /^BROWSER_[A-Z0-9_]+$/u.test(error.message)
  ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
type FailureInput = Readonly<{ command: BrowserGovernedCommand; commandSpan: ReturnType<typeof startBrowserCommandSpan>; error: unknown;
  mutation: boolean; mutations: BrowserMutationStore; permit: BrowserCommandPermit; runtimeLogger: RuntimeLogger;
  state: BrowserCommandExecutionState; terminalReply: AuthenticatedTerminalReplyFailure | null }>;
const checkpointMissingIsObservation = (input: FailureInput, code: string): boolean => {
  if (input.mutation) return false;
  if (input.permit.childCapabilityId === "checkpoint_gpt_text_response") return ["BROWSER_EXACT_USER_TURN_UNAVAILABLE", "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING"].includes(code);
  return input.permit.childCapabilityId === "checkpoint_gpt_generated_image"
    && ["BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT", "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT"].includes(code);
};
const recordUnsettledMutation = (input: FailureInput, code: string): void => {
  if (!input.mutation || !input.state.prepared) return;
  if (input.state.dispatched) { input.mutations.markReceiptMissing(input.permit.commandId); return; }
  input.mutations.markFailedBeforeDispatch(input.permit.commandId, code);
  emitBrowserMutationEvent({ runtimeLogger: input.runtimeLogger, mutation: input.permit, outcome: "FAILED", authorityHash: input.mutations.authorityHash(input.permit.commandId) });
};
const authenticatedReceiptError = (input: FailureInput, code: string, row: ReturnType<BrowserMutationStore["readCommand"]>): unknown => {
  if (row?.state !== "REJECTED" || !input.terminalReply) return input.error;
  const fact = input.mutations.readExactCallMutationFact({ jobId: input.permit.jobId, attemptId: input.permit.attemptId,
    exactCallIdentityHash: row.identity.exactCallIdentityHash, actionOrdinal: input.permit.actionOrdinal });
  if (fact?.authorityRef !== `browser-mutation:${input.permit.commandId}` || fact.outcome !== "REJECTED" || fact.failureCode !== code || !fact.nativeFailureCode) return input.error;
  return new Error(code, { cause: Object.assign(new Error(fact.nativeFailureCode), { code: fact.nativeFailureCode }) });
};
export const failBrowserCommandExecution = (input: FailureInput): never => {
  if (input.state.terminalized) throw input.error;
  const code = causalBrowserFailureCode(input.error);
  if (checkpointMissingIsObservation(input, code)) { completeBrowserCommandSpan({ span: input.commandSpan }); input.state.terminalized = true; throw input.error; }
  const row = input.mutation && input.state.prepared ? input.mutations.readCommand(input.permit.commandId) : null;
  const settled = row?.state === "CONFIRMED" || row?.state === "REJECTED";
  const failureCode = settled ? input.terminalReply?.failureCode ?? code : input.mutation && input.state.dispatched ? "BROWSER_COMMAND_RECEIPT_MISSING" : code;
  if (!settled) recordUnsettledMutation(input, failureCode);
  if (!input.runtimeLogger.isWritable()) throw input.error;
  const error = authenticatedReceiptError(input, failureCode, row);
  const event = failBrowserCommandSpan({ span: input.commandSpan, permit: input.permit,
    proofHash: input.mutation && input.state.prepared ? input.mutations.authorityHash(input.permit.commandId) : hashBrowserCommandValue(failureCode), failureCode, error });
  input.state.terminalized = true;
  throw withRuntimeLogCause(new Error(failureCode, { cause: error }), event.eventId);
};
