import type { InspectorContext } from "./inspection-core.js";

import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";

const GENERATED_CHAIN_LAW_ID = config.ACTIVE_LAW_IDS[7];

const collectOwnerResolutionFindings = (context: InspectorContext): AttackOutcome["findings"] => {
  const findings = [] as AttackOutcome["findings"];
  const matrixOwner = context.matrixOwnersByDomain.get(config.CAPABILITY_DOMAIN);
  const planOwner = context.planOwnersByDomain.get(config.CAPABILITY_DOMAIN);
  const manifestOwner = context.manifestsByDomain.get(config.CAPABILITY_DOMAIN);
  if (!matrixOwner || matrixOwner.inspectorId !== config.INSPECTOR_ID || matrixOwner.entry !== config.INSPECTOR_ENTRY) {
    findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: "Generated enforcement matrix must resolve visual-target-capability to this inspector entry." }));
  }
  if (!planOwner || planOwner.inspectorId !== config.INSPECTOR_ID) {
    findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: "Generated audit plan must retain visual-target-capability ownership for this inspector." }));
  }
  if (!manifestOwner || manifestOwner.entry !== config.INSPECTOR_ENTRY) {
    findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: "Resolved manifest ownership drifted away from this inspector entry." }));
  }
  return findings;
};

const collectRegistryLawFindings = (context: InspectorContext): AttackOutcome["findings"] => {
  const findings = [] as AttackOutcome["findings"];
  const registryLaws = context.lawRegistry.laws.filter((law) => law.capabilityDomain === config.CAPABILITY_DOMAIN);
  const registryLawById = new Map(registryLaws.map((law) => [law.lawId, law]));
  for (const lawId of config.ACTIVE_LAW_IDS) {
    const registryLaw = registryLawById.get(lawId);
    if (!registryLaw) {
      findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: `Generated law registry must include ${lawId}.` }));
      continue;
    }
    if (registryLaw.enforcementMode !== "machine-blocking") {
      findings.push(createViolation({ lawId, file: config.MANIFEST_PATH, message: `${lawId} must remain machine-blocking.` }));
    }
    if (registryLaw.evidenceMode !== "law+inspector+negative-proof") {
      findings.push(createViolation({ lawId, file: config.MANIFEST_PATH, message: `${lawId} must remain law+inspector+negative-proof.` }));
    }
    if (registryLaw.tier !== "P0") {
      findings.push(createViolation({ lawId, file: config.MANIFEST_PATH, message: `${lawId} must remain P0.` }));
    }
  }
  for (const law of registryLaws) {
    if (!config.ACTIVE_LAW_IDS.includes(law.lawId as (typeof config.ACTIVE_LAW_IDS)[number])) {
      findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: `Generated law registry must not retain retired Visual Target law ${law.lawId}.` }));
    }
  }
  return findings;
};

const collectOwnerLawSetFindings = (context: InspectorContext): AttackOutcome["findings"] => {
  const findings = [] as AttackOutcome["findings"];
  for (const owner of [context.matrixOwnersByDomain.get(config.CAPABILITY_DOMAIN), context.planOwnersByDomain.get(config.CAPABILITY_DOMAIN)]) {
    if (!owner) {
      continue;
    }
    for (const lawId of config.ACTIVE_LAW_IDS) {
      if (!owner.lawIds.includes(lawId)) {
        findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: `Generated owner chain must include ${lawId}.` }));
      }
    }
    for (const lawId of owner.lawIds) {
      if (!config.ACTIVE_LAW_IDS.includes(lawId as (typeof config.ACTIVE_LAW_IDS)[number])) {
        findings.push(createViolation({ lawId: GENERATED_CHAIN_LAW_ID, file: config.MANIFEST_PATH, message: `Generated owner chain must not retain retired Visual Target law ${lawId}.` }));
      }
    }
  }
  return findings;
};

export async function runGeneratedChainCheck(context: InspectorContext): Promise<AttackOutcome> {
  const findings = [...collectOwnerResolutionFindings(context), ...collectRegistryLawFindings(context), ...collectOwnerLawSetFindings(context)];
  return { findings, phase: createAttackPhase("generated-chain-check", findings, "Visual Target stays connected to the generated audit chain with all active V2 laws preserved in registry, matrix, and audit plan.", "Visual Target generated audit ownership or active V2 law coverage drifted away from the canonical enforcement chain.") };
}