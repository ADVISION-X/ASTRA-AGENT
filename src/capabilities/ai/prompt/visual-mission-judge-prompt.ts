import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import type { PlatformProfile } from "../../../platforms/platform-profile.schema.js";
import { getPlatformProfile } from "../../../platforms/platform-registry.js";
import type { VisualMissionActionPlanRequestInput } from "../../../types/visual-mission-action-plan.js";

function resolvePlatformProfile(input: VisualMissionActionPlanRequestInput): PlatformProfile {
  const platformId = (input.platformContext as { platformId?: string } | null)?.platformId ?? "facebook-web";
  const profile = getPlatformProfile(platformId as Parameters<typeof getPlatformProfile>[0]);
  if (!profile) throw new Error(`No platform profile registered for platformId: ${platformId}`);
  return profile;
}

function buildContinuitySection(input: VisualMissionActionPlanRequestInput): string {
  if (!input.roundMissionPacket) return "任务连续性包: 无";
  return [
    `连续性引用: ${input.roundMissionPacketRef ?? "无"}`,
    `连续性数据:\n${JSON.stringify(input.roundMissionPacket, null, 2)}`,
  ].join("\n");
}

const SYSTEM_PROMPT = `
# 你是谁

你是 GrassEye 的视觉指挥 AI。

每一轮你只接收当前截图、坐标图、用户目标、能力登记册和少量连续性信息。你的任务是判断当前画面是否满足用户目标，并选择一个下一步原子动作，或结束、要求人工复核、阻塞停止。

你不执行动作。
你不保存证据。
你不输出能力 owner。
你不输出 raw 坐标。
你不输出 DOM selector。
你不输出 browser command。
你不编排多个动作。

仅返回一个合法 JSON 对象。不加 markdown 围栏、不加注释、不加多余文字。

---

# 图片说明

| 编号  | 内容                              | 用途                                                        |
|-------|-----------------------------------|------------------------------------------------------------|
| 图片1 | 当前视口原始截图                   | 判断当前画面是否满足用户目标                                |
| 图片2 | 坐标网格截图（含网格行列标签）      | 选择 gridCell 的唯一来源                                    |
| 图片3 | 可选时序上下文帧（较早帧）          | 仅在画面模糊时辅助视觉判断                                  |
| 图片4 | 可选时序上下文帧（较晚帧）          | 仅在画面模糊时辅助视觉判断                                  |
| 图片5 | cellZone 精确定位参考图             | 仅用于理解九宫格 cellZone 名称，不参与目标判断              |

坐标使用规则：
- gridCell 必须且只能从图片2读取
- cellZone 使用下划线格式，例如 middle_center
- 图片1用于目标判断；图片2用于动作定位
- 禁止输出 raw x/y/clientX/clientY

---

# 输出格式

返回一个平铺 JSON 对象，字段如下（不得添加额外字段）：

{
  "schemaVersion": "pureVisualRound.v1",
  "goalMatched": boolean,
  "save": boolean,
  "saveReason": string,
  "confidence": number,
  "visualEvidence": string[],
  "decision": "act" | "done" | "review_required" | "blocked",
  "nextAction": {
    "actionCode": string,
    "reason": string,
    "input": object,
    "gridCell": string | null,
    "cellZone": string | null
  } | null,
  "reviewRequiredReason": string | null,
  "doneReason": string | null
}

硬规则：
1. goalMatched 表示当前画面是否满足用户目标
2. goalMatched=true 时 save 必须 true
3. goalMatched=false 时 save 默认 false
4. save=true 只代表请求系统保存当前轮视觉证据；你不得输出任何取证 payload
5. decision=act 时必须填写 nextAction，否则 nextAction 必须为 null
6. 每轮最多一个 nextAction
7. nextAction.actionCode 必须精确复制自子能力清单
8. 点击动作必须包含 input.gridCell 或 gridCell
9. visualEvidence 至少 1 条，只写你在画面里真实看见的证据
10. 无法判断、不安全或坐标不清楚时，使用 review_required 或 blocked
`.trim();

function buildPlatformSection(profile: PlatformProfile): string {
  return [
    `平台标识: ${profile.platformId}`,
    `平台名称: ${profile.displayName}`,
    `入口 URL: ${profile.entryUrl}`,
    `目标标题: ${profile.targetTitle}`,
    `允许 host: ${profile.allowedHosts.join(" | ")}`,
    "",
    "本平台可用的原子动作 actionCode（只能从此列表选）：",
    profile.supportedAtomicActionCodes.join(" | "),
    ...(profile.visualNotes ? ["", `视觉备注: ${profile.visualNotes}`] : []),
  ].join("\n");
}

function buildUserPrompt(input: VisualMissionActionPlanRequestInput): string {
  const manual = buildMuscleMemorySystemManual();
  const profile = resolvePlatformProfile(input);

  return [
    "# 用户目标",
    "",
    input.userRequirementText,
    "",
    "## 当前运行平台",
    buildPlatformSection(profile),
    "",
    "## 任务连续性包",
    buildContinuitySection(input),
    "",
    "## 当前轮视觉证据引用",
    `原始截图引用: ${input.originalScreenshotRef}`,
    `坐标网格截图引用: ${input.coordinateGridScreenshotRef}`,
    `网格规格引用: ${input.gridSpecRef}`,
    "",
    "---",
    "",
    "# 子能力清单",
    "",
    `系统手册引用: ${manual.systemManualRef}`,
    `目录版本: ${manual.catalogVersion}`,
    "",
    manual.text,
    "",
    "选择规则：",
    "1. actionCode 精确复制，禁止自造",
    "2. 必须填写 aiRequiredInput 中列出的全部字段",
    "3. 禁止填写 forbiddenInput 中的任何字段",
    "4. 有候选值的字段只能从候选值中选",
    "",
    `输出协议引用: ${input.outputSchemaRef}`,
  ].join("\n");
}

function buildVisualMissionJudgePrompt(input: VisualMissionActionPlanRequestInput) {
  const userPrompt = buildUserPrompt(input);
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    fullPrompt: [SYSTEM_PROMPT, userPrompt].join("\n\n"),
  };
}

export { buildVisualMissionJudgePrompt };
