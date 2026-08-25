import { relative, resolve } from 'node:path';
import { Project } from 'ts-morph';
import { ROOT, fail, norm } from '../governance-runtime.js';
import { pathRole } from './governance-paths.js';

export type RoleConsumptionEdge = Readonly<{ consumer: string; consumed: string }>;

export function assertRoleConsumptionEdges(edges: readonly RoleConsumptionEdge[]): void {
  for (const edge of edges) {
    if (pathRole(edge.consumer) === 'PRODUCTION' && pathRole(edge.consumed) !== 'PRODUCTION') {
      fail('ROLE_ESCALATION_REQUIRED', `${edge.consumer}->${edge.consumed}`);
    }
  }
}

const repositoryModuleConsumptionEdges = (): RoleConsumptionEdge[] => {
  const project = new Project({ tsConfigFilePath: resolve(ROOT, 'tsconfig.json') });
  const repoPath = (absolute: string): string | null => {
    const path = norm(relative(ROOT, absolute));
    return path === '..' || path.startsWith('../') ? null : path;
  };
  return project.getSourceFiles().flatMap((sourceFile) => {
    const consumer = repoPath(sourceFile.getFilePath());
    if (!consumer || pathRole(consumer) !== 'PRODUCTION') return [];
    return [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()].flatMap((declaration) => {
      const target = declaration.getModuleSpecifierSourceFile();
      const consumed = target ? repoPath(target.getFilePath()) : null;
      return consumed ? [{ consumer, consumed }] : [];
    });
  });
};

export function verifyPathRoleEscalation(): void {
  assertRoleConsumptionEdges(repositoryModuleConsumptionEdges());
}
