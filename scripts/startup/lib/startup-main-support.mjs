export function parseFlags(argv) {
  return {
    updateRequested: argv.includes("--update"),
    skipOpen: argv.includes("--no-open") || process.env.GRASSEYE_SKIP_OPEN === "1",
  };
}

export function registerSignalHandlers(shutdown) {
  const stop = signal => { void shutdown(signal).catch(() => { process.exitCode = 1; }); };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}
