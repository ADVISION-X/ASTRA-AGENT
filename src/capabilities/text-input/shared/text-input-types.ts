import { createHash } from "node:crypto";

export const TEXT_INPUT_ABILITY_GROUP_ID = "text-input" as const;

export const TEXT_INPUT_CHILD_CAPABILITY_IDS = [
  "type-text",
  "paste-text",
  "clear-input",
  "replace-input",
  "press-key",
  "commit-input",
] as const;

export const TEXT_INPUT_TARGET_KINDS = [
  "textField",
  "searchField",
  "commentComposer",
  "editableArea",
] as const;

export const TEXT_INPUT_KEYS = [
  "Tab",
  "Escape",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const;

export const TEXT_INPUT_COMMIT_KEYS = ["Enter"] as const;

export function buildStableTextInputRef(prefix: string, value: unknown): string {
  const serialized = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();

  return `${prefix}:${createHash("sha256").update(serialized).digest("hex").slice(0, 18)}`;
}

export function hashTextValue(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}