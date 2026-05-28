import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export const inspectPackageScript = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const packagePath = "package.json";
  inspectedFiles.add(packagePath);
  const scripts = (JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  }).scripts ?? {};
  const acceptanceScript = scripts["acceptance:amazon-product-mining"];
  if (!acceptanceScript) {
    findings.push(createFinding({
      checkId: "amazon-mining/package-acceptance-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose acceptance:amazon-product-mining script.",
    }));
  }
  if (acceptanceScript && !acceptanceScript.includes("amazon-product-mining-app-shell.acceptance.ts")) {
    findings.push(createFinding({
      checkId: "amazon-mining/package-acceptance-script-app-ui",
      lawId,
      filePath: packagePath,
      message: "acceptance:amazon-product-mining must include amazon-product-mining-app-shell.acceptance.ts.",
    }));
  }
	  if (acceptanceScript && !acceptanceScript.includes("amazon-product-mining-package-zip.acceptance.ts")) {
	    findings.push(createFinding({
	      checkId: "amazon-mining/package-acceptance-script-package-zip",
	      lawId,
	      filePath: packagePath,
	      message: "acceptance:amazon-product-mining must include amazon-product-mining-package-zip.acceptance.ts.",
	    }));
	  }
	  if (acceptanceScript && !acceptanceScript.includes("amazon-product-mining-package-final-gate.acceptance.ts")) {
	    findings.push(createFinding({
	      checkId: "amazon-mining/package-acceptance-script-final-gate",
	      lawId,
	      filePath: packagePath,
	      message: "acceptance:amazon-product-mining must include the final package gate acceptance.",
	    }));
	  }
	  if (acceptanceScript && !acceptanceScript.includes("amazon-product-mining-production-attacks.acceptance.ts")) {
	    findings.push(createFinding({
	      checkId: "amazon-mining/package-acceptance-script-production-attacks",
	      lawId,
	      filePath: packagePath,
	      message: "acceptance:amazon-product-mining must include production extraction attack acceptance.",
	    }));
	  }
  if (scripts["audit:amazon-product-mining"] !== "node --import tsx scripts/audit/domains/amazon-product-mining/inspector.ts") {
    findings.push(createFinding({
      checkId: "amazon-mining/package-audit-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose audit:amazon-product-mining using the amazon inspector entrypoint.",
    }));
  }
  if (scripts["amazon-product-mining:package:fixture"] !== "node --import tsx scripts/acceptance/amazon-product-mining-package-fixture.ts") {
    findings.push(createFinding({
      checkId: "amazon-mining/package-fixture-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose amazon-product-mining:package:fixture for real package zip output.",
    }));
  }
};
