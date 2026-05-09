import { Node } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { CHANNEL_IDS, LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

const AI_RUNTIME_POLICY_PATH = "src/capabilities/ai/runtime/local-ai-runtime-policy.ts";

type AiTransportSources = {
  aiRuntimePolicySource: NonNullable<ReturnType<typeof getSourceFile>>;
  registrySource: NonNullable<ReturnType<typeof getSourceFile>>;
};

const readNumericInitializer = (
  sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>,
  initializer: import("ts-morph").Expression | undefined,
): number | null => {
  if (!initializer) {
    return null;
  }
  if (Node.isNumericLiteral(initializer)) {
    return Number(initializer.getLiteralText());
  }
  if (Node.isIdentifier(initializer)) {
    const declaration = sourceTextOwner.getVariableDeclaration(initializer.getText());
    return readNumericInitializer(sourceTextOwner, declaration?.getInitializer());
  }
  return null;
};

const readObjectLiteralNumberProperty = (
  sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>,
  objectLiteral: import("ts-morph").ObjectLiteralExpression,
  propertyName: string,
): number | null => {
  const property = objectLiteral.getProperty(propertyName);
  return Node.isPropertyAssignment(property)
    ? readNumericInitializer(sourceTextOwner, property.getInitializer())
    : null;
};

const readRegistryChannelObject = (
  sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>,
  channelId: string,
): import("ts-morph").ObjectLiteralExpression | null => {
  const registry = sourceTextOwner.getVariableDeclaration("NERVE_BUS_CHANNEL_REGISTRY");
  const initializer = registry?.getInitializer();
  if (!Node.isCallExpression(initializer)) {
    return null;
  }

  const registryObject = initializer.getArguments().find(Node.isObjectLiteralExpression);
  const channelProperty = registryObject?.getProperty(`"${channelId}"`);
  if (!Node.isPropertyAssignment(channelProperty)) {
    return null;
  }

  const channelInitializer = channelProperty.getInitializer();
  return Node.isCallExpression(channelInitializer)
    ? channelInitializer.getArguments().find(Node.isObjectLiteralExpression) ?? null
    : null;
};

const readMaxAiRuntimeTimeoutMs = (sourceTextOwner: NonNullable<ReturnType<typeof getSourceFile>>): number | null => {
  const timeoutRecord = sourceTextOwner.getVariableDeclaration("AI_RUNTIME_TIMEOUT_BY_TASK_MS");
  const initializer = timeoutRecord?.getInitializer();
  if (!Node.isObjectLiteralExpression(initializer)) {
    return null;
  }

  const values = initializer.getProperties().flatMap((property) => {
    if (!Node.isPropertyAssignment(property)) {
      return [];
    }

    const value = readNumericInitializer(sourceTextOwner, property.getInitializer());
    return value === null ? [] : [value];
  });
  return values.length > 0 ? Math.max(...values) : null;
};

function collectSchemaChannelIdFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const schemaFoundationSource = getSourceFile(project, `${PATHS.ROOT}/schema-foundation.schema.ts`);
  const schemaFoundationText = schemaFoundationSource?.getFullText() ?? "";
  return CHANNEL_IDS.every((channelId) => schemaFoundationText.includes(`"${channelId}"`))
    ? []
    : [createFinding({ lawId: LAW_IDS.CHANNELS, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Nerve Bus schema channel ids must match the canonical six-channel registry." })];
}

function collectRegistryChannelFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  if (!registrySource || !registrySource.getVariableDeclaration("NERVE_BUS_CHANNEL_REGISTRY")) {
    return [createFinding({ lawId: LAW_IDS.CHANNELS, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Nerve Bus registry must declare the canonical channel registry." })];
  }

  return CHANNEL_IDS
    .filter((channelId) => !registrySource.getFullText().includes(`"${channelId}"`))
    .map((channelId) => createFinding({ lawId: LAW_IDS.CHANNELS, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: `Nerve Bus registry is missing channel ${channelId}.` }));
}

const resolveAiTransportSources = (project: ReturnType<typeof makeProject>): AiTransportSources | null => {
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  const aiRuntimePolicySource = getSourceFile(project, AI_RUNTIME_POLICY_PATH);
  return registrySource && aiRuntimePolicySource
    ? { aiRuntimePolicySource, registrySource }
    : null;
};

const hasEnoughAiTransportBudget = ({ aiRuntimePolicySource, registrySource }: AiTransportSources): boolean => {
  const maxAiRuntimeTimeoutMs = readMaxAiRuntimeTimeoutMs(aiRuntimePolicySource);
  const orchestrationToAi = readRegistryChannelObject(registrySource, "orchestration-to-ai");
  const aiToOrchestration = readRegistryChannelObject(registrySource, "ai-to-orchestration");
  const orchestrationToAiMaxDurationMs = orchestrationToAi ? readObjectLiteralNumberProperty(registrySource, orchestrationToAi, "maxDurationMs") : null;
  const aiToOrchestrationMaxDurationMs = aiToOrchestration ? readObjectLiteralNumberProperty(registrySource, aiToOrchestration, "maxDurationMs") : null;
  const requiredAiTransportDurationMs = maxAiRuntimeTimeoutMs === null ? null : maxAiRuntimeTimeoutMs + 15_000;
  return requiredAiTransportDurationMs !== null
    && orchestrationToAiMaxDurationMs !== null
    && aiToOrchestrationMaxDurationMs !== null
    && orchestrationToAiMaxDurationMs >= requiredAiTransportDurationMs
    && aiToOrchestrationMaxDurationMs >= requiredAiTransportDurationMs;
};

const createAiTransportTimeoutFinding = (): Finding =>
  createFinding({
    lawId: LAW_IDS.AI,
    file: PATHS.REGISTRY,
    line: 1,
    severity: "fatal",
    message: "Nerve Bus AI channels must have maxDurationMs at least 15000ms above the longest governed AI runtime timeout, so map execution cannot abort before local AI emits request/response/error debug proof.",
  });

function collectAiTransportTimeoutFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const sources = resolveAiTransportSources(project);
  if (!sources) {
    return [createFinding({ lawId: LAW_IDS.AI, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Nerve Bus AI transport timeout audit requires both the channel registry and AI runtime timeout policy source." })];
  }

  return hasEnoughAiTransportBudget(sources)
    ? []
    : [createAiTransportTimeoutFinding()];
}

export function collectChannelAndRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return [
    ...collectSchemaChannelIdFindings(project),
    ...collectRegistryChannelFindings(project),
    ...collectAiTransportTimeoutFindings(project),
  ];
}