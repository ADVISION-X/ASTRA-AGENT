export type LocalProgramFailureCode =
  | "LOCAL_PROGRAM_PORT_NOT_CONFIGURED"
  | "LOCAL_PROGRAM_PROFILE_NOT_FOUND"
  | "LOCAL_PROGRAM_APP_NOT_INSTALLED"
  | "LOCAL_PROGRAM_LAUNCH_FAILED"
  | "LOCAL_PROGRAM_WINDOW_NOT_VISIBLE"
  | "LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING"
  | "LOCAL_APP_STATE_HANDOFF_MISSING";

const REASON_CODE_PAIRS = [
  ["LOCAL_PROGRAM_PROFILE_NOT_FOUND", "LOCAL_PROGRAM_PROFILE_NOT_FOUND"],
  ["LOCAL_PROGRAM_APP_NOT_INSTALLED", "LOCAL_PROGRAM_APP_NOT_INSTALLED"],
  ["LOCAL_PROGRAM_WINDOW_NOT_VISIBLE", "LOCAL_PROGRAM_WINDOW_NOT_VISIBLE"],
  ["LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING", "LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING"],
  ["LOCAL_APP_STATE_HANDOFF_MISSING", "LOCAL_APP_STATE_HANDOFF_MISSING"],
  ["LOCAL_PROGRAM_PORT_NOT_CONFIGURED", "LOCAL_PROGRAM_PORT_NOT_CONFIGURED"],
] as const;

export function deriveLocalProgramFailureCode(reason: string | null | undefined): LocalProgramFailureCode {
  const pair = REASON_CODE_PAIRS.find(([marker]) => reason?.includes(marker));
  return pair?.[1] ?? "LOCAL_PROGRAM_LAUNCH_FAILED";
}

export function resolveLocalProgramFailureCode(input: {
  idempotencyOk: boolean;
  launch: { failureCode: LocalProgramFailureCode | null; reason: string | null };
  handoff: { windowHandoffRef: string | null; localAppStateHandoffRef: string | null };
}): LocalProgramFailureCode | "duplicate_open_blocked" {
  if (!input.idempotencyOk) return "duplicate_open_blocked";
  if (input.launch.failureCode) return input.launch.failureCode;
  if (input.handoff.windowHandoffRef === null) return "LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING";
  if (input.handoff.localAppStateHandoffRef === null) return "LOCAL_APP_STATE_HANDOFF_MISSING";
  return deriveLocalProgramFailureCode(input.launch.reason);
}
