export type AuthenticatedMediaValue = Readonly<{
  authorityTargetHash: `sha256:${string}`;
  authorityDocumentHash: `sha256:${string}`;
  assistantTurnId: string;
  semanticMediaId: "gpt-generated-image-main";
  bytesBase64: string;
  sha256: `sha256:${string}`;
  sizeBytes: number;
  mediaType: `image/${string}`;
  width: number;
  height: number;
}>;

const record = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bytesValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.bytesBase64 === "string"
  && typeof value.sha256 === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.sha256)
  && typeof value.sizeBytes === "number"
  && Number.isSafeInteger(value.sizeBytes)
  && value.sizeBytes >= 1
  && value.sizeBytes <= 25 * 1024 * 1024;

const dimensionsValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.mediaType === "string"
  && /^image\/[a-z0-9.+-]+$/u.test(value.mediaType)
  && typeof value.width === "number"
  && Number.isSafeInteger(value.width)
  && value.width >= 1
  && typeof value.height === "number"
  && Number.isSafeInteger(value.height)
  && value.height >= 1;

const authorityValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.authorityTargetHash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.authorityTargetHash)
  && typeof value.authorityDocumentHash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.authorityDocumentHash)
  && typeof value.assistantTurnId === "string"
  && /^conversation-turn-[1-9][0-9]*$/u.test(value.assistantTurnId)
  && value.semanticMediaId === "gpt-generated-image-main";

export const parseAuthenticatedMediaValue = (value: unknown): AuthenticatedMediaValue => {
  if (!record(value) || !authorityValid(value) || !bytesValid(value) || !dimensionsValid(value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return value as AuthenticatedMediaValue;
};
