export const OPEN_FAILURE_CODES = [
  "unknown_child",
  "input_schema_invalid",
  "target_policy_blocked",
  "url_policy_blocked",
  "session_gate_blocked",
  "session_snapshot_failed",
  "navigation_timeout",
  "navigation_failed",
  "post_open_state_failed",
  "output_schema_invalid",
  "child_execution_failed",
  "duplicate_open_blocked",
  "LOCAL_PROGRAM_PORT_NOT_CONFIGURED",
  "LOCAL_PROGRAM_PROFILE_NOT_FOUND",
  "LOCAL_PROGRAM_APP_NOT_INSTALLED",
  "LOCAL_PROGRAM_LAUNCH_FAILED",
  "LOCAL_PROGRAM_WINDOW_NOT_VISIBLE",
  "LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING",
  "LOCAL_APP_STATE_HANDOFF_MISSING",
] as const;

export function createOpenFailure(input: {
  code: (typeof OPEN_FAILURE_CODES)[number];
  message: string;
  detail?: string | null;
}) {
  return {
    code: input.code,
    message: input.message,
    detail: input.detail ?? null,
  };
}
