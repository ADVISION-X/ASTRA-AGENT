export type AuthenticatedMediaValue = Readonly<{
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

export const parseAuthenticatedMediaValue = (value: unknown): AuthenticatedMediaValue => {
  if (!record(value) || !bytesValid(value) || !dimensionsValid(value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return value as AuthenticatedMediaValue;
};
