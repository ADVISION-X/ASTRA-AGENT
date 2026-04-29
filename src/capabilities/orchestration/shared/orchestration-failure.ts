export type OrchestrationFailureReason =
  | "input_schema_invalid"
  | "idempotency_conflict"
  | "mission_not_found"
  | "map_not_found"
  | "map_invalid"
  | "step_not_found"
  | "transition_invalid"
  | "loop_guard_triggered"
  | "state_store_failure"
  | "nerve_bus_failure"
  | "child_execution_failed"
  | "emergency_stop_latched";