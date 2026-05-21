import {
  domPublicFacade,
  domSchemaPath,
  requiredChildAbilities,
  requiredChildFunctionExports,
  requiredDetectedStates,
  requiredDomLawIds,
  requiredRuntimeFiles,
  requiredSnapshotFields,
  requiredTargetKinds,
} from "./dom-inspector-constants.js";
import {
  exportedNames,
  repoFileExists,
  runtimeExportNames,
  sourceFileByRepoPath,
  zEnumValues,
  zObjectPropertyNames,
  type DomFindingCollector,
} from "./dom-inspector-support.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import type { SourceFile } from "ts-morph";

const allowedMigrationFunctionExports = ["locateDomElementResultOnce"] as const;

const reportMissingSource = (
  collector: DomFindingCollector,
  lawId: string,
  repoPath: string,
): void => collector.push({
  checkId: "dom/source-file-missing",
  lawId,
  filePath: repoPath,
  message: `${repoPath} is missing from the DOM owner surface.`,
});

const inspectExactSet = (
  collector: DomFindingCollector,
  input: {
    actual: Set<string>;
    expected: readonly string[];
    checkId: string;
    lawId: string;
    filePath: string;
    label: string;
  },
): void => {
  for (const expected of input.expected) {
    if (input.actual.has(expected)) continue;
    collector.push({
      checkId: input.checkId,
      lawId: input.lawId,
      filePath: input.filePath,
      evidence: expected,
      message: `${input.label} is missing required value ${expected}.`,
    });
  }
};

const inspectGeneratedLawCoverage = (context: InspectorContext, collector: DomFindingCollector): void => {
  const lawIds = new Set(context.planEntry.lawIds);
  for (const lawId of requiredDomLawIds) {
    if (lawIds.has(lawId)) continue;
    collector.push({
      checkId: "dom/generated-law-coverage",
      lawId: context.planEntry.lawIds[0] ?? "APEX-DOM-013-V1",
      evidence: lawId,
      message: `Generated DOM plan does not include required DOM law ${lawId}.`,
    });
  }
};

const inspectSchemaContract = (schema: SourceFile, collector: DomFindingCollector): void => {
  inspectExactSet(collector, {
    actual: new Set(zEnumValues(schema, "DomAutomationChildCapabilityIdSchema")),
    expected: requiredChildAbilities,
    checkId: "dom/schema-child-ability-list",
    lawId: "APEX-DOM-013-V1",
    filePath: domSchemaPath,
    label: "DOM child ability schema",
  });
  inspectExactSet(collector, {
    actual: new Set(zEnumValues(schema, "DomTargetKindSchema")),
    expected: requiredTargetKinds,
    checkId: "dom/schema-target-kind-list",
    lawId: "APEX-DOM-005-V1",
    filePath: domSchemaPath,
    label: "DOM target-kind schema",
  });
  inspectExactSet(collector, {
    actual: new Set(zEnumValues(schema, "DomDetectedStateSchema")),
    expected: requiredDetectedStates,
    checkId: "dom/schema-detected-state-list",
    lawId: "APEX-DOM-004-V1",
    filePath: domSchemaPath,
    label: "DOM detected-state schema",
  });
  inspectExactSet(collector, {
    actual: zObjectPropertyNames(schema, "DomSnapshotSchema"),
    expected: requiredSnapshotFields,
    checkId: "dom/schema-snapshot-fields",
    lawId: "APEX-DOM-004-V1",
    filePath: domSchemaPath,
    label: "DOM snapshot schema",
  });
};

const inspectFacadeContract = (facade: SourceFile, collector: DomFindingCollector): void => {
  const publicExports = exportedNames(facade);
  const runtimeExports = runtimeExportNames(facade);
  inspectExactSet(collector, {
    actual: publicExports,
    expected: requiredChildFunctionExports,
    checkId: "dom/public-facade-child-export",
    lawId: "APEX-DOM-002-V1",
    filePath: domPublicFacade,
    label: "DOM public facade",
  });
  const allowedRuntimeExports = new Set<string>([...requiredChildFunctionExports, ...allowedMigrationFunctionExports]);
  for (const runtimeExport of runtimeExports) {
    if (allowedRuntimeExports.has(runtimeExport)) continue;
    collector.push({
      checkId: "dom/public-facade-unlawful-runtime-export",
      lawId: "APEX-DOM-002-V1",
      filePath: domPublicFacade,
      evidence: runtimeExport,
      message: `DOM public facade exports non-lawful runtime function ${runtimeExport}.`,
    });
  }
};

const inspectRuntimeFiles = (collector: DomFindingCollector): void => {
  for (const runtimeFile of requiredRuntimeFiles) {
    if (repoFileExists(runtimeFile)) continue;
    reportMissingSource(collector, "APEX-DOM-013-V1", runtimeFile);
  }
};

export const inspectDomContracts = (context: InspectorContext, collector: DomFindingCollector): void => {
  inspectGeneratedLawCoverage(context, collector);
  const schema = sourceFileByRepoPath(context.project, domSchemaPath);
  const facade = sourceFileByRepoPath(context.project, domPublicFacade);
  if (!schema) return reportMissingSource(collector, "APEX-DOM-013-V1", domSchemaPath);
  if (!facade) return reportMissingSource(collector, "APEX-DOM-013-V1", domPublicFacade);
  inspectSchemaContract(schema, collector);
  inspectFacadeContract(facade, collector);
  inspectRuntimeFiles(collector);
};
