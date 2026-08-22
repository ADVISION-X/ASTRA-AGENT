import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readBrowserProofJournal,
  type BrowserProofCommandEvent,
  type BrowserProofEnvelope,
} from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const maxAgeMs = 30 * 60 * 1_000;

const currentCommands = (
  envelopes: readonly BrowserProofEnvelope[],
  candidateHash: string,
  nowMs: number,
): readonly BrowserProofCommandEvent[] => envelopes.flatMap(({ event }) => {
  if (event.eventType !== "COMMAND" || event.candidateHash !== candidateHash) return [];
  const age = nowMs - Date.parse(event.recordedAt);
  return age >= 0 && age <= maxAgeMs ? [event] : [];
});

const mutationChain = (
  commands: readonly BrowserProofCommandEvent[],
  intentKind: "click" | "fill",
): readonly BrowserProofCommandEvent[] => {
  for (const prepared of commands.filter((event) =>
    event.phase === "PREPARED" && event.domIntentKind === intentKind)) {
    const chain = commands.filter((event) => event.commandId === prepared.commandId);
    if (chain.map((event) => event.phase).join(",") !== "PREPARED,SEND,UNKNOWN,CONFIRMED") continue;
    if (chain.some((event) => event.targetRef !== prepared.targetRef
      || event.documentRef !== prepared.documentRef
      || event.payloadHash !== prepared.payloadHash
      || event.commandClass !== "mutation")) continue;
    const unknown = chain[2]!;
    const confirmed = chain[3]!;
    if (!unknown.resultHash || !Number.isInteger(unknown.transportSequence)
      || !Number.isInteger(unknown.permitSequence)
      || unknown.resultSummary?.candidateCount !== 1
      || unknown.resultSummary.identityRevalidated !== true
      || unknown.resultSummary.mutationCount !== 1
      || (intentKind === "fill" && unknown.resultSummary.retainedValueVerified !== true)
      || !confirmed.resultHash || confirmed.artifactRefs.length !== 2
      || new Set(confirmed.artifactRefs).size !== 2
      || confirmed.reason !== `owning-plugin:${prepared.ownerPluginId}`) continue;
    return chain;
  }
  throw new Error(`BROWSER_REAL_CHROME_${intentKind.toUpperCase()}_PROOF_MISSING`);
};

export const validateDomExactTargetRealChromeProof = (input: {
  readonly envelopes: readonly BrowserProofEnvelope[];
  readonly candidateHash: string;
  readonly nowMs?: number;
}): Readonly<{ targetRef: string; documentRef: string }> => {
  const commands = currentCommands(input.envelopes, input.candidateHash, input.nowMs ?? Date.now());
  const action = mutationChain(commands, "click")[0]!;
  const observation = commands.find((event) =>
    event.phase === "COMPLETED"
    && (event.domIntentKind === "document" || event.domIntentKind === "inspect")
    && event.targetRef === action.targetRef
    && event.documentRef === action.documentRef
    && Boolean(event.resultHash));
  assert.ok(observation, "exact target/document observation proof is missing");
  return Object.freeze({ targetRef: action.targetRef, documentRef: action.documentRef });
};

export const validateDomAtomicMutationRealChromeJournal = (input: {
  readonly envelopes: readonly BrowserProofEnvelope[];
  readonly candidateHash: string;
  readonly nowMs?: number;
}): Readonly<{ clickCommandId: string; fillCommandId: string }> => {
  const commands = currentCommands(input.envelopes, input.candidateHash, input.nowMs ?? Date.now());
  const click = mutationChain(commands, "click");
  const fill = mutationChain(commands, "fill");
  assert.notEqual(click[0]!.commandId, fill[0]!.commandId);
  return Object.freeze({ clickCommandId: click[0]!.commandId, fillCommandId: fill[0]!.commandId });
};

export const loadCurrentBrowserProofJournal = (): Readonly<{
  candidateHash: `sha256:${string}`;
  envelopes: readonly BrowserProofEnvelope[];
}> => Object.freeze({
  candidateHash: buildStartupSourceFingerprint(root),
  envelopes: readBrowserProofJournal(path.join(
    root,
    ".grasseye-local",
    "browser",
    "proof-events.ndjson",
  )),
});
