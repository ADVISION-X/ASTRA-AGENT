import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type ExamBindingDeclaration = Readonly<{
  bindingId: string;
  examId: string;
  examRef: string;
  lawId: string;
  capabilityDomain: string;
  evidenceModes: readonly string[];
}>;

type Registry = Readonly<{ schemaVersion:number; laws:readonly RegistryLaw[] }>;
type RegistryLaw = Readonly<{
  lawId:string;
  capabilityDomain:string;
  enforcement:Readonly<{ examBindings:readonly Omit<ExamBindingDeclaration,'lawId'|'capabilityDomain'>[] }>;
}>;

export function compileExamRegistry(root = process.cwd()): ExamBindingDeclaration[] {
  const path = resolve(root, 'scripts/audit/generated/law-registry.generated.json');
  const registry = JSON.parse(readFileSync(path, 'utf8')) as Registry;
  if (registry.schemaVersion !== 4 || !Array.isArray(registry.laws)) throw new Error('EXAM_REGISTRY_INVALID');
  const declarations: ExamBindingDeclaration[] = registry.laws.flatMap((law) => law.enforcement.examBindings.map((binding: Omit<ExamBindingDeclaration,'lawId'|'capabilityDomain'>) => ({
    ...binding,
    lawId: law.lawId,
    capabilityDomain: law.capabilityDomain,
  }))).sort((left, right) => left.bindingId.localeCompare(right.bindingId));
  const identities = new Set<string>();
  for (const declaration of declarations) {
    if (identities.has(declaration.bindingId) || identities.has(declaration.examId)) throw new Error('EXAM_DECLARATION_DUPLICATE');
    identities.add(declaration.bindingId); identities.add(declaration.examId);
    const selector = declaration.examRef.split('#')[1]?.split('|') ?? [];
    if (selector.length !== 4 || selector[0] !== 'runExamBinding' || selector[2] !== declaration.lawId || !declaration.evidenceModes.includes(selector[3]!)) {
      throw new Error(`EXAM_DECLARATION_INVALID:${declaration.bindingId}`);
    }
  }
  return declarations;
}
