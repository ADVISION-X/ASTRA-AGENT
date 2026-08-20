import { assertExtensionCommandPermit, type ExtensionCommandPermit } from "./command-permit-validator.js";

export type ExtensionCommandKind = "navigate" | "dom-intent" | "observe" | "screenshot" | "file-input" | "wait" | "close-target";

export const EXTENSION_COMMAND_REGISTRY = new Set<ExtensionCommandKind>([
  "navigate", "dom-intent", "observe", "screenshot", "file-input", "wait", "close-target",
]);

export function assertExtensionCommand(kind: string): asserts kind is ExtensionCommandKind {
  if (!EXTENSION_COMMAND_REGISTRY.has(kind as ExtensionCommandKind)) throw new Error("BROWSER_CAPABILITY_REJECTED");
}

export const admitExtensionCommand = async (input: Readonly<{ kind: string; permit: ExtensionCommandPermit }>): Promise<void> => {
  assertExtensionCommand(input.kind);
  await assertExtensionCommandPermit(input.permit);
};
