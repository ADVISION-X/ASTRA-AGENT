import { readdirSync } from "node:fs";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";

const allowedSrcRoots = new Set(["app", "mediator", "plugins", "capabilities", "lib", "types"]);
const allowedScriptRoots = new Set(["acceptance", "audit", "startup"]);

const collectUnexpectedRoots = (rootPath: string, allowedRoots: ReadonlySet<string>): string[] =>
  readdirSync(resolveFromRepo(rootPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !allowedRoots.has(entry.name))
    .map((entry) => `${rootPath}/${entry.name}`)
    .sort();

const pushUnexpectedRoots = (
  findings: InspectorFinding[],
  input: {
    lawId: string;
    rootPath: string;
    allowedRoots: ReadonlySet<string>;
    checkId: "architecture/allowed-src-root" | "architecture/allowed-script-root";
    messageSuffix: string;
  },
): void => {
  for (const unexpectedRoot of collectUnexpectedRoots(input.rootPath, input.allowedRoots)) {
    findings.push(
      createFinding({
        checkId: input.checkId,
        lawId: input.lawId,
        filePath: unexpectedRoot,
        message: `${unexpectedRoot} ${input.messageSuffix}`,
      }),
    );
  }
};

export const inspectRootAllowlist = (findings: InspectorFinding[], rootLawId: string): void => {
  pushUnexpectedRoots(findings, {
    lawId: rootLawId,
    rootPath: "src",
    allowedRoots: allowedSrcRoots,
    checkId: "architecture/allowed-src-root",
    messageSuffix: "is outside the approved src root allowlist.",
  });
  pushUnexpectedRoots(findings, {
    lawId: rootLawId,
    rootPath: "scripts",
    allowedRoots: allowedScriptRoots,
    checkId: "architecture/allowed-script-root",
    messageSuffix: "is outside the approved scripts root allowlist.",
  });
};