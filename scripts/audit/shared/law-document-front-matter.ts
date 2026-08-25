import { parseDocument } from "yaml";

import { exactKeys } from "../governance-json.js";
import { fail } from "../governance-runtime.js";

const keys = ["authorityLevel", "containerOwner", "documentType", "lawIdPrefix", "schemaVersion", "status"];

const valuesValid = (
  value: Record<string, unknown>,
  documentType: "base-law" | "functional-law",
  authorityLevel: 100 | 90,
): boolean => value.documentType === documentType && value.schemaVersion === 2
  && value.status === "active" && value.authorityLevel === authorityLevel
  && value.containerOwner === "law-system" && value.lawIdPrefix === "LAW";

export const lawBodyStart = (
  source: string,
  path: string,
  documentType: "base-law" | "functional-law",
  authorityLevel: 100 | 90,
): number => {
  if (path !== path.normalize("NFC") || source !== source.normalize("NFC")
    || source.includes("\r") || !source.startsWith("---\n")) fail("SOURCE_PARSE_FAILED", `${path}:encoding`);
  const close = source.indexOf("\n---\n", 4);
  if (close < 0 || source.indexOf("\n---\n", close + 5) >= 0) fail("SOURCE_PARSE_FAILED", `${path}:front-matter`);
  const document = parseDocument(source.slice(4, close), { strict: true, uniqueKeys: true });
  if (document.errors.length || document.warnings.length) fail("SOURCE_PARSE_FAILED", `${path}:front-matter`);
  const value = document.toJS() as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, keys) || !valuesValid(value, documentType, authorityLevel)) {
    fail("SOURCE_PARSE_FAILED", `${path}:front-matter`);
  }
  return source.slice(0, close + 5).split("\n").length - 1;
};
