import { openCommanderConsole } from "./open-commander-console.mjs";

export async function openReadyPage(input) {
  if (input.flags.skipOpen) {
    input.logEvent("COMMANDER", "commander_console", "open_console", "skipped", `automatic open skipped; commander console url=${input.baseUrl}`);
    return;
  }

  const log = (message) => {
    input.terminalLogger.event({
      phase: "COMMANDER",
      component: "commander_console",
      eventType: "open_console_detail",
      status: "event",
      message,
    });
  };

  try {
    const openResult = await openCommanderConsole(input.baseUrl);
    log(`Opened ${input.baseUrl} in ${openResult.browserName} (${openResult.browserPath})`);
    input.logPass("COMMANDER", "commander_console", "open_console", "passed", `opened Commander Console via ${openResult.browserName}`, {
      refs: [`browserPath=${openResult.browserPath}`],
    });
  } catch (error) {
    input.logFail("COMMANDER", "commander_console", "open_console", "failed", `automatic open failed; open ${input.baseUrl} manually`, {
      failureReason: input.toFailureReason(error),
    });
  }
}
