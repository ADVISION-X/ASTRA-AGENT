import type {
  AmazonListingEditReadSyncInput,
  AmazonListingEditReadSyncInventoryItem,
  AmazonListingEditReadSyncTargetResolution,
} from "./amazon-listing-edit-read-sync.schema.js";

const buildDefaultTargetResolution = (
  mission: AmazonListingEditReadSyncInput,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode,
  status: mission.targetMode === "inventory" || mission.targetMode === "all-inventory" ? "not_required" : "not_found",
  reason: mission.targetMode === "inventory" || mission.targetMode === "all-inventory" ? null : "target_resolution_not_started",
  candidateCount: 0,
  requested: mission.target,
  matchedParent: null,
  matchedChild: null,
  evidenceRefs: [],
});

const normalize = (value: string | null | undefined): string => (value ?? "").trim().toUpperCase();
const matchesAsin = (item: AmazonListingEditReadSyncInventoryItem, asin: string | null | undefined): boolean =>
  Boolean(asin && normalize(item.asin) === normalize(asin));
const matchesSku = (item: AmazonListingEditReadSyncInventoryItem, sku: string | null | undefined): boolean =>
  Boolean(sku && normalize(item.sku) === normalize(sku));
const matchesParent = (item: AmazonListingEditReadSyncInventoryItem, input: AmazonListingEditReadSyncInput): boolean =>
  matchesAsin(item, input.target.parentAsin)
  || matchesSku(item, input.target.parentSku)
  || Boolean(input.target.parentAsin && normalize(item.parentAsin) === normalize(input.target.parentAsin))
  || Boolean(input.target.parentSku && normalize(item.parentSku) === normalize(input.target.parentSku));
const matchesChild = (item: AmazonListingEditReadSyncInventoryItem, input: AmazonListingEditReadSyncInput): boolean =>
  matchesAsin(item, input.target.childAsin ?? input.target.asin)
  || matchesSku(item, input.target.childSku ?? input.target.sku);

const buildFailedResolution = (
  mission: AmazonListingEditReadSyncInput,
  status: AmazonListingEditReadSyncTargetResolution["status"],
  reason: string,
  candidateCount: number,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode, status, reason, candidateCount, requested: mission.target,
  matchedParent: null, matchedChild: null, evidenceRefs: [],
});

const buildMatchedResolution = (
  mission: AmazonListingEditReadSyncInput,
  candidates: readonly AmazonListingEditReadSyncInventoryItem[],
  matchedParent: AmazonListingEditReadSyncInventoryItem | null,
  matchedChild: AmazonListingEditReadSyncInventoryItem,
): AmazonListingEditReadSyncTargetResolution => ({
  mode: mission.targetMode,
  status: "matched",
  reason: null,
  candidateCount: candidates.length,
  requested: mission.target,
  matchedParent,
  matchedChild,
  evidenceRefs: [matchedChild.evidenceRef, ...(matchedParent ? [matchedParent.evidenceRef] : [])],
});

const buildResolutionFromCandidates = (
  mission: AmazonListingEditReadSyncInput,
  candidates: readonly AmazonListingEditReadSyncInventoryItem[],
  matchedParent: AmazonListingEditReadSyncInventoryItem | null,
): AmazonListingEditReadSyncTargetResolution => {
  if (candidates.length === 0) return buildFailedResolution(mission, "not_found", "target_not_found", 0);
  if (candidates.length > 1) return buildFailedResolution(mission, "ambiguous", "target_ambiguous", candidates.length);
  return buildMatchedResolution(mission, candidates, matchedParent, candidates[0]!);
};

const resolveParentTarget = (
  mission: AmazonListingEditReadSyncInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  parentRows: readonly AmazonListingEditReadSyncInventoryItem[],
): AmazonListingEditReadSyncTargetResolution => {
  const children = inventoryItems.filter((item) =>
    item.rowKind === "child" && (matchesParent(item, mission) || parentRows.some((parent) =>
      normalize(parent.asin) === normalize(item.parentAsin) || normalize(parent.sku) === normalize(item.parentSku))));
  if (parentRows.length === 0) return buildFailedResolution(mission, "parent_not_proven", "parent_target_not_found", 0);
  return buildResolutionFromCandidates(mission, children, parentRows[0] ?? null);
};

const resolveChildTarget = (
  mission: AmazonListingEditReadSyncInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  childRows: readonly AmazonListingEditReadSyncInventoryItem[],
): AmazonListingEditReadSyncTargetResolution => {
  if (childRows.length !== 1) return buildResolutionFromCandidates(mission, childRows, null);
  const child = childRows[0]!;
  if (Boolean(mission.target.parentAsin || mission.target.parentSku) && !matchesParent(child, mission)) {
    return {
      ...buildFailedResolution(mission, "child_parent_mismatch", "child_parent_proof_failed", childRows.length),
      matchedChild: child,
      evidenceRefs: [child.evidenceRef],
    };
  }
  const matchedParent = inventoryItems.find((item) => item.rowKind === "parent"
    && (normalize(item.asin) === normalize(child.parentAsin) || normalize(item.sku) === normalize(child.parentSku))) ?? null;
  return buildMatchedResolution(mission, childRows, matchedParent, child);
};

export const buildTargetResolution = (
  mission: AmazonListingEditReadSyncInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
): AmazonListingEditReadSyncTargetResolution => {
  if (mission.targetMode === "inventory" || mission.targetMode === "all-inventory") {
    return { ...buildDefaultTargetResolution(mission), candidateCount: inventoryItems.length, evidenceRefs: inventoryItems.map((item) => item.evidenceRef) };
  }
  const parentRows = inventoryItems.filter((item) => item.rowKind === "parent" && matchesParent(item, mission));
  const childRows = inventoryItems.filter((item) => item.rowKind !== "parent" && matchesChild(item, mission));
  if (mission.targetMode === "asin" || mission.targetMode === "sku") {
    const candidates = inventoryItems.filter((item) => mission.targetMode === "asin"
      ? matchesAsin(item, mission.target.asin) : matchesSku(item, mission.target.sku));
    return buildResolutionFromCandidates(mission, candidates, null);
  }
  if (mission.targetMode === "parent") return resolveParentTarget(mission, inventoryItems, parentRows);
  if (mission.targetMode === "child") return resolveChildTarget(mission, inventoryItems, childRows);
  return buildFailedResolution(mission, "not_found", "invalid_target_mode", 0);
};

export const selectInventoryItems = (
  mission: AmazonListingEditReadSyncInput,
  inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[],
  targetResolution: AmazonListingEditReadSyncTargetResolution,
): readonly AmazonListingEditReadSyncInventoryItem[] => {
  if (targetResolution.status === "matched" && targetResolution.matchedChild) return [targetResolution.matchedChild];
  if (mission.targetMode === "inventory" || mission.targetMode === "all-inventory") {
    return inventoryItems.filter((item) => item.rowKind !== "parent").slice(0, mission.maxItems);
  }
  return [];
};
