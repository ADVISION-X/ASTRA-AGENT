import { createHash } from "node:crypto";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import type { BrowserGovernedCommand } from "./browser-command-actor.js";
import type { BrowserDomIntent, BrowserExactAssistantTurnReplyV4 } from "./browser-dom-intent.js";
import { canonicalBrowserExactAssistantTurnRevision } from "./exact-assistant-turn-revision.js";
import { browserExactCallIdentityHash } from "./browser-command-postcondition.js";

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const exactAssistantTurnIdentityValid = (
  value: Readonly<Record<string, unknown>>,
  permit: BrowserCommandPermit,
  intent: Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
): boolean => {
  const keys = Object.keys(value);
  const negative = value.pendingCause === "exact-user-turn-unavailable"
    || value.pendingCause === "adjacent-assistant-missing";
  const exactKeys = keys.length === (negative ? 14 : 13) && ["schemaVersion", "targetRefHash", "documentRefHash",
    "observationRevisionHash", "assistantTurnId", "currentUrl", "precedingUserTurnId",
    "generatingRaw", "rawDomHtml", "rawDomHash", "semanticText", "semanticTextHash", "observedAt",
  ].every((key) => keys.includes(key));
  return [exactKeys, value.schemaVersion === "grasseye.browser.exact-assistant-turn.v4",
    value.targetRefHash === hashText(permit.targetRef), value.documentRefHash === hashText(permit.documentRef),
    typeof value.observationRevisionHash === "string",
    /^sha256:[a-f0-9]{64}$/u.test(String(value.observationRevisionHash)),
    typeof value.assistantTurnId === "string",
    negative || /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(String(value.assistantTurnId)),
    value.currentUrl === intent.canonicalConversationUrl,
    typeof value.precedingUserTurnId === "string",
    value.pendingCause === "exact-user-turn-unavailable" ? value.precedingUserTurnId === ""
      : /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(String(value.precedingUserTurnId)),
    !negative || value.rawDomHtml === "" && value.semanticText === "",
  ].every(Boolean);
};

const exactAssistantTurnContentValid = (value: Readonly<Record<string, unknown>>): boolean => {
  const observedAt = value.observedAt;
  return [Number.isSafeInteger(value.generatingRaw), (value.generatingRaw as number) >= 0,
    typeof value.rawDomHtml === "string", hashText(String(value.rawDomHtml)) === value.rawDomHash,
    typeof value.semanticText === "string", hashText(String(value.semanticText)) === value.semanticTextHash,
    typeof observedAt === "string", Number.isFinite(Date.parse(String(observedAt))),
    new Date(String(observedAt)).toISOString() === observedAt].every(Boolean);
};

const exactAssistantTurnValueValid = (
  value: Readonly<Record<string, unknown>>,
  permit: BrowserCommandPermit,
  intent: Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
): boolean => {
  const observedAt = value.observedAt;
  if (!exactAssistantTurnIdentityValid(value, permit, intent)
    || !exactAssistantTurnContentValid(value) || typeof observedAt !== "string") return false;
  return value.observationRevisionHash === hashText(canonicalBrowserExactAssistantTurnRevision({
    targetRefHash: value.targetRefHash as `sha256:${string}`,
    documentRefHash: value.documentRefHash as `sha256:${string}`,
    assistantTurnId: value.assistantTurnId as string, currentUrl: value.currentUrl as string,
    turnMarkerHash: hashText(intent.turnMarker),
    precedingUserTurnId: value.precedingUserTurnId as string, generatingRaw: value.generatingRaw as number,
    rawDomHash: value.rawDomHash as `sha256:${string}`,
    semanticTextHash: value.semanticTextHash as `sha256:${string}`, observedAt,
  }, value.pendingCause === "exact-user-turn-unavailable"
    || value.pendingCause === "adjacent-assistant-missing" ? value.pendingCause : null));
};

export const bindExactAssistantTurnReply = (
  permit: BrowserCommandPermit,
  command: BrowserGovernedCommand,
  result: unknown,
): unknown => {
  if (command.kind !== "dom-intent" || command.intent.kind !== "readExactAssistantTurn") return result;
  try {
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    const value = result as Record<string, unknown>;
    if (!exactAssistantTurnValueValid(value, permit, command.intent)) throw new Error();
    return Object.freeze({ ...value,
      exactCallIdentityHash: browserExactCallIdentityHash(permit) }) as BrowserExactAssistantTurnReplyV4;
  } catch {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
};
