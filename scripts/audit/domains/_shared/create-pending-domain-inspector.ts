import path from "node:path";

import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase, finalizeInspectorResult, resolveClassification } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { DomainInspector, Finding, InspectionClassification, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { runDomainOwnerInspection } from "./owner-foundation-inspection.js";

const logDomain = (domain: string, message: string): void => {
  process.stdout.write(`  [${domain}] ${message}\n`);
};

type ExtraCheckResult = {
  findings?: Finding[];
  phases?: InspectorPhase[];
};

type PendingInspectorOptions = {
  inspector: string;
  inspectorId: string;
  capabilityDomain: string;
  inspectorEntry: string;
  ownedPaths: string[];
  pendingSummary: string;
  extraChecks?: (context: InspectorContext) => Promise<ExtraCheckResult>;
  cleanClassification?: InspectionClassification;
  cleanSummary?: string;
  implementedClassification?: InspectionClassification;
  implementedSummary?: string;
};

type PendingInspectorState = {
  findings: Finding[];
  phases: InspectorPhase[];
};

const ownedPathHasTrackedFiles = async (ownedPath: string): Promise<boolean> => {
  const absolutePath = pathFromRepoRoot(ownedPath);
  if (!(await fileExists(absolutePath))) {
    return false;
  }

  if (path.extname(ownedPath).length > 0) {
    return true;
  }

  const files = await listFilesRecursive(absolutePath, { extensions: [".ts", ".tsx", ".md", ".json"] });
  return files.length > 0;
};

const findOwnedPathExists = async (ownedPaths: string[]): Promise<boolean> => {
  const states = await Promise.all(ownedPaths.map((ownedPath) => ownedPathHasTrackedFiles(ownedPath)));
  return states.some(Boolean);
};

const resolveImplementationPhase = (
  options: PendingInspectorOptions,
  ownedPathExists: boolean,
): InspectorPhase => {
  const classification = ownedPathExists
    ? options.implementedClassification ?? "PASS"
    : options.cleanClassification ?? "ENFORCEMENT GAP";

  return createPhase(
    "implementation-window",
    classification,
    classification === "PASS",
    ownedPathExists
      ? options.implementedSummary ?? options.cleanSummary ?? "implemented owner surface exists and is ready for direct checks"
      : options.pendingSummary,
  );
};

const createPendingInspectorState = async (
  context: InspectorContext,
  options: PendingInspectorOptions,
): Promise<PendingInspectorState> => {
  logDomain(options.capabilityDomain, "checking owner-foundation...");
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: options.capabilityDomain,
    inspectorId: options.inspectorId,
    inspectorEntry: options.inspectorEntry,
  });
  logDomain(options.capabilityDomain, `owner-foundation → ${base.phases[0]?.classification ?? "PASS"}`);

  const phases = [...base.phases];
  logDomain(options.capabilityDomain, "checking owned paths...");
  const ownedPathExists = await findOwnedPathExists(options.ownedPaths);
  phases.push(resolveImplementationPhase(options, ownedPathExists));
  logDomain(options.capabilityDomain, `owned paths → ${ownedPathExists ? "implemented" : "pending"}`);

  return { findings: [...base.findings], phases };
};

const applyPendingInspectorExtraChecks = async (
  context: InspectorContext,
  options: PendingInspectorOptions,
  state: PendingInspectorState,
): Promise<void> => {
  if (!options.extraChecks) {
    return;
  }

  logDomain(options.capabilityDomain, "running extra checks...");
  const extra = await options.extraChecks(context);
  const extraPhases = extra.phases ?? [];
  const extraFindings = extra.findings ?? [];
  state.findings.push(...extraFindings);
  state.phases.push(...extraPhases);
  const failedPhase = extraPhases.find((phase) => phase.classification !== "PASS");
  logDomain(
    options.capabilityDomain,
    failedPhase
      ? `extra checks → ${failedPhase.classification} (${extraFindings.length} finding(s), ${extraPhases.length} phase(s))`
      : `extra checks → PASS (${extraPhases.length} phase(s))`,
  );
};

const finalizePendingInspector = (
  options: PendingInspectorOptions,
  state: PendingInspectorState,
) => {
  const classification = resolveClassification(state.findings, state.phases);
  const summary =
    state.phases.find((phase) => phase.classification !== "PASS")?.summary ??
    state.phases.at(-1)?.summary ??
    options.pendingSummary;

  return finalizeInspectorResult({
    inspector: options.inspector,
    inspectorId: options.inspectorId,
    capabilityDomain: options.capabilityDomain,
    findings: state.findings,
    phases: state.phases,
    classification,
    summary,
  });
};

export const createPendingDomainInspector = (options: PendingInspectorOptions): DomainInspector => {
  const inspector: DomainInspector = async (context) => {
    const state = await createPendingInspectorState(context, options);
    await applyPendingInspectorExtraChecks(context, options, state);
    return finalizePendingInspector(options, state);
  };

  return inspector;
};