import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Law } from "../governance-contract.js";
import { fail, sha } from "../governance-runtime.js";
import { dynamicReceiptFileValid, examReceiptFileValid, parseQualityProofObservations, type QualityProofObservation, type QualityProofRequest } from "./proof-observation.js";

export type ProofRoute = { law: Law; mode: string };
const proofRequestIndex = (
  routes: readonly ProofRoute[], requests: readonly QualityProofRequest[],
): Readonly<{ expected: ReadonlySet<string>; byRoute: ReadonlyMap<string, QualityProofRequest> }> => {
  const expected = new Set(routes.map(({ law, mode }) => `${law.lawId}\0${mode}`));
  const byRoute = new Map(requests.map((request) => [`${request.lawId}\0${request.evidenceMode}`, request]));
  if (expected.size !== routes.length || byRoute.size !== requests.length || requests.length !== routes.length
    || [...expected].some((key) => !byRoute.has(key))) fail("LAW_EVIDENCE_MISSING", "native proof route request");
  return { expected, byRoute };
};
const nativeReceiptMatches = (locator: string, receipt: string, nativeReceiptDirectory: string): boolean => {
  const filePath = resolve(locator);
  const receiptRoot = resolve(nativeReceiptDirectory);
  if (filePath !== locator || dirname(filePath) !== receiptRoot || !existsSync(filePath) || !existsSync(receiptRoot)) return false;
  const rootStat = lstatSync(receiptRoot);
  const fileStat = lstatSync(filePath);
  return rootStat.isDirectory() && !rootStat.isSymbolicLink()
    && fileStat.isFile() && !fileStat.isSymbolicLink() && fileStat.size <= 16 * 1024 * 1024
    && sha(readFileSync(filePath)) === receipt;
};
const observationAuthenticatesRequest = (
  observation: QualityProofObservation, request: QualityProofRequest, kind: "exam" | "dynamic",
  nativeReceiptDirectory: string | null, script: string,
): boolean => {
  if (observation.proofRunId !== request.proofRunId || observation.candidate !== request.candidate
    || observation.proofKind !== request.proofKind || observation.proofKind !== kind) return false;
  if (nativeReceiptDirectory === null || observation.refs.length !== 1) return false;
  return observation.refs.every((reference) => {
    const match = new RegExp(`^${kind}:([^#@]+)#([^#@]+)@([a-f0-9]{64})$`, "u").exec(reference);
    if (!match) return false;
    let locator: string;
    let selector: string;
    try { locator = decodeURIComponent(match[1]!); selector = decodeURIComponent(match[2]!); } catch { return false; }
    const identity = `lawId=${request.lawId};mode=${request.evidenceMode};command=npm run ${script};`;
    const execution = `;run=${request.proofRunId};candidate=${request.candidate};`;
    const caseMarker = "case=";
    const runMarker = ";run=";
    const caseIndex = selector.indexOf(caseMarker);
    const runIndex = selector.indexOf(runMarker);
    const caseLocator = caseIndex >= 0 && runIndex > caseIndex
      ? selector.slice(caseIndex + caseMarker.length, runIndex) : "";
    const observedValueMarker = ";observedValue=";
    const observedValueIndex = selector.indexOf(observedValueMarker);
    const observedValue = observedValueIndex >= 0
      ? selector.slice(observedValueIndex + observedValueMarker.length) : "";
    return selector.startsWith(identity) && selector.includes(execution)
      && caseLocator.length > 0 && observedValue.length > 0
      && nativeReceiptMatches(locator, match[3]!, nativeReceiptDirectory)
      && (kind === "dynamic"
        ? dynamicReceiptFileValid(locator, {
          lawId: observation.lawId, evidenceMode: observation.evidenceMode, clauses: observation.clauses,
          observedValue, proofRunId: observation.proofRunId, candidate: observation.candidate,
          producerScript: script,
        })
        : examReceiptFileValid(locator, {
          lawId: observation.lawId, evidenceMode: observation.evidenceMode, clauses: observation.clauses,
          observedValue, caseLocator, proofRunId: observation.proofRunId, candidate: observation.candidate,
          producerScript: script,
        }));
  });
};
export const bindNativeProofObservations = (
  stdout: string,
  routes: readonly ProofRoute[],
  requests: readonly QualityProofRequest[],
  script: string,
  kind: "exam" | "dynamic",
  nativeReceiptDirectory: string | null = null,
): Map<string, QualityProofObservation> => {
  const index = proofRequestIndex(routes, requests);
  const bound = new Map<string, QualityProofObservation>();
  let observations: QualityProofObservation[];
  try { observations = parseQualityProofObservations(stdout); }
  catch { return fail("LAW_EVIDENCE_MISSING", "invalid native proof observation"); }
  const nativeLocators = new Set<string>();
  for (const observation of observations) {
    const key = `${observation.lawId}\0${observation.evidenceMode}`;
    if (!index.expected.has(key)) fail("LAW_EVIDENCE_UNEXPECTED", key.replace("\0", ":"));
    if (bound.has(key)) fail("LAW_EVIDENCE_DUPLICATE", key.replace("\0", ":"));
    const request = index.byRoute.get(key)!;
    if (!observationAuthenticatesRequest(observation, request, kind, nativeReceiptDirectory, script)) {
      fail("LAW_EVIDENCE_MISSING", `native-receipt-binding:${key.replace("\0", ":")}`);
    }
    {
      const locator = /^(?:dynamic|exam):([^#@]+)#/u.exec(observation.refs[0]!)?.[1];
      if (!locator) return fail("LAW_EVIDENCE_MISSING", `native-receipt-locator:${key.replace("\0", ":")}`);
      let decoded: string;
      try { decoded = decodeURIComponent(locator); } catch { return fail("LAW_EVIDENCE_MISSING", "native-receipt-locator"); }
      if (nativeLocators.has(decoded)) fail("LAW_EVIDENCE_DUPLICATE", `native-receipt-locator:${decoded}`);
      nativeLocators.add(decoded);
    }
    bound.set(key, observation);
  }
  return bound;
};
