## 文档状态

- status: archived / historical debugging analysis only
- 本文形成于 phase-four 向 phase-five 切换前后的分析阶段，含有 phase-04 storage / authority 样本，不是当前 phase-five final-delivery debugging authority。
- 当前 authority 以 Kernel / Index / active phase gate / generated runner-summary 为准。

结论很明确：**现在不是“卡死在启动”，也不是“AI 没起来”，更不是 Commander / Nerve Bus / Open / Forensics 主链崩了。**

真正卡死点是：

```txt
Orchestration 跑到地图步骤：
locate-next-item-target

调用能力组：
visual-target

子能力：
observe-next-item-target-candidate

失败原因：
input_schema_invalid:
sourceProof.ai.aiResultRef:String must contain at most 200 character(s)
```

日志里最后的硬失败就是 `CAPABILITY_CALL_FAILED`，随后 Orchestration 进入 `MISSION_FAILED`，失败都指向同一个原因：`sourceProof.ai.aiResultRef` 超过 200 字符。

---

# 一、按故事主链看，现在跑到了哪里

按照 GrassEye 故事情节：

```txt
人类提出任务
→ Commander 接单
→ Nerve Bus 传递
→ Orchestration 读地图
→ Open 打开页面
→ Screenshot / AI / Page State 形成证据
→ Visual Target 根据 AI 证据定位目标
→ Geometry Guard 校准
→ Mouse Scroll / Click 执行动作
→ Forensics 记忆落账
```

你的日志已经跑过了前半段：

```txt
启动成功
AI readiness 成功
map package readiness 成功
Commander Console 打开成功
human command validated
mission preflight passed
command accepted
open-facebook-reels success
capture-video-viewport success
AI page_preparation_judgment 成功
```

也就是说，**身体已经启动，神经已经通，地图已经选中，打开页面也成功了。**

卡在更后面：

```txt
AI 已经给出下一条视频/下一目标的候选判断
Orchestration 准备让 Visual Target 定位“下一条/下一目标”
Visual Target 收到输入
Visual Target schema gate 拒绝输入
Mission 失败
```

这和故事情节里的定位完全吻合：Visual Target 是“眼睛定位肌肉”，它不是大脑；AI 是大脑，但 AI 的判断结果必须以受治理 proof/ref 交给 Visual Target。故事情节里也明确：能力组是固定身体，AI 是大脑但不是皇帝，Nerve Bus 是神经，Forensics 是记忆。

---

# 二、根因不是 Visual Target schema 错

仓库里 `visual-target/schema.ts` 明确规定：

```ts
const limitedString = (max: number) => z.string().min(1).max(max);

const VisualTargetAiSourceProofSchema = z.object({
  aiResultRef: limitedString(200),
  aiProofRef: limitedString(200),
  ...
})
```

所以 `sourceProof.ai.aiResultRef` 最多 200 字符是 Visual Target 的输入契约。

这个限制是合理的。

为什么合理？因为 Visual Target 不能吃一整串长上下文链，它只应该拿到**短 ref / proof ref / hash ref**，然后根据 ref 去证明 AI 判断来源。否则 Visual Target 就会变成“半个 Forensics + 半个 Orchestration + 半个 AI”，这违反大道至简。

所以不要第一反应去把 `limitedString(200)` 改成 500、1000、2000。那是把问题扩大，不是解决问题。

---

# 三、真正根因：本地 runtime 把长 AI outputRef 当成 aiResultRef 塞给 Visual Target

关键文件是：

```txt
src/lib/local-runtime/workbench-visual-dispatch-input-next-item-target.ts
```

这里构造 next-item 的 Visual Target 输入。

代码里：

```ts
const aiTargetCandidateRef = resolveAiTargetCandidateRef(payload);
const aiSummary = resolveAiVisualTargetCandidateOutputSummary(aiTargetCandidateRef);
...
const governedAiResultRef = aiSummary.aiResultRef;
...
sourceProof: {
  ai: {
    aiResultRef: governedAiResultRef,
    aiProofRef: aiSummary.aiProofRef,
    ...
  }
}
```

也就是说，它把 `aiSummary.aiResultRef` 直接写进了 `sourceProof.ai.aiResultRef`。

再看 AI summary 的来源：

```txt
src/capabilities/ai/runtime/ai-output-summary-registry.ts
```

这里 `buildSummaryBase()` 直接把 `input.outputRef` 保存成：

```ts
aiResultRef: input.outputRef
```

也就是说，AI 的 `aiResultRef` 不是一个压缩后的短 ref，而是原始 outputRef。

而你这次运行里的 outputRef / command chain 非常长，里面包含：

```txt
commander_command_xxx
selectedMapId
runId
videoVisitId
step
capability
payload
...
```

最终导致：

```txt
sourceProof.ai.aiResultRef > 200 chars
```

然后 Visual Target schema gate 正确拒绝。

---

# 四、按大道至简判断：这里是“ref 设计错位”，不是业务流程错

这个问题本质不是 Facebook、不是真浏览器、不是 AI 模型、不是坐标识别。

它是一个非常典型的治理错位：

```txt
长链路追踪 ID
被当成短 proof ref 使用
```

大道至简下，应该是：

```txt
长链路上下文 → 留在 Forensics / Nerve Bus / Orchestration proof
短稳定 ref → 传给 Visual Target / Geometry Guard / Mouse Click
```

现在变成了：

```txt
AI outputRef 很长
→ AI summary 原样记录为 aiResultRef
→ Visual Target 输入原样承接
→ Visual Target schema 拦截
```

所以卡死根因可以一句话定义：

```txt
AI → Visual Target 的 proof handoff 没有做 compact ref / alias ref 收敛，导致 Orchestration 本地 runtime 把超长 AI outputRef 作为 aiResultRef 注入 Visual Target input，触发 Visual Target schema 200 字符上限。
```

---

# 五、owner 归属判断

按法案系统，不能乱归责。

## 直接触发失败的 owner

```txt
visual-target
```

因为 schema gate 是 Visual Target 拒绝的。

## 真正应该修的 owner

```txt
AI + Orchestration local runtime adapter + Visual Target handoff boundary
```

更精确地说：

```txt
AI summary registry 负责生成/保存 AI proof ref
local-runtime visual dispatch builder 负责把 AI proof handoff 成 Visual Target input
Visual Target 负责拒绝不合法输入
```

Visual Target 拒绝是对的；错在上游给了它不合规输入。

---

# 六、不要这样修

这几个修法都不符合大道至简：

```txt
1. 不要把 Visual Target aiResultRef max(200) 改大。
2. 不要让 Visual Target 自己截断 aiResultRef。
3. 不要让 Visual Target 接受长 command chain。
4. 不要让 Orchestration 绕过 schema。
5. 不要在 map 里补一堆临时 transition。
6. 不要让 Forensics 替 Visual Target 填字段。
```

尤其不能“简单把 200 改成 1000”。这会掩盖问题，并且把 ref 预算纪律打穿。

---

# 七、正确修法：在 AI summary / handoff 层生成 compact ref

最干净的修复是：

## 方案 A：AI summary registry 生成短 ref

在：

```txt
src/capabilities/ai/runtime/ai-output-summary-registry.ts
```

新增一个稳定短 ref，例如：

```ts
compactAiResultRef = `ai-result:${sha256(outputRef).slice(0, 24)}`
```

然后 summary 里同时保留：

```ts
aiResultRef: compactAiResultRef
rawOutputRef / outputRef: 原始长 ref
```

Visual Target 只吃：

```txt
aiResultRef = ai-result:xxxxxxxxxxxxxxxxxxxxxxxx
```

Forensics / debug / trace 仍保留原始长 outputRef。

这是最符合大道至简的：**短 ref 传递，长证据归档。**

---

