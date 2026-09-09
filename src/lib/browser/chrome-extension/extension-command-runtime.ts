import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserMutationProgress } from "../exact-target/browser-mutation-store.js";
import { executeAuthenticatedMedia } from "./authenticated-media-runtime.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { executeExtensionFileInput } from "./extension-file-input-runtime.js";
import { executeBoundedBrowserWait } from "./extension-target-observation.js";

type CommandLifecycle = Readonly<{
  assertCurrent(): void;
  closeTarget(): Promise<void>;
  navigate(url: string): Promise<Record<string, unknown>>;
  parkTarget(): Promise<void>;
  onMutationProgress(progress: BrowserMutationProgress): Promise<void>;
}>;

export const executeRegisteredExtensionCommand = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  command: Exclude<BrowserGovernedCommand, { kind: "dom-intent" }>,
  lifecycle: CommandLifecycle,
): Promise<unknown> => {
  if (command.kind === "observe") {
    const result = await executeRegisteredDomIntent(
      debuggerRuntime, target, { kind: "document" }, lifecycle.assertCurrent,
    );
    lifecycle.assertCurrent();
    return result;
  }
  if (command.kind === "wait") return executeBoundedBrowserWait(command.durationMs);
  if (command.kind === "navigate") return lifecycle.navigate(command.url);
  if (command.kind === "park-target") {
    await lifecycle.parkTarget();
    return { parked: true };
  }
  if (command.kind === "close-target") {
    await lifecycle.closeTarget();
    return { closed: true };
  }
  if (command.kind === "file-input") return executeExtensionFileInput({
    runtime: debuggerRuntime, target, assertCurrent: lifecycle.assertCurrent,
    selector: command.selector, activation: command.activation,
    approvedFiles: command.approvedFiles, resolvedFilePaths: command.resolvedFilePaths,
  });
  if (command.kind === "authenticated-media") {
    return executeAuthenticatedMedia(
      debuggerRuntime, target, command.assistantTurnId, command.semanticMediaId,
      command.delivery, lifecycle.assertCurrent, lifecycle.onMutationProgress,
    );
  }
  throw new Error("BROWSER_FILE_GRANT_INVALID");
};
