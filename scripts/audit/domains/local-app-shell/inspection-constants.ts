export const localAppShellInspectionConstants = {
  STARTUP_ENTRY: "scripts/startup/launch-grasseye.mjs",
  STARTUP_HELPERS: [
    "scripts/startup/lib/dependency-check.mjs",
    "scripts/startup/lib/process-control.mjs",
    "scripts/startup/lib/health-check.mjs",
    "scripts/startup/lib/local-ai-runtime-readiness.mjs",
    "scripts/startup/lib/open-commander-console.mjs",
    "scripts/startup/lib/terminal-structured-log.mjs",
  ] as const,
  SERVER_HELPER: "src/app/create-workbench-server.ts",
  RUNTIME_API_HELPER: "src/app/runtime-api-handlers.ts",
  SHELL_RENDER_PATH: "src/lib/local-app-shell/render-commander-console-page.ts",
  LEGACY_CONSOLE_PATH: "src/features/operator-control/console-view.ts",
  ILLEGAL_LOCAL_RUNTIME_EXECUTION_PATHS: new Set([
    "src/lib/local-runtime/runtime-executor.ts",
    "src/lib/local-runtime/runtime-bootstrap.ts",
    "src/lib/local-runtime/runtime-state.ts",
    "src/lib/local-runtime/runtime-step-support.ts",
  ]),
} as const;