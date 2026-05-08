import type { Mutation } from "./negative-proof-mutations.js";

export const RUN_LIMIT_REQUIRED_MUTATION_NAMES = [
  "task template run limit ownership mutation",
] as const;

export const RUN_LIMIT_NEGATIVE_PROOF_MUTATIONS: Mutation[] = [
  {
    name: "task template run limit ownership mutation",
    file: "src/map-plugins/schema/task-template-package.schema.ts",
    search: "  version: z.string().min(1),\n  safetyLevel: z.string().min(1),\n",
    replace: "  version: z.string().min(1),\n  defaultRunLimit: z.object({\n    maxRounds: z.number().int().positive(),\n    maxMinutes: z.number().int().positive(),\n  }).strict(),\n  safetyLevel: z.string().min(1),\n",
  },
];