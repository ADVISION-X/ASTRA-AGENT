export { parseDebugLoopArgs, printDebugLoopUsage, runDebugLoop } from "./run-debug-loop-core.mjs";

import { parseDebugLoopArgs, printDebugLoopUsage, runDebugLoop } from "./run-debug-loop-core.mjs";

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const args = parseDebugLoopArgs(process.argv.slice(2));
  if (args.help || !args.scenarioId) {
    printDebugLoopUsage();
    process.exitCode = args.help ? 0 : 1;
  } else {
    const result = await runDebugLoop(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.finalDecision === "PASS" ? 0 : result.finalDecision.startsWith("BLOCKED") || result.finalDecision === "CONTINUE" ? 2 : 1;
  }
}