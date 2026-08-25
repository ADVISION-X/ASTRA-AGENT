import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { Node, Project, SyntaxKind, type SourceFile } from 'ts-morph';
import { ROOT, fail, norm, repositoryPaths } from '../governance-runtime.js';
import { pathRole } from './governance-paths.js';

export type RoleConsumptionEdge = Readonly<{ consumer: string; consumed: string }>;

export function assertRoleConsumptionEdges(edges: readonly RoleConsumptionEdge[]): void {
  for (const edge of edges) {
    const consumedRole = pathRole(edge.consumed);
    if (pathRole(edge.consumer) === 'PRODUCTION' && (consumedRole === 'TEST_ONLY' || consumedRole === 'HISTORY_ONLY')) {
      fail('ROLE_ESCALATION_REQUIRED', `${edge.consumer}->${edge.consumed}`);
    }
  }
}

const moduleExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];
const repoPath = (absolute: string): string | null => {
  const path = norm(relative(ROOT, absolute));
  return path === '..' || path.startsWith('../') ? null : path;
};

const moduleCandidate = (consumer: string, specifier: string, paths: ReadonlySet<string>): string | null => {
  if (!specifier.startsWith('.')) return paths.has(specifier) ? specifier : null;
  const base = norm(relative(ROOT, resolve(ROOT, dirname(consumer), specifier)));
  const declaredExtension = moduleExtensions.find((extension) => base.endsWith(extension));
  const stem = declaredExtension ? base.slice(0, -declaredExtension.length) : base;
  for (const candidate of [base, ...moduleExtensions.map((extension) => `${stem}${extension}`),
    ...moduleExtensions.map((extension) => `${base}/index${extension}`)]) {
    if (paths.has(candidate)) return candidate;
  }
  return null;
};

const moduleEdges = (paths: readonly string[]): RoleConsumptionEdge[] => {
  const project = new Project({ tsConfigFilePath: resolve(ROOT, 'tsconfig.json') });
  const modules = paths.filter((path) => moduleExtensions.some((extension) => path.endsWith(extension)));
  const loaded = new Set(project.getSourceFiles().map((source) => repoPath(source.getFilePath())).filter((path): path is string => path !== null));
  for (const path of modules) if (!loaded.has(path)) project.addSourceFileAtPathIfExists(resolve(ROOT, path));
  const pathSet = new Set(paths);
  return project.getSourceFiles().flatMap((sourceFile) => {
    const consumer = repoPath(sourceFile.getFilePath());
    if (!consumer || pathRole(consumer) !== 'PRODUCTION') return [];
    const declarations = [...sourceFile.getImportDeclarations(), ...sourceFile.getExportDeclarations()].flatMap((declaration) => {
      const target = declaration.getModuleSpecifierSourceFile();
      const specifier = declaration.getModuleSpecifierValue();
      const consumed = (target ? repoPath(target.getFilePath()) : null)
        ?? (specifier ? moduleCandidate(consumer, specifier, pathSet) : null);
      return consumed ? [{ consumer, consumed }] : [];
    });
    const dynamic = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) return [];
      const argument = call.getArguments()[0];
      if (!argument || !Node.isStringLiteral(argument)) return [];
      const consumed = moduleCandidate(consumer, argument.getLiteralValue(), pathSet);
      return consumed ? [{ consumer, consumed }] : [];
    });
    return [...declarations, ...dynamic];
  });
};

const configurationPaths = (paths: readonly string[]): string[] => paths.filter((path) =>
  path === 'package.json' || path === 'tsconfig.json' || path === 'pnpm-workspace.yaml'
  || (path.startsWith('.vscode/') && path.endsWith('.json')));

const configurationEdges = (paths: readonly string[]): RoleConsumptionEdge[] => {
  const nonProduction = paths.filter((path) => pathRole(path) !== 'PRODUCTION');
  return configurationPaths(paths).flatMap((consumer) => {
    const source = readFileSync(resolve(ROOT, consumer), 'utf8');
    return nonProduction.filter((consumed) => source.includes(consumed)).map((consumed) => ({ consumer, consumed }));
  });
};

const filesystemCalls = new Set([
  'appendFile', 'appendFileSync', 'copyFile', 'copyFileSync', 'createReadStream', 'createWriteStream',
  'open', 'openSync', 'readFile', 'readFileSync', 'rename', 'renameSync', 'writeFile', 'writeFileSync',
]);

const literalRepositoryPath = (sourceFile: SourceFile, value: string, paths: ReadonlySet<string>): string | null => {
  const direct = norm(value);
  if (paths.has(direct)) return direct;
  const consumer = repoPath(sourceFile.getFilePath());
  if (!consumer) return null;
  const relativeToModule = norm(relative(ROOT, resolve(ROOT, dirname(consumer), value)));
  return paths.has(relativeToModule) ? relativeToModule : null;
};

const filesystemEdges = (paths: readonly string[]): RoleConsumptionEdge[] => {
  const pathSet = new Set(paths);
  const project = new Project({ tsConfigFilePath: resolve(ROOT, 'tsconfig.json') });
  const modules = paths.filter((path) => moduleExtensions.some((extension) => path.endsWith(extension)));
  const loaded = new Set(project.getSourceFiles().map((source) => repoPath(source.getFilePath())).filter((path): path is string => path !== null));
  for (const path of modules) if (!loaded.has(path)) project.addSourceFileAtPathIfExists(resolve(ROOT, path));
  return project.getSourceFiles().flatMap((sourceFile) => {
    const consumer = repoPath(sourceFile.getFilePath());
    if (!consumer || pathRole(consumer) !== 'PRODUCTION') return [];
    const boundFilesystemCalls = new Set(filesystemCalls);
    for (const declaration of sourceFile.getImportDeclarations()) {
      if (!['fs', 'node:fs'].includes(declaration.getModuleSpecifierValue())) continue;
      for (const named of declaration.getNamedImports()) {
        if (filesystemCalls.has(named.getName())) boundFilesystemCalls.add(named.getAliasNode()?.getText() ?? named.getName());
      }
    }
    return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
      const functionName = call.getExpression().getText().split('.').at(-1) ?? '';
      if (!boundFilesystemCalls.has(functionName)) return [];
      return call.getArguments().slice(0, 2).flatMap((argument) => argument.getDescendantsOfKind(SyntaxKind.StringLiteral)
        .concat(Node.isStringLiteral(argument) ? [argument] : [])
        .flatMap((literal) => {
          const consumed = literalRepositoryPath(sourceFile, literal.getLiteralValue(), pathSet);
          return consumed ? [{ consumer, consumed }] : [];
        }));
    });
  });
};

export const discoverRoleConsumptionEdges = (): RoleConsumptionEdge[] => {
  const paths = repositoryPaths();
  const edges = [...moduleEdges(paths), ...configurationEdges(paths), ...filesystemEdges(paths)];
  const unique = new Map(edges.map((edge) => [`${edge.consumer}\0${edge.consumed}`, edge]));
  return [...unique.values()].sort((left, right) => left.consumer.localeCompare(right.consumer)
    || left.consumed.localeCompare(right.consumed));
};

export function verifyPathRoleEscalation(): void {
  assertRoleConsumptionEdges(discoverRoleConsumptionEdges());
}
