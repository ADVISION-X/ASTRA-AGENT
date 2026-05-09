import { payloadValueToString, type payloadDocumentToObject } from "./workbench-payload.js";

type JsonRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readString = (value: JsonRecord | null | undefined, key: string): string | null => {
  if (!value) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

export const readNumber = (value: JsonRecord | null | undefined, key: string): number | null => {
  if (!value) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
};

export const requireString = (value: string | null | undefined, label: string): string => {
  if (!value) {
    throw new Error(`Workbench forensics dispatch is missing ${label}.`);
  }
  return value;
};

export const requirePositiveInt = (value: number | null | undefined, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Workbench forensics dispatch is missing valid ${label}.`);
  }
  return value;
};

export const resolvePayloadString = (
  payload: ReturnType<typeof payloadDocumentToObject>,
  key: string,
): string | null => payloadValueToString(payload[key]);