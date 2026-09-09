import type { BrowserMutationReceipt } from "./browser-mutation-receipt.js";

const AUTHENTICATED_MEDIA_FAILURE_CAUSE =
  /^(?:BROWSER_DOM_[A-Z_]+|BROWSER_AUTHENTICATED_MEDIA_[A-Z_]+|BROWSER_DOWNLOAD_[A-Z_]+|BROWSER_EXTENSION_CHANNEL_UNAVAILABLE)$/u;

const exactKeys = (
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
};

const authenticatedMediaSuccessValid = (value: Readonly<Record<string, unknown>>): boolean =>
  exactKeys(value, ["authorityTargetHash", "authorityDocumentHash", "assistantTurnId", "semanticMediaId",
    "bytesBase64", "sha256", "sizeBytes", "mediaType", "width", "height", "imageOpened",
    "saveClicked", "candidateCount", "identityRevalidated", "mutationCount", "postconditionVerified",
    "downloadGuidHash", "downloadCompleted", "downloadedSizeBytes"])
  && value.imageOpened === true && value.saveClicked === true
  && value.candidateCount === 1 && value.identityRevalidated === true
  && value.mutationCount === 2 && value.postconditionVerified === true
  && typeof value.downloadGuidHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(value.downloadGuidHash)
  && value.downloadCompleted === true && value.downloadedSizeBytes === value.sizeBytes
  && typeof value.authorityTargetHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(value.authorityTargetHash)
  && typeof value.authorityDocumentHash === "string" && /^sha256:[a-f0-9]{64}$/u.test(value.authorityDocumentHash)
  && typeof value.assistantTurnId === "string" && /^conversation-turn-[1-9][0-9]*$/u.test(value.assistantTurnId)
  && value.semanticMediaId === "gpt-generated-image-main"
  && typeof value.bytesBase64 === "string" && value.bytesBase64.length > 0
  && typeof value.sha256 === "string" && /^sha256:[a-f0-9]{64}$/u.test(value.sha256)
  && Number.isSafeInteger(value.sizeBytes) && (value.sizeBytes as number) >= 1
  && (value.sizeBytes as number) <= 25 * 1024 * 1024
  && typeof value.mediaType === "string" && /^image\/[a-z0-9.+-]+$/u.test(value.mediaType)
  && Number.isSafeInteger(value.width) && (value.width as number) >= 1
  && Number.isSafeInteger(value.height) && (value.height as number) >= 1;

const authenticatedMediaFailureValid = (value: Readonly<Record<string, unknown>>): boolean =>
  exactKeys(value, ["imageOpened", "saveClicked", "candidateCount", "identityRevalidated",
    "mutationCount", "postconditionVerified", "downloadGuidHash", "downloadCompleted",
    "downloadedSizeBytes", "failureCode", "nativeCauseCode"])
  && value.imageOpened === true
  && typeof value.saveClicked === "boolean"
  && Number.isSafeInteger(value.candidateCount) && (value.candidateCount as number) >= 0
  && value.identityRevalidated === false
  && (value.mutationCount === 1 || value.mutationCount === 2)
  && value.saveClicked === (value.mutationCount === 2)
  && value.postconditionVerified === false
  && (value.downloadGuidHash === null || (typeof value.downloadGuidHash === "string"
    && /^sha256:[a-f0-9]{64}$/u.test(value.downloadGuidHash)))
  && value.downloadCompleted === false && value.downloadedSizeBytes === 0
  && value.failureCode === "BROWSER_POSTCONDITION_FAILED"
  && typeof value.nativeCauseCode === "string"
  && AUTHENTICATED_MEDIA_FAILURE_CAUSE.test(value.nativeCauseCode);

export const decodeAuthenticatedMediaDispatchedReceipt = (
  value: Readonly<Record<string, unknown>>,
): BrowserMutationReceipt => {
  if (authenticatedMediaSuccessValid(value)) {
    return Object.freeze({ terminal: "confirmed", mutationOutcome: "confirmed",
      failureCode: null, nativeCauseCode: null });
  }
  if (authenticatedMediaFailureValid(value)) {
    return Object.freeze({ terminal: "rejected", mutationOutcome: "confirmed",
      failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: String(value.nativeCauseCode) });
  }
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};
