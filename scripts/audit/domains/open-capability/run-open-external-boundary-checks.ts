import { inspectLocalBrowserSessionBoundary } from "../local-browser-session/inspector.js";
import { inspectPlatformActionBoundary } from "../platform-action/inspector.js";

export async function runOpenExternalBoundaryChecks() {
  const platformBoundary = await inspectPlatformActionBoundary();
  const browserBoundary = await inspectLocalBrowserSessionBoundary();
  return { platformBoundary, browserBoundary };
}