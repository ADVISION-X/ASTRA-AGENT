import { createHash } from "node:crypto";

export const TEXT_INPUT_ABILITY_GROUP_ID = "text-input" as const;

export const TEXT_INPUT_CHILD_CAPABILITY_IDS = [
  "type-approved-text-once",
  "press-approved-key-once",
  "clear-focused-input-once",
] as const;

export type TextInputChildCapabilityId =
  (typeof TEXT_INPUT_CHILD_CAPABILITY_IDS)[number];

/** Approved keys that press-approved-key-once may accept. */
export const TEXT_INPUT_APPROVED_KEY_ALLOWLIST = [
  "Enter",
  "Tab",
  "Escape",
  "Backspace",
  "Delete",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
] as const;

export type ApprovedKey = (typeof TEXT_INPUT_APPROVED_KEY_ALLOWLIST)[number];

export function buildTextInputRef(
  prefix: string,
  parts: readonly unknown[],
): string {
  const hash = createHash("sha1")
    .update(JSON.stringify(parts.map((p) => (p === undefined ? null : p))))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}:${hash}`;
}

export function hashApprovedText(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
