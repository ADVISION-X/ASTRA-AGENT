import fs from "node:fs/promises";

import { createPersistenceRuntime } from "../../../src/lib/local-runtime/workbench-persistence-runtime.ts";

async function main() {
  const dataDir = "tmp/debug-loop/post-fix-runtime-verification/isolated-b5-check-data";
  const runtime = createPersistenceRuntime(dataDir, {
    emitRuntimeEvent() {},
    emitActionLog() {},
  });

  const result = await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "open-facebook-reels",
    missionId: "mission-test",
    runId: "run-test",
    sessionId: "session-test",
    roundId: "0",
    videoVisitId: null,
    stepId: "open_target_page",
    mapPackageId: "pkg-test",
    mapPackageVersion: "1.0.0",
    selectedMapId: "facebook.seeding-video.discovery.meta.v1",
    selectedMapVersion: "1.0.0",
    activationSnapshotRef: "activation-snapshot:test:1.0.0:1.0.0",
    capabilityCallId: "cap-test",
    inputRefs: ["input-ref"],
    outputRefs: [],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: {
        eventId: "event-test",
        eventType: "MAP_STEP_SELECTED",
        level: "INFO",
        phase: "mission-loop",
        component: "orchestration",
        owner: "Orchestration",
        abilityGroupId: "orchestration",
        childCapabilityId: "open-facebook-reels",
        sessionId: "session-test",
        missionId: "mission-test",
        roundId: "0",
        videoVisitId: null,
        mapId: "facebook.seeding-video.discovery.meta.v1",
        stepId: "open-facebook-reels",
        traceId: "trace-test",
        spanId: "span-test",
        attemptId: "attempt-test",
        activationSnapshotRef: "activation-snapshot:test:1.0.0:1.0.0",
        capabilityCallId: "cap-test",
        step: "open_target_page",
        status: "success",
        reason: "test",
        createdAt: new Date().toISOString(),
        refs: [],
        inputRefs: ["input-ref"],
        outputRefs: [],
        evidenceRefs: [],
        proofRefs: [],
        artifactRefs: [],
        actionLogRefs: [],
        dataQualityFlags: [],
      },
    },
  });

  const state = await fs.readFile(`${dataDir}/state.json`, "utf8");
  console.log(
    JSON.stringify(
      {
        status: result.status,
        hasRequested: state.includes("FORENSICS_RECORD_WRITE_REQUESTED"),
        hasWritten: state.includes("FORENSICS_RECORD_WRITTEN"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
