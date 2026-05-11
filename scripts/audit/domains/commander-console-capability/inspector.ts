import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { COMMANDER_CONSOLE_PRODUCTION_ROOT } from "./config.js";
import {
  checkRequiredChildIdsPresent,
  checkForbiddenChildIdsAbsent,
  checkForbiddenFieldsAbsentFromSchema,
  checkProductionFileCount,
  checkIndexExportsFactory,
  checkAbilityGroupImports,
  checkNoDeletedSharedViewTypesImport,
  checkEnvelopeDefinesTransportPort,
} from "./run-inspector.js";

/**
 * Commander Console Capability Inspector
 *
 * Answers 8 governance questions:
 *   1. Are all 7 required child IDs present in children.ts?
 *   2. Are all forbidden child IDs absent from the production root?
 *   3. Are forbidden fields absent from schema.ts?
 *   4. Does the production root have at most 18 files?
 *   5. Does index.ts export createCommanderConsoleAbilityGroup?
 *   6. Does ability-group.ts import from registry.js and not from read-models?
 *   7. Are there no imports from deleted shared/commander-view-types?
 *   8. Does envelope.ts define CommandTransportPort with sendHumanCommandEnvelope?
 *
 * Governance:
 *   - Commander is the human cockpit, not the system engine.
 *   - 7 atomic children only.
 *   - No read-model imports in ability-group.ts.
 *   - No forbidden fields (candidateId, mapId, disposition, etc.).
 */
export const commanderConsoleCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Commander Console Capability Inspector",
  inspectorId: "commander-console-capability-owner",
  capabilityDomain: "commander-console-capability",
  inspectorEntry: "scripts/audit/domains/commander-console-capability/inspector.ts",
  ownedPaths: [COMMANDER_CONSOLE_PRODUCTION_ROOT],
  pendingSummary: "commander-console-capability law exists; atomic rebuild of 7-child cockpit pending",
  implementedSummary:
    "commander-console-capability is the human cockpit with exactly 7 atomic children; no read-model universe; no forbidden fields",
  extraChecks: async () => {
    const [
      requiredChildren,
      forbiddenChildren,
      forbiddenFields,
      fileCount,
      indexExports,
      abilityGroupImports,
      noDeletedViewTypes,
      envelopePort,
    ] = await Promise.all([
      checkRequiredChildIdsPresent(),
      checkForbiddenChildIdsAbsent(),
      checkForbiddenFieldsAbsentFromSchema(),
      checkProductionFileCount(),
      checkIndexExportsFactory(),
      checkAbilityGroupImports(),
      checkNoDeletedSharedViewTypesImport(),
      checkEnvelopeDefinesTransportPort(),
    ]);

    return {
      findings: [
        ...requiredChildren.findings,
        ...forbiddenChildren.findings,
        ...forbiddenFields.findings,
        ...fileCount.findings,
        ...indexExports.findings,
        ...abilityGroupImports.findings,
        ...noDeletedViewTypes.findings,
        ...envelopePort.findings,
      ],
      phases: [
        requiredChildren.phase,
        forbiddenChildren.phase,
        forbiddenFields.phase,
        fileCount.phase,
        indexExports.phase,
        abilityGroupImports.phase,
        noDeletedViewTypes.phase,
        envelopePort.phase,
      ],
    };
  },
});
