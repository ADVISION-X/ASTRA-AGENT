import type { Mutation } from "./negative-proof-types.js";

const buildSection21Needle = (requirementId: string): string =>
  `Index standard-package blueprint section 2.1 must keep the exact line for ${requirementId}.`;

export const indexStandardPackagePrincipleMutations: Mutation[] = [
  {
    name: "index standard-package section21 req009 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "所有能力组必须统一成：",
    replace: "所有能力组可以继续保留不同包装：",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-009"),
  },
  {
    name: "index standard-package section21 req010 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "Ability Group Standard Package",
    replace: "Ability Group Freeform Package",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-010"),
  },
  {
    name: "index standard-package section21 req011 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── ability-group.ts",
    replace: "├── adapter.ts",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-011"),
  },
  {
    name: "index standard-package section21 req012 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── contract.ts",
    replace: "├── contracts.ts",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-012"),
  },
  {
    name: "index standard-package section21 req013 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── schema.ts",
    replace: "├── schema-base.ts",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-013"),
  },
  {
    name: "index standard-package section21 req014 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── registry.ts",
    replace: "├── catalog.ts",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-014"),
  },
  {
    name: "index standard-package section21 req015 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── index.ts",
    replace: "├── main.ts",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-015"),
  },
  {
    name: "index standard-package section21 req016 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── runtime/",
    replace: "├── runtime-helpers/",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-016"),
  },
  {
    name: "index standard-package section21 req017 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── children/",
    replace: "├── child-helpers/",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-017"),
  },
  {
    name: "index standard-package section21 req018 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── ports/",
    replace: "├── gateways/",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-018"),
  },
  {
    name: "index standard-package section21 req019 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "├── shared/",
    replace: "├── helpers/",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-019"),
  },
  {
    name: "index standard-package section21 req020 mutation",
    file: "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md",
    search: "└── audit domain inspector",
    replace: "└── optional audit notes",
    expectedNeedle: buildSection21Needle("K02-BLUEPRINT-02-SECTION-010-REQ-020"),
  },
  {
    name: "index standard-package req016 structure mutation",
    file: "src/capabilities/forensics-persistence/ability-group.ts",
    search: 'import { createForensicsExecutionContext, type CreateForensicsExecutionContextInput } from "./runtime/create-forensics-execution-context.js";',
    replace: 'import { createForensicsExecutionContext, type CreateForensicsExecutionContextInput } from "./shared/forensics-clock.js";',
    expectedNeedle: "Ability Group Standard Package requires forensics-persistence ability-group.ts to resolve runtime/ through the governed package structure.",
  },
  {
    name: "index standard-package req020 structure mutation",
    file: "scripts/audit/domains/forensics-persistence-capability/manifest.json",
    search: '  "entry": "scripts/audit/domains/forensics-persistence-capability/inspector.ts",',
    replace: '  "entry": "scripts/audit/domains/forensics-persistence-capability/run-inspector.ts",',
    expectedNeedle: "Ability Group Standard Package requires forensics-persistence to keep a governed audit domain inspector with manifest entry scripts/audit/domains/forensics-persistence-capability/inspector.ts.",
  },
];