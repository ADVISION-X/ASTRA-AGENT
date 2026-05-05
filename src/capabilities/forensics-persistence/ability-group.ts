import { createForensicsPersistenceRegistry } from "./registry.js";
import {
  type ForensicsAiResultRecordInput,
  type ForensicsBrowseLedgerInput,
  type ForensicsEvidencePacketInput,
  type ForensicsFailedRecordInput,
  type ForensicsImageEvidenceInput,
  type ForensicsOcrEvidenceInput,
  type ForensicsPersistenceAbilityGroup,
  type ForensicsPersistenceAbilityInput,
  type ForensicsRuntimeSnapshotInput,
  type ForensicsStructuredActionLogInput,
  type ForensicsStructuredRuntimeEventInput,
} from "./contract.js";
import {
  emitForensicsRecordWriteRequested,
  emitForensicsRecordWritten,
  type ForensicsRuntimeEventEmitter,
} from "./shared/forensics-write-boundary-events.js";
import { createForensicsExecutionContext, type CreateForensicsExecutionContextInput } from "./runtime/create-forensics-execution-context.js";
import { buildUnknownForensicsChildResult } from "./shared/forensics-unknown-child-result.js";

type CreateForensicsPersistenceAbilityGroupInput = CreateForensicsExecutionContextInput & {
  structuredLogBus?: ForensicsRuntimeEventEmitter;
};

const createStructuredWriteWrapper = (
  execute: ForensicsPersistenceAbilityGroup["execute"],
  structuredLogBus: ForensicsRuntimeEventEmitter | undefined,
) => async (request: ForensicsStructuredRuntimeEventInput | ForensicsStructuredActionLogInput) => {
  await emitForensicsRecordWriteRequested(structuredLogBus, request);
  const result = await execute(request);
  await emitForensicsRecordWritten(structuredLogBus, request, result);
  return result;
};

const createForensicsChildWriters = (
  execute: ForensicsPersistenceAbilityGroup["execute"],
  structuredLogBus: ForensicsRuntimeEventEmitter | undefined,
) => ({
  writeStructuredRuntimeEvent: createStructuredWriteWrapper(execute, structuredLogBus) as (request: ForensicsStructuredRuntimeEventInput) => ReturnType<ForensicsPersistenceAbilityGroup["execute"]>,
  writeStructuredActionLog: createStructuredWriteWrapper(execute, structuredLogBus) as (request: ForensicsStructuredActionLogInput) => ReturnType<ForensicsPersistenceAbilityGroup["execute"]>,
  writeImageEvidence: (request: ForensicsImageEvidenceInput) => execute(request),
  writeOcrEvidence: (request: ForensicsOcrEvidenceInput) => execute(request),
  writeAiResultRecord: (request: ForensicsAiResultRecordInput) => execute(request),
  finalizeBrowseLedger: (request: ForensicsBrowseLedgerInput) => execute(request),
  finalizeEvidencePacket: (request: ForensicsEvidencePacketInput) => execute(request),
  finalizeFailedRecord: (request: ForensicsFailedRecordInput) => execute(request),
  updateRuntimeSnapshot: (request: ForensicsRuntimeSnapshotInput) => execute(request),
});

export function createForensicsPersistenceAbilityGroup(input: CreateForensicsPersistenceAbilityGroupInput): ForensicsPersistenceAbilityGroup {
  const registry = createForensicsPersistenceRegistry();
  const context = createForensicsExecutionContext(input);

  const execute: ForensicsPersistenceAbilityGroup["execute"] = async (request) => {
    const capability = registry.get(request.childCapabilityId);
    if (!capability) {
      return buildUnknownForensicsChildResult({ request, clock: context.clock });
    }

    return capability.execute(request, context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute,
    ...createForensicsChildWriters(execute, input.structuredLogBus),
  };
}
