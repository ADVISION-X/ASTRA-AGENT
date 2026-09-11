import { canonicalizeBrowserAuthorityValue } from "../transport/browser-authority-frame-codec.js";

export type BrowserExactAssistantTurnRevisionInput = Readonly<{
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  assistantTurnId: string;
  currentUrl: string;
  precedingUserTurnId: string;
  precedingPromptHash: `sha256:${string}`;
  generatingRaw: number;
  rawDomHash: `sha256:${string}`;
  semanticTextHash: `sha256:${string}`;
  observedAt: string;
}>;

export const canonicalBrowserExactAssistantTurnRevision = (
  input: BrowserExactAssistantTurnRevisionInput,
): string => canonicalizeBrowserAuthorityValue({
    targetRefHash: input.targetRefHash,
    documentRefHash: input.documentRefHash,
    assistantTurnId: input.assistantTurnId,
    currentUrl: input.currentUrl,
    precedingUserTurnId: input.precedingUserTurnId,
    precedingPromptHash: input.precedingPromptHash,
    generatingRaw: input.generatingRaw,
    rawDomHash: input.rawDomHash,
    semanticTextHash: input.semanticTextHash,
    observedAt: input.observedAt,
  });
