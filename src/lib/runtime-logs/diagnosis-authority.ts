import type { RuntimeLogEventV2 } from "./runtime-event-contract.js";
import type { RuntimeAuthorityResolver } from "./diagnosis-contract.js";

const authorityCandidates = (
  events: readonly RuntimeLogEventV2[],
): ReadonlyMap<string, RuntimeLogEventV2[]> => {
  const groups = new Map<string, RuntimeLogEventV2[]>();
  for (const event of events) {
    if (!("authorityRef" in event) || !event.authorityRef) continue;
    if (!("authorityHash" in event) || !event.authorityHash) continue;
    groups.set(event.authorityRef, [...(groups.get(event.authorityRef) ?? []), event]);
  }
  return groups;
};

const selectedAuthorityRun = (
  candidates: readonly RuntimeLogEventV2[],
  freshRuns: ReadonlyMap<string, boolean>,
): string | null => {
  const liveRuns = new Set(candidates.filter((event) => freshRuns.get(event.producerRunId) === true)
    .map((event) => event.producerRunId));
  const reconciledRuns = new Set(candidates.filter((event) =>
    event.type === "STATE" && event.reconciledFromAuthority === true).map((event) => event.producerRunId));
  if (liveRuns.size === 1) return [...liveRuns][0]!;
  return reconciledRuns.size === 1 ? [...reconciledRuns][0]! : null;
};

const lastAuthorityEvent = (
  candidates: readonly RuntimeLogEventV2[],
  selectedRun: string | null,
): RuntimeLogEventV2 => {
  const eligible = selectedRun
    ? candidates.filter((event) => event.producerRunId === selectedRun)
    : [...candidates];
  return eligible.sort((left, right) =>
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
  else if (verdict === "mismatch") findings.push(`AUTHORITY_STATE_MISMATCH:${authorityRef}`);
};

export const resolveRuntimeAuthorities = (input: Readonly<{
  events: readonly RuntimeLogEventV2[];
  freshRuns: ReadonlyMap<string, boolean>;
  resolver: RuntimeAuthorityResolver | undefined;
  findings: string[];
}>): ReadonlyMap<string, RuntimeLogEventV2> => {
  const selectedEvents = new Map<string, RuntimeLogEventV2>();
  for (const [authorityRef, candidates] of authorityCandidates(input.events)) {
    const selectedRun = selectedAuthorityRun(candidates, input.freshRuns);
    const runCount = new Set(candidates.map((event) => event.producerRunId)).size;
    if (runCount > 1 && !selectedRun) input.findings.push(`AUTHORITY_RECONCILIATION_PENDING:${authorityRef}`);
    const selected = lastAuthorityEvent(candidates, selectedRun);
    selectedEvents.set(authorityRef, selected);
    verifyAuthority(authorityRef, selected, input.resolver, input.findings);
  }
  return selectedEvents;
};
