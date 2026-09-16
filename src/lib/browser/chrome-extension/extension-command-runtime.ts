import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { executeAuthenticatedMedia } from "./authenticated-media-runtime.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { executeExtensionFileInput } from "./extension-file-input-runtime.js";
import { executeBoundedBrowserWait } from "./extension-target-observation.js";

type CommandLifecycle = Readonly<{
  assertCurrent(): void;
  parkTarget(): Promise<void>;
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
  if (command.kind === "wait") return command.transientDomConfirmationStage === undefined
    ? executeBoundedBrowserWait(command.durationMs)
    : { stage: command.transientDomConfirmationStage,
      waitedMs: command.transientDomConfirmationStage === 1 ? 1_500 : 3_000 };
  if (command.kind === "park-target") {
    await lifecycle.parkTarget();
    return { parked: true };
  }
  if (command.kind === "file-input") return executeExtensionFileInput({
    runtime: debuggerRuntime, target, assertCurrent: lifecycle.assertCurrent,
    selector: command.selector, activation: command.activation,
    approvedFiles: command.approvedFiles, resolvedFilePaths: command.resolvedFilePaths,
  });
  if (command.kind === "authenticated-media") {
    return executeAuthenticatedMedia(
      debuggerRuntime, target, command.canonicalConversationUrl, command.userTurnId,
      command.semanticMediaId,
      lifecycle.assertCurrent,
    );
  }
  throw new Error("BROWSER_FILE_GRANT_INVALID");
};
