import { verifyBrowserReleaseSlot } from "../../../src/lib/browser/release/verify-artifacts.mjs";
import { resolveBrowserRuntimeMode } from "../../../src/lib/browser/release/browser-runtime-env.mjs";

const blocked = (code, actionableMessage, extra = {}) => ({
  status: "BLOCKED",
  code,
  actionableMessage,
  ...extra,
});

export async function runBrowserRuntimePreflight() {
  try {
    if (resolveBrowserRuntimeMode() !== "production") {
      return blocked(
        "BROWSER_RUNTIME_MODE_INVALID",
        "The production Workbench must start from a production Browser release, never from a test runtime mode.",
      );
    }
    const releaseSlot = await verifyBrowserReleaseSlot();
    if (releaseSlot.state !== "PRESENT") {
      return blocked(
        "BROWSER_ACTIVATION_TUPLE_INVALID",
        "Complete the signed Browser release, managed installation and Chrome readback before starting the Workbench.",
      );
    }
    return {
      status: "READY",
      releaseState: releaseSlot.state,
      activationPath: releaseSlot.activationPath,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return blocked(
      reason.match(/\bBROWSER_[A-Z0-9_]+\b/)?.[0] ?? "BROWSER_RUNTIME_VERIFY_FAILED",
      "Verify the signed Browser release activation slot before restarting.",
    );
  }
}
