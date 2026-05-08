import type { Mutation } from "./negative-proof-mutations.js";

export const RUN_LIMIT_REQUIRED_MUTATION_NAMES = [
  "task template defaultRunLimit ownership mutation",
  "task template maxAllowedRunLimit ownership mutation",
  "ordinary task feed exposes run-limit mutation",
  "ai draft package exposes run-limit mutation",
  "ai fallback draft exposes run-limit mutation",
] as const;

export const RUN_LIMIT_NEGATIVE_PROOF_MUTATIONS: Mutation[] = [
  {
    name: "task template defaultRunLimit ownership mutation",
    file: "src/map-plugins/schema/task-template-package.schema.ts",
    search: "  version: z.string().min(1),\n  safetyLevel: z.string().min(1),\n",
    replace: "  version: z.string().min(1),\n  defaultRunLimit: z.object({\n    maxRounds: z.number().int().positive(),\n    maxMinutes: z.number().int().positive(),\n  }).strict(),\n  safetyLevel: z.string().min(1),\n",
  },
  {
    name: "task template maxAllowedRunLimit ownership mutation",
    file: "src/map-plugins/schema/task-template-package.schema.ts",
    search: "  version: z.string().min(1),\n  safetyLevel: z.string().min(1),\n",
    replace: "  version: z.string().min(1),\n  maxAllowedRunLimit: z.object({\n    maxRounds: z.number().int().positive(),\n    maxMinutes: z.number().int().positive(),\n  }).strict(),\n  safetyLevel: z.string().min(1),\n",
  },
  {
    name: "ordinary task feed exposes run-limit mutation",
    file: "src/map-plugins/shared/map-package-registry-types.ts",
    search: "  version: string;\n  safetyLevel: string;\n",
    replace: "  version: string;\n  defaultRunLimit: { maxRounds: number; maxMinutes: number };\n  maxAllowedRunLimit: { maxRounds: number; maxMinutes: number };\n  safetyLevel: string;\n",
  },
  {
    name: "ai draft package exposes run-limit mutation",
    file: "src/map-plugins/authoring/map-authoring-ai-output.schema.ts",
    search: "  recommended: z.boolean().default(false),\n  safetyLevel: z.string().min(1),\n",
    replace: "  recommended: z.boolean().default(false),\n  defaultRunLimit: z.object({\n    maxRounds: z.number().int().positive(),\n    maxMinutes: z.number().int().positive(),\n  }).strict(),\n  maxAllowedRunLimit: z.object({\n    maxRounds: z.number().int().positive(),\n    maxMinutes: z.number().int().positive(),\n  }).strict(),\n  safetyLevel: z.string().min(1),\n",
  },
  {
    name: "ai fallback draft exposes run-limit mutation",
    file: "src/capabilities/ai/shared/ai-map-authoring-fallback.ts",
    search: "    userVisibleCapabilities: [\"Human review required\"],\n    humanGoal: \"\",\n",
    replace: "    userVisibleCapabilities: [\"Human review required\"],\n    defaultRunLimit: { maxRounds: 300, maxMinutes: 480 },\n    maxAllowedRunLimit: { maxRounds: 300, maxMinutes: 480 },\n    humanGoal: \"\",\n",
  },
];