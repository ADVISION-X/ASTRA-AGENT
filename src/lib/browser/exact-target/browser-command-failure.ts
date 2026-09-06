import { createHash } from "node:crypto";
import { withRuntimeLogCause, type RuntimeLogger } from "../../runtime-logs/index.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import {
  emitBrowserMutationEvent,
  failBrowserCommandSpan,
  startBrowserCommandSpan,
} from "./browser-command-runtime-logging.js";
import type { BrowserMutationStore } from "./browser-mutation-store.js";

export type BrowserCommandExecutionState = {
  authenticatedReplyHash: `sha256:${string}` | null;
  budgetEntered: boolean;
  prepared: boolean;
  dispatched: boolean;
  terminalized: boolean;
};

export type AuthenticatedTerminalReplyFailure = Readonly<{
  failureCode: string;
  permitSequence: number;
  replyChannelToken: string;
  transportSequence: number;
}>;

export const hashBrowserCommandValue = (value: unknown): `sha256:${string}` => {
  try {
    return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
  } catch {
    return `sha256:${createHash("sha256").update("unserializable").digest("hex")}`;
  }
};

const causalBrowserFailureCode = (error: unknown): string =>
  error instanceof Error && /^BROWSER_[A-Z0-9_]+$/u.test(error.message)
    ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";

type FailureInput = Readonly<{
  commandSpan: ReturnType<typeof startBrowserCommandSpan>;
  error: unknown;
  mutation: boolean;
  mutations: BrowserMutationStore;
  permit: BrowserCommandPermit;
  runtimeLogger: RuntimeLogger;
  state: BrowserCommandExecutionState;
  terminalReply: AuthenticatedTerminalReplyFailure | null;
}>;

const emitRejected = (input: FailureInput, failureCode: string): never => {
  emitBrowserMutationEvent({
    runtimeLogger: input.runtimeLogger, mutation: input.permit, outcome: "REJECTED",
    authorityHash: input.mutations.authorityHash(input.permit.commandId),
  });
  const failureEvent = failBrowserCommandSpan({
    span: input.commandSpan, permit: input.permit,
    proofHash: input.mutations.authorityHash(input.permit.commandId),
    failureCode, error: input.error, pendingReceipt: false,
  });
  input.state.terminalized = true;
  throw withRuntimeLogCause(new Error(failureCode, { cause: input.error }), failureEvent.eventId);
};

const rejectAuthenticatedTerminalReply = (
  input: FailureInput,
  reply: AuthenticatedTerminalReplyFailure,
): never => {
  input.mutations.markRejected(
    input.permit.commandId,
    hashBrowserCommandValue(reply),
    "dispatched",
    reply.failureCode,
  );
  return emitRejected(input, reply.failureCode);
};

const rejectAuthenticatedResult = (input: FailureInput): never => {
  const code = causalBrowserFailureCode(input.error);
  input.mutations.markRejected(
    input.permit.commandId,
    input.state.authenticatedReplyHash!,
    "dispatched",
    code,
  );
  return emitRejected(input, code);
};

const recordUnsettledMutation = (input: FailureInput, code: string): void => {
  if (!input.mutation || !input.state.prepared) return;
  if (input.state.dispatched) {
    input.mutations.markReceiptMissing(input.permit.commandId);
    return;
  }
  input.mutations.markFailedBeforeDispatch(input.permit.commandId, code);
  emitBrowserMutationEvent({
    runtimeLogger: input.runtimeLogger, mutation: input.permit, outcome: "FAILED",
    authorityHash: input.mutations.authorityHash(input.permit.commandId),
  });
};

export const failBrowserCommandExecution = (input: FailureInput): never => {
  if (input.state.terminalized) throw input.error;
  if (input.terminalReply !== null) return rejectAuthenticatedTerminalReply(input, input.terminalReply);
  if (input.mutation && input.state.dispatched && input.state.authenticatedReplyHash !== null) {
    return rejectAuthenticatedResult(input);
  }
  const code = input.mutation && input.state.dispatched
    ? "BROWSER_COMMAND_RECEIPT_MISSING" : causalBrowserFailureCode(input.error);
  recordUnsettledMutation(input, code);
  const failureEvent = failBrowserCommandSpan({
    span: input.commandSpan, permit: input.permit,
    proofHash: input.mutation && input.state.prepared
      ? input.mutations.authorityHash(input.permit.commandId) : hashBrowserCommandValue(code),
    failureCode: code, error: input.error,
    pendingReceipt: input.mutation && input.state.dispatched,
  });
  throw withRuntimeLogCause(new Error(code, { cause: input.error }), failureEvent.eventId);
};
