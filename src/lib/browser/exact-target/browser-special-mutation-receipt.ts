import { knownRateLimitBlockerReceiptValid, unrecognizedGptDialogReceiptValid } from "./browser-observation-receipt.js";
import { createHash } from "node:crypto";

import type { BrowserCommandPermit } from "../transport/command-permit.js";
import {
  knownGptRateLimitPreflightFactShapeValid,
  knownGptRateLimitPreflightObservationInput,
  type KnownGptRateLimitPreflightFact,
} from "./browser-gpt-rate-limit-preflight.js";
import { browserExactCallIdentityHash } from "./browser-command-postcondition.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";

const hashValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const exactKeys = (
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
};

export const knownGptRateLimitPreflightFactValid = (
  value: unknown,
): value is KnownGptRateLimitPreflightFact => {
  if (!knownGptRateLimitPreflightFactShapeValid(value)) return false;
  const { observationHash: _observationHash, ...unsigned } = value;
  return value.observationHash === hashValue(knownGptRateLimitPreflightObservationInput(unsigned));
};

const rateLimitControlIntent = (command: BrowserGovernedCommand): boolean =>
  command.kind === "dom-intent"
  && (command.intent.kind === "acknowledgeKnownGptRateLimit"
    || command.intent.kind === "readKnownGptRateLimitClearance");

export type BrowserPreflightReply = Readonly<{
  commandResult: unknown;
  fact: KnownGptRateLimitPreflightFact | null;
  specialFailureCode: "BROWSER_KNOWN_GPT_RATE_LIMIT" | "BROWSER_GPT_DIALOG_UNRECOGNIZED" | null;
}>;

export const decodeKnownGptRateLimitPreflightReply = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
  value: unknown,
): BrowserPreflightReply => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (rateLimitControlIntent(command)) {
      return Object.freeze({ commandResult: value, fact: null, specialFailureCode: null });
    }
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const record = value as Readonly<Record<string, unknown>>;
  let fact: KnownGptRateLimitPreflightFact;
  let commandResult: unknown;
  let specialFailureCode: BrowserPreflightReply["specialFailureCode"] = null;
  if (knownRateLimitBlockerReceiptValid(record, preflightReceiptObservationHash(record))) {
    fact = record.knownGptRateLimitPreflightFact as KnownGptRateLimitPreflightFact;
    commandResult = value;
    specialFailureCode = "BROWSER_KNOWN_GPT_RATE_LIMIT";
  } else if (unrecognizedGptDialogReceiptValid(record, preflightReceiptObservationHash(record))) {
    fact = record.knownGptRateLimitPreflightFact as KnownGptRateLimitPreflightFact;
    commandResult = value;
    specialFailureCode = "BROWSER_GPT_DIALOG_UNRECOGNIZED";
  } else if (rateLimitControlIntent(command)) {
    return Object.freeze({ commandResult: value, fact: null, specialFailureCode: null });
  } else {
    if (!exactKeys(record, ["schemaVersion", "knownGptRateLimitPreflightFact", "commandResult"])
      || record.schemaVersion !== "grasseye.browser.command-preflight.v1"
      || !knownGptRateLimitPreflightFactValid(record.knownGptRateLimitPreflightFact)) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    fact = record.knownGptRateLimitPreflightFact;
    if (fact.state !== "absent") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    commandResult = record.commandResult;
  }
  if (fact.exactCallIdentityHash !== browserExactCallIdentityHash(permit)
    || fact.targetRefHash !== hashText(permit.targetRef)
    || fact.documentRefHash !== hashText(permit.documentRef)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return Object.freeze({ commandResult, fact, specialFailureCode });
};

export const preflightReceiptObservationHash = (result: unknown): `sha256:${string}` | null => {
  if (!result || typeof result !== "object") return null;
  const fact = (result as Record<string, unknown>).knownGptRateLimitPreflightFact;
  if (!knownGptRateLimitPreflightFactShapeValid(fact)) return null;
  const { observationHash: _hash, ...unsigned } = fact;
  return hashValue(knownGptRateLimitPreflightObservationInput(unsigned));
};
