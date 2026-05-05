import type { OpenLocalProgramLaunchResult } from "../../capabilities/open/ports/open-local-program-port.js";

export const failedLocalProgramLaunch = (input: {
  message: string;
  createdAt: string;
  appLaunchAttemptRef: string;
}): OpenLocalProgramLaunchResult => ({
  localProgramActionId: null,
  ok: false,
  message: input.message,
  createdAt: input.createdAt,
  appLaunchAttemptRef: input.appLaunchAttemptRef,
  windowHandoffRef: null,
  localAppStateHandoffRef: null,
  portKind: "open-local-program-port",
});