## 方案 B：在 `workbench-visual-dispatch-input-next-item-target.ts` 做 handoff alias

这里已经有：

```ts
const buildCompactRef = (prefix: string, value: unknown) =>
  `${prefix}:${buildHash(value).slice(0, 24)}`;
```

所以也可以在这里把：

```ts
const governedAiResultRef = aiSummary.aiResultRef;
```

改成：

```ts
const governedAiResultRef =
  aiSummary.aiResultRef.length <= 200
    ? aiSummary.aiResultRef
    : buildCompactRef("ai-result", aiSummary.aiResultRef);
```

但这个方案要注意：不能只截短，还要保留映射关系，否则 Forensics 追不回原始 AI 输出。

所以更完整应是：

```txt
compactAiResultRef
→ originalAiResultRef
→ aiProofRef
→ outputPayloadHash
```

这个映射要进 AI summary registry 或 Forensics proof，而不是丢失。

---

# 八、顺手发现一个次级漂移：Forensics 存储路径还带 phase-04

日志里多次出现：

```txt
storageRef=/Users/nexgen/Library/Application Support/GrassEye/local-data/phase-04-full-enforcement/state.json
```

但当前仓库主权威已经是：

```txt
phase-05-final-delivery-debug
```

Kernel 也已经声明当前 phase 是 phase-five final-delivery debugging。

这个不是本次 mission fail 的直接原因，但它是一个治理漂移：

```txt
运行数据目录 / Forensics storage namespace 仍残留 phase-04
```

建议列为 P1，不要和当前 P0 混修。当前 P0 是 `aiResultRef` 过长。

---

# 九、最终判断

现在系统卡在这里：

```txt
地图运行到 locate-next-item-target
→ Orchestration 调 Visual Target
→ Visual Target 输入 schema 拦截
→ sourceProof.ai.aiResultRef 超过 200
→ Mission Failed
```

根因不是：

```txt
AI 模型没启动
Commander 接单失败
Nerve Bus 失败
Open 失败
Forensics 写账失败
Facebook 页面打不开
```

根因是：

```txt
AI proof handoff 的 ref 设计没有收敛；
长 outputRef 被当成短 aiResultRef 传给 Visual Target。
```

一句话修复纲领：

```txt
不要放宽 Visual Target schema；
要在 AI summary / local runtime handoff 边界生成 compact governed AI result ref，并保留 original outputRef → compact ref 的 Forensics 可追溯映射。
```

---

# 十、给 Codex 的最短修复提示词

```txt
当前 phase-05 runtime 卡死在 locate-next-item-target。日志失败为：
Visual Target rejected invalid input schema:
sourceProof.ai.aiResultRef:String must contain at most 200 character(s).

不要放宽 Visual Target schema，不要把 max(200) 改大。
根因是 AI → Visual Target handoff 把超长 AI outputRef 当成 aiResultRef 传入。

请修复：
1. 在 AI output summary 或 next-item visual dispatch handoff 层生成稳定 compact aiResultRef，例如 ai-result:<sha256(originalRef).slice(0,24)>。
2. Visual Target input 只接收 compact aiResultRef。
3. original long outputRef 必须保留在 proof/Forensics/summary 映射里，保证可追溯。
4. 修复文件优先：
   - src/capabilities/ai/runtime/ai-output-summary-registry.ts
   - src/lib/local-runtime/workbench-visual-dispatch-input-next-item-target.ts
5. 不得让 Visual Target 自己截断，不得绕过 schema，不得扩大 schema 字段上限。
6. 补 inspector/negative proof：构造超长 AI outputRef 时，runtime 必须传 compact ref，Visual Target schema 必须 PASS；删除 compact handoff 后 audit:visual-target 必须 FAIL。
7. 修复后运行：
   npm run audit:visual-target
   npm run grasseye:start
   再用 Facebook map 重跑，确认 mission 不再因 aiResultRef length failed。
```

当前第一刀就砍这里，别分散。
