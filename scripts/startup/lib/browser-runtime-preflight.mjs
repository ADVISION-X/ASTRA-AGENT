export async function runBrowserRuntimePreflight() {
  return {
    status: "READY",
    releaseState: "CWS_PAGE_CHANNEL",
    actionableMessage: "The Workbench may start without a Browser authority. Browser work remains blocked until the exact installed MV3 extension connects from the local Workbench page.",
  };
}
