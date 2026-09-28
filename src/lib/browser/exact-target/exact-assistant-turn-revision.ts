import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";

export type BrowserExactAssistantTurnRevisionInput = Readonly<{
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  assistantTurnId: string;
  currentUrl: string;
  turnMarkerHash: `sha256:${string}`;
  precedingUserTurnId: string;
  generatingRaw: number;
  rawDomHash: `sha256:${string}`;
  semanticTextHash: `sha256:${string}`;
  observedAt: string;
}>;

export const canonicalBrowserExactAssistantTurnRevision = (
  input: BrowserExactAssistantTurnRevisionInput,
  pendingCause: "exact-user-turn-unavailable" | "adjacent-assistant-missing" | null = null,
): string => canonicalizeBrowserAuthorityValue({
    targetRefHash: input.targetRefHash,
    documentRefHash: input.documentRefHash,
    assistantTurnId: input.assistantTurnId,
    currentUrl: input.currentUrl,
    turnMarkerHash: input.turnMarkerHash,
    precedingUserTurnId: input.precedingUserTurnId,
    generatingRaw: input.generatingRaw,
    rawDomHash: input.rawDomHash,
    semanticTextHash: input.semanticTextHash,
    observedAt: input.observedAt,
    ...(pendingCause === null ? {} : { pendingCause }),
  });
