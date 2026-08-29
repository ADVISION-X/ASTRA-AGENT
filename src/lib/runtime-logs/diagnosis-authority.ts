import type { RuntimeLogEventV2 } from "./runtime-event-contract.js";
import type { RuntimeAuthorityResolver } from "./diagnosis-contract.js";

const authorityCandidates = (
  events: readonly RuntimeLogEventV2[],
): ReadonlyMap<string, RuntimeLogEventV2[]> => {
  const groups = new Map<string, RuntimeLogEventV2[]>();
  for (const event of events) {
    if (!("authorityRef" in event) || !event.authorityRef || !event.authorityHash) continue;
    groups.set(event.authorityRef, [...(groups.get(event.authorityRef) ?? []), event]);
  }
  return groups;
};

const latestWithinOneRun = (
  authorityRef: string,
  candidates: readonly RuntimeLogEventV2[],
  findings: string[],
): RuntimeLogEventV2 => {
  const runs = new Set(candidates.map((event) => event.producerRunId));
  if (runs.size !== 1) findings.push(`AUTHORITY_CROSS_RUN_ORDER_UNPROVEN:${authorityRef}`);
  return [...candidates].sort((left, right) =>
    left.producerRunId.localeCompare(right.producerRunId) || left.producerSeq - right.producerSeq).at(-1)!;
};

const verifyAuthority = (
  authorityRef: string,
  event: RuntimeLogEventV2,
  resolver: RuntimeAuthorityResolver | undefined,
  findings: string[],
): void => {
  const authorityHash = "authorityHash" in event ? event.authorityHash : undefined;
  if (!authorityHash) return;
  const verdict = resolver?.(authorityRef, authorityHash);
  if (!verdict || verdict === "missing") findings.push(`AUTHORITY_REF_UNVERIFIED:${authorityRef}`);
  else if (verdict === "mismatch") findings.push(`AUTHORITY_HASH_MISMATCH:${authorityRef}`);
};

export const resolveRuntimeAuthorities = (input: Readonly<{
  events: readonly RuntimeLogEventV2[];
  resolver: RuntimeAuthorityResolver | undefined;
  findings: string[];
}>): ReadonlyMap<string, RuntimeLogEventV2> => {
  const selectedEvents = new Map<string, RuntimeLogEventV2>();
  for (const [authorityRef, candidates] of authorityCandidates(input.events)) {
    const selected = latestWithinOneRun(authorityRef, candidates, input.findings);
    selectedEvents.set(authorityRef, selected);
    verifyAuthority(authorityRef, selected, input.resolver, input.findings);
  }
  return selectedEvents;
};
