import type { NerveBusAbilityGroup } from "../../nerve-bus/contract.js";
import type { MissionState, DispatchRegisteredAbilityActionInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";
import type { GeometryGuardAbilityGroup } from "../../geometry-guard/index.js";
import type { ScreenshotAbilityGroup } from "../../screenshot/index.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";

export type DispatchSequenceContext = {
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsPersistenceAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
  screenshotAbilityGroup: ScreenshotAbilityGroup;
  runtimeLogger: RuntimeLogger;
};

export type DispatchSequenceResult = {
  status: "success" | "failed" | "review_required";
  stateSnapshot: MissionState;
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

export type DispatchAction = DispatchRegisteredAbilityActionInput["action"];
export type DispatchStatus = "success" | "failed" | "review_required";
export type DispatchSingleResult = { status: DispatchStatus; failureReason: string | null };
export type CellZone = NonNullable<DispatchAction["cellZone"]>;
