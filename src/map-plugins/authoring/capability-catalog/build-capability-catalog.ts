import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createAiCapabilityRegistry, listAiChildren } from "../../../capabilities/ai/registry.js";
import { listForensicsPersistenceChildren } from "../../../capabilities/forensics-persistence/registry.js";
import { listGeometryGuardChildren } from "../../../capabilities/geometry-guard/registry.js";
import { listMouseClickChildren } from "../../../capabilities/mouse-click/registry.js";
import { listMouseScrollChildren } from "../../../capabilities/mouse-scroll/registry.js";
import { createOpenRegistry, listOpenChildren } from "../../../capabilities/open/registry.js";
import { listPageStateChildren } from "../../../capabilities/page-state/registry.js";
import { listPostActionVerificationChildren } from "../../../capabilities/post-action-verification/registry.js";
import { getScreenshotChildRegistryEntry, listScreenshotChildren } from "../../../capabilities/screenshot/registry.js";
import { listTextInputChildren } from "../../../capabilities/text-input/registry.js";
import { listVisualTargetChildren } from "../../../capabilities/visual-target/registry.js";

import { CapabilityCatalogDocumentSchema, type CapabilityCatalogDocument, type CapabilityCatalogEntry } from "./schema.js";

export const CAPABILITY_CATALOG_VERSION = "2026-04-map-prompt-contract-v1";

type AbilityGroupPolicy = {
  supportedTargets: string[];
  routableByMap: boolean;
  requiresGeometryProof: boolean;
  requiresPostActionVerification: boolean;
  requiresReviewGate: boolean;
  sensitiveOperation: boolean;
  forbiddenResponsibilities: string[];
};

