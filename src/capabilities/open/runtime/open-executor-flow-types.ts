import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { evaluateOpenTargetPolicy } from "./target-policy-gate.js";
import { evaluateUrlSafety } from "./url-safety-gate.js";
import { evaluateRealChromeSession } from "./real-chrome-session-gate.js";
import { runOpenNavigation } from "./navigation-runner.js";
import { evaluatePostOpenObservationHandoff } from "./post-open-observation-handoff.js";

export type ClockSnapshot = ReturnType<OpenChildExecutionContext["clock"]["now"]>;
export type TargetPolicyResult = ReturnType<typeof evaluateOpenTargetPolicy>;
export type UrlSafetyResult = ReturnType<typeof evaluateUrlSafety>;
export type SessionGateResult = Awaited<ReturnType<typeof evaluateRealChromeSession>>;
export type NavigationResult = Awaited<ReturnType<typeof runOpenNavigation>>;
export type PostOpenStateResult = ReturnType<typeof evaluatePostOpenObservationHandoff>;
export type IdempotencyReservationResult = ReturnType<OpenChildExecutionContext["idempotency"]["reserve"]>;
