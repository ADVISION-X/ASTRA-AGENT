import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID, type ForensicsPersistenceChildCapability } from "../../contract.js";
import { executeForensicsChild } from "../../runtime/forensics-executor.js";
import { FINALIZE_BROWSE_LEDGER_CHILD } from "./contract.js";
import { FinalizeBrowseLedgerInputSchema, FinalizeBrowseLedgerOutputSchema } from "./schema.js";

export const finalizeBrowseLedgerCapability: ForensicsPersistenceChildCapability = {
  abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,
  childCapabilityId: FINALIZE_BROWSE_LEDGER_CHILD.childCapabilityId,
  recordType: FINALIZE_BROWSE_LEDGER_CHILD.recordType,
  execute(input, context) {
    return executeForensicsChild({
      rawRequest: input,
      context,
      child: {
        childCapabilityId: FINALIZE_BROWSE_LEDGER_CHILD.childCapabilityId,
        recordType: FINALIZE_BROWSE_LEDGER_CHILD.recordType,
        inputSchema: FinalizeBrowseLedgerInputSchema,
        outputSchema: FinalizeBrowseLedgerOutputSchema,
        policy: FINALIZE_BROWSE_LEDGER_CHILD,
        integrity: FINALIZE_BROWSE_LEDGER_CHILD,
      },
    });
  },
};