const ABILITY_GROUP_POLICIES: Record<string, AbilityGroupPolicy> = {
  ai: {
    supportedTargets: [],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute browser actions", "invent prompt text", "read credentials or cookies"],
  },
  open: {
    supportedTargets: [],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: true,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["click page elements", "skip page-state handoff", "reuse ungoverned URLs"],
  },
  screenshot: {
    supportedTargets: ["browser-viewport", "browser-region", "desktop-screen"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute actions", "author prompt contracts", "persist evidence records directly"],
  },
  "visual-target": {
    supportedTargets: ["browser-viewport", "desktop-screen", "source-image"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["click targets", "mutate platform state", "decide mission branching"],
  },
  "geometry-guard": {
    supportedTargets: ["browser-viewport", "desktop-screen", "source-image"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute actions", "capture screenshots", "persist evidence"],
  },
  "mouse-click": {
    supportedTargets: ["browser-viewport", "desktop-screen"],
    routableByMap: true,
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    requiresReviewGate: false,
    sensitiveOperation: true,
    forbiddenResponsibilities: ["invent geometry", "skip post-action verification", "read page state"],
  },
  "text-input": {
    supportedTargets: ["browser-input", "desktop-input"],
    routableByMap: true,
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    requiresReviewGate: true,
    sensitiveOperation: true,
    forbiddenResponsibilities: ["invent credentials", "click targets", "decide map branching"],
  },
  "mouse-scroll": {
    supportedTargets: ["browser-viewport", "desktop-screen"],
    routableByMap: true,
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["invent geometry", "capture screenshots", "persist evidence"],
  },
  "forensics-persistence": {
    supportedTargets: ["structured-log", "evidence-ledger", "artifact-store"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: true,
    forbiddenResponsibilities: ["execute browser actions", "classify page state", "author prompts"],
  },
  "page-state": {
    supportedTargets: ["browser-page"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute actions", "persist evidence", "author prompts"],
  },
  "post-action-verification": {
    supportedTargets: ["browser-page", "browser-viewport", "runtime-proof"],
    routableByMap: true,
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    requiresReviewGate: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: ["execute recovery actions", "invent prompts", "persist unrelated evidence"],
  },
};

const humanize = (value: string): string => value.split("-").filter(Boolean).join(" ");

const buildEntry = (abilityGroupId: string, childCapabilityId: string, description: string, supportedTargets?: string[]): CapabilityCatalogEntry => {
  const policy = ABILITY_GROUP_POLICIES[abilityGroupId];
  if (!policy) {
    throw new Error(`Unsupported ability group in capability catalog builder: ${abilityGroupId}`);
  }

  return {
    abilityGroupId,
    childCapabilityId,
    description,
    inputSchemaRef: `${abilityGroupId}.${childCapabilityId}.input`,
    outputSchemaRef: `${abilityGroupId}.${childCapabilityId}.output`,
    supportedTargets: supportedTargets ?? policy.supportedTargets,
    routableByMap: policy.routableByMap,
    requiresGeometryProof: policy.requiresGeometryProof,
    requiresPostActionVerification: policy.requiresPostActionVerification,
    requiresReviewGate: policy.requiresReviewGate,
    sensitiveOperation: policy.sensitiveOperation,
    forbiddenResponsibilities: policy.forbiddenResponsibilities,
  };
};

export const buildCapabilityCatalog = (): CapabilityCatalogDocument => {
  const entries: CapabilityCatalogEntry[] = [];
  const aiRegistry = createAiCapabilityRegistry();
  const openRegistry = createOpenRegistry();

  for (const childCapabilityId of listAiChildren()) {
    const child = aiRegistry.get(childCapabilityId);
    const allowedTaskTypes = child ? child.allowedTaskTypes.join(", ") : "governed tasks";
    entries.push(buildEntry("ai", childCapabilityId, `Execute governed AI child ${humanize(childCapabilityId)} for task types: ${allowedTaskTypes}.`));
  }

  for (const childCapabilityId of listOpenChildren()) {
    const child = openRegistry.get(childCapabilityId);
    entries.push(buildEntry("open", childCapabilityId, child?.purpose ?? `Open governed target ${humanize(childCapabilityId)}.`, child ? [child.platformId] : undefined));
  }

  for (const childCapabilityId of listScreenshotChildren()) {
    const child = getScreenshotChildRegistryEntry(childCapabilityId);
    entries.push(buildEntry(
      "screenshot",
      childCapabilityId,
      child ? `Capture governed screenshot for ${child.outputImageKind} in ${child.coordinateSpacePolicy}.` : `Capture governed screenshot for ${humanize(childCapabilityId)}.`,
    ));
  }

  for (const childCapabilityId of listVisualTargetChildren()) {
    entries.push(buildEntry("visual-target", childCapabilityId, `Resolve a governed visual target for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listGeometryGuardChildren()) {
    entries.push(buildEntry("geometry-guard", childCapabilityId, `Normalize or validate governed geometry for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listMouseClickChildren()) {
    entries.push(buildEntry("mouse-click", childCapabilityId, `Execute governed click behavior for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listTextInputChildren()) {
    entries.push(buildEntry("text-input", childCapabilityId, `Execute governed text-input behavior for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listMouseScrollChildren()) {
    entries.push(buildEntry("mouse-scroll", childCapabilityId, `Execute governed scroll behavior for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listForensicsPersistenceChildren()) {
    entries.push(buildEntry("forensics-persistence", childCapabilityId, `Persist governed forensic record for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listPageStateChildren()) {
    entries.push(buildEntry("page-state", childCapabilityId, `Classify governed page state for ${humanize(childCapabilityId)}.`));
  }

  for (const childCapabilityId of listPostActionVerificationChildren()) {
    entries.push(buildEntry("post-action-verification", childCapabilityId, `Verify governed post-action outcome for ${humanize(childCapabilityId)}.`));
  }

  const sortedEntries = entries.sort((left, right) => {
    if (left.abilityGroupId === right.abilityGroupId) {
      return left.childCapabilityId.localeCompare(right.childCapabilityId);
    }
    return left.abilityGroupId.localeCompare(right.abilityGroupId);
  });

  return CapabilityCatalogDocumentSchema.parse({
    version: CAPABILITY_CATALOG_VERSION,
    entries: sortedEntries,
  });
};

export const writeCapabilityCatalogGeneratedFile = async (): Promise<void> => {
  const filePath = fileURLToPath(new URL("./capability-catalog.generated.json", import.meta.url));
  await writeFile(filePath, `${JSON.stringify(buildCapabilityCatalog(), null, 2)}\n`, "utf8");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void writeCapabilityCatalogGeneratedFile();
}