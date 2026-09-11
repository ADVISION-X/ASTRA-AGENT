import { createHash } from "node:crypto";

import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";
import type {
  BrowserDomObservationPacketV2,
  BrowserDomObservationQuery,
} from "./browser-dom-intent.js";

const hashValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const browserExactCallIdentityHash = (
  permit: BrowserCommandPermit,
): `sha256:${string}` => hashValue([
  permit.jobId,
  ...(permit.replayPolicy === "provider-effect-once" ? [] : [permit.attemptId, permit.writerFenceHash]),
  permit.ownerPluginId, permit.pluginVersion, permit.productStepId,
  permit.callId, permit.childCapabilityId, permit.inputHash,
]);

export const browserProviderEffectIdentityHash = (
  permit: BrowserCommandPermit,
  payloadHash: `sha256:${string}`,
): `sha256:${string}` => hashValue([
  permit.jobId,
  permit.ownerPluginId,
  permit.pluginVersion,
  permit.productStepId,
  permit.callId,
  permit.childCapabilityId,
  permit.inputHash,
  payloadHash,
]);

const observationHeaderValid = (
  value: Record<string, unknown>,
  permit: BrowserCommandPermit,
): boolean => {
  const keys = Object.keys(value);
  const observedAt = value.observedAt;
  return keys.length === 7 && ["schemaVersion", "targetRefHash", "documentRefHash", "currentUrl",
    "observationRevisionHash", "observedAt", "queries"].every((key) => keys.includes(key))
    && value.schemaVersion === "grasseye.browser.dom-observation.v2"
    && value.targetRefHash === hashText(permit.targetRef)
    && value.documentRefHash === hashText(permit.documentRef)
    && typeof value.currentUrl === "string" && value.currentUrl.length > 0
    && typeof observedAt === "string" && !Number.isNaN(Date.parse(observedAt))
    && new Date(observedAt).toISOString() === observedAt;
};

const observationQueriesValid = (
  value: unknown,
  specs: readonly BrowserDomObservationQuery[],
): value is readonly Record<string, unknown>[] => Array.isArray(value) && value.length === specs.length
  && value.every((query, index) => !!query && typeof query === "object" && !Array.isArray(query)
    && (query as Record<string, unknown>).queryId === specs[index]?.queryId);

const bindOneObservationPacket = (
  permit: BrowserCommandPermit,
  result: unknown,
  specs: readonly BrowserDomObservationQuery[],
): BrowserDomObservationPacketV2 => {
  try {
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    const value = result as Record<string, unknown>;
    const queries = value.queries;
    const observedAt = value.observedAt;
    if (!observationHeaderValid(value, permit) || !observationQueriesValid(queries, specs)
      || typeof observedAt !== "string") throw new Error();
    const expectedRevision = hashText(canonicalizeBrowserAuthorityValue({
      targetRefHash: value.targetRefHash, documentRefHash: value.documentRefHash,
      currentUrl: value.currentUrl, observedAt, queries,
    }));
    if (value.observationRevisionHash !== expectedRevision) throw new Error();
    return Object.freeze({
      ...value,
      exactCallIdentityHash: browserExactCallIdentityHash(permit),
    }) as BrowserDomObservationPacketV2;
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const assertClickedAttributeReadback = (
  value: Record<string, unknown>,
  clickedAttribute: Readonly<{ name: string; equals: string }> | undefined,
): void => {
  if (clickedAttribute === undefined) return;
  const readback = value.clickedCandidateAttributeReadback;
  if (!readback || typeof readback !== "object" || Array.isArray(readback)) throw new Error();
  const typed = readback as Record<string, unknown>;
  const verified = typed.name === clickedAttribute.name
    && typed.value === clickedAttribute.equals && typed.verified === true;
  if (Object.keys(typed).sort().join("|") !== "name|value|verified"
    || typed.name !== clickedAttribute.name
    || typeof typed.value !== "string"
    || typed.verified !== (typed.value === clickedAttribute.equals)
    || (value.postconditionVerified === true && !verified)) throw new Error();
};

export const bindBrowserCommandObservationPacket = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
  result: unknown,
): unknown => {
  if (command.kind !== "dom-intent") return result;
  if (command.intent.kind === "observe") {
    return bindOneObservationPacket(permit, result, command.intent.queries);
  }
  if (command.intent.kind !== "click" || command.intent.postClickObservation === undefined) return result;
  try {
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    const value = result as Record<string, unknown>;
    if (value.qualificationRejected === true && value.postconditionObservation === undefined) {
      return result;
    }
    assertClickedAttributeReadback(
      value, command.intent.postClickObservation.clickedCandidateAttribute,
    );
    const specs = command.intent.postClickObservation.queries
      .map(({ expectedEligibleCount: _expected, ...query }) => query);
    return Object.freeze({
      ...value,
      postconditionObservation: bindOneObservationPacket(
        permit, value.postconditionObservation, specs,
      ),
    });
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};

const BROWSER_TERMINAL_REPLY_MARGIN_MS = 4_000;

const declaredPostconditionTimeoutMs = (command: BrowserGovernedCommand): number | null => {
  if (command.kind === "authenticated-media" && command.delivery === "visible-download") return 20_000;
  if (command.kind !== "dom-intent") return null;
  const intent = command.intent;
  if (intent.kind === "click") return intent.postClickAttribute?.timeoutMs
    ?? intent.postClickMatch?.timeoutMs ?? intent.postClickObservation?.timeoutMs
    ?? intent.postClickUrl?.timeoutMs ?? intent.postClickTargetTransition?.timeoutMs ?? 1;
  if (intent.kind === "hover") return intent.postHoverAttribute.timeoutMs ?? 1;
  if (intent.kind === "doubleClick") return intent.postDoubleClickMatch.timeoutMs ?? 1;
  if (intent.kind === "keypress") return intent.postKeypressMatch.timeoutMs ?? 1;
  return null;
};

export const assertBrowserCommandTerminalReplyMargin = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
): void => {
  const postconditionTimeoutMs = declaredPostconditionTimeoutMs(command);
  if (postconditionTimeoutMs !== null
    && permit.commandTtlMs < postconditionTimeoutMs + BROWSER_TERMINAL_REPLY_MARGIN_MS) {
    throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
  }
};
