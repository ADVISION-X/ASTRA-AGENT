明白。现在专门设计 **Visual Target 定位能力强化方案**。
核心原则：**不扩大系统，不新增大链路，不让 Visual Target 越权点击，只把“眼睛”练准。**

我刚核了最新 `main`，现在 Visual Target 已经开始补强化：`stage-runners` 已经插入 `validateCandidateStructure` 和 `validateCandidateConfidence`；`candidate-readiness-gate` 已经开始做结构门和低置信度门；`target-selection-gate` 已经从“选第一个”升级为按 confidence、stale、dataQuality、source penalty 排序；`visual-target-policy` 也已有 `minimumScore` 和 `selectionWindow`。   

所以这次不是重建，而是在现有骨架上做 **交付级加固**。

# 总设计：一条定位链，四道铁门

```txt
输入证据门
→ 候选结构门
→ 候选评分门
→ 输出边界门
```

Visual Target 只做一件事：

```txt
把 AI / Page State / Screenshot 提供的候选目标，
变成一个可交给 Geometry Guard 的结构化定位结果。
```

它不点击，不判断业务成功，不决定值不值得操作。

---

# 四方攻击模型

## 攻击一：AI 乱报候选

风险：

```txt
AI 幻觉出一个不存在的按钮
AI 把评论按钮看成分享按钮
AI 返回低置信度候选
AI 返回多个模糊候选
```

防御：

```txt
1. AI proof 必须存在。
2. promptContractId / outputSchemaRef 必须在白名单。
3. candidate.targetType 必须匹配当前 childCapabilityId 的 profile。
4. confidence 低于 profile.minimumScore，直接 review_required。
5. 多候选如果分数差低于 selectionWindow，不强行选，review_required。
```

当前已有一部分：`visual-target-policy.ts` 已定义每个 child 的 `minimumScore`、`selectionWindow`、`targetType`、`targetNature`、`requiredObservationKinds`。

还要补强：**requiredObservationKinds 必须真正参与候选校验**，不能只是 profile 里写着。

---

## 攻击二：坐标污染

风险：

```txt
候选 bbox 越界
clickPoint 缺失
clickPoint 不在 bbox 内
source_image / ai_input / desktop_screen 没正确映射
viewport 变化后继续用旧坐标
```

防御：

```txt
1. bbox width/height 必须 > 0。
2. action target 必须有 clickPoint。
3. region/metric target 不允许携带裸 clickPoint。
4. clickPoint 必须在 bbox 内。
5. coordinateSpace 必须在 profile.allowedCoordinateSpaces 内。
6. 非 browser_viewport 坐标必须带 scaleMapping / transform proof。
7. 只输出 geometryGuardHandoff，不输出可执行点击。
```

当前已有一部分：`candidate-readiness-gate.ts` 已经检查 bbox、clickPoint、低置信度。

还要补强：**clickPoint 是否落在 bbox 内**，以及 **映射坐标必须带 mapping proof**。

---

## 攻击三：证据错配

风险：

```txt
候选来自旧截图
AI 结果来自上一轮
Page State 和截图不是同一个 videoVisitId
roundId / videoVisitId 不一致
payload 混入旧 ref
```

防御：

```txt
1. screenshotProof、aiProof、pageStateProof 必须同时存在。
2. 三者 missionId / runId / roundId / videoVisitId 必须一致。
3. candidate.sourceScreenshotEvidenceRef 必须等于当前 request.sourceProof.screenshot。
4. stale_screenshot / stale_candidate 不能只是扣分，严重时必须 review_required。
5. candidateSetHash 必须进入 telemetry，方便复盘。
```

当前 Stage Runner 已经有 screenshot、AI、page-state gate 顺序。

还要补强：**跨 proof 的 identity binding**，也就是三份证据必须属于同一轮、同一个 videoVisitId。

---

## 攻击四：下游绕过

风险：

```txt
Geometry Guard 直接吃裸 clickPoint
Mouse Click 绕过 Visual Target output
Route Plan 直接塞 sourceTargetRef
summary 里反解析 bbox/clickPoint
机械成功被当成定位成功
```

防御：

```txt
1. Visual Target 输出只能是 public output + geometryGuardHandoff。
2. Geometry Guard 只能接收 geometryGuardHandoffRef，不接收裸 clickPoint。
3. Mouse Click 只能接收 Geometry Guard proof。
4. Visual Target success 不代表可以点击。
5. Mouse Click success 不代表业务成功。
6. 所有绕过 handoff 的路径 audit fail。
```

这条很关键。之前 `workbench-visual-dispatch-input-next-item.ts` 这种从 summary 反读 bbox/clickPoint 的方式，就是定位能力不成熟时的典型风险。现在下一个视频已经改键盘，后续评论按钮等动作也要禁止这种绕行。

---

# 最小强化路线

## 第一阶段：把现有门补完整

当前已经有：

```txt
validateCandidateStructure
validateCandidateConfidence
rankCandidates
selectionWindow
outputBoundary
```

下一步只补 5 个最小点：

```txt
1. clickPoint 必须在 bbox 内。
2. 非 browser_viewport 坐标必须有 mapping proof。
3. requiredObservationKinds 必须和 candidate.observationKind / targetType 绑定。
4. screenshot / AI / pageState 的 roundId、videoVisitId 必须一致。
5. critical flags 不得只扣分，必须 block 或 review_required。
```

这不是增加复杂度，是把门补严。

---

## 第二阶段：评分逻辑保持简单

不要搞复杂模型。只用一个可解释公式：

```txt
finalScore =
confidence
- stalePenalty
- dataQualityPenalty
- sourcePenalty
- mappingPenalty
```

当前 `target-selection-gate.ts` 已经这样做了：按 stale、dataQuality、source penalty 计算 finalScore，再用 selectionWindow 判断是否模糊。

继续保持，不要引入 AI 二次判断。

---

## 第三阶段：输出只分三种

Visual Target 最终只能返回三种结果：

```txt
success
review_required
failed
```

规则：

```txt
success：
只有一个高置信度、结构完整、证据一致、可 handoff 的候选。

review_required：
候选存在，但置信度不足、多个候选差距太小、证据轻微漂移。

failed：
没有候选、bbox 越界、proof 缺失、targetType 错、coordinateSpace 非法。
```

这符合大道至简。

---

# 不要做的事

```txt
不要让 Visual Target 点击。
不要让 Visual Target 判断是否进入下一条视频。
不要让 Visual Target 判断产品价值。
不要让 Visual Target 直接调用 Mouse Click。
不要搞多套定位系统。
不要让 Geometry Guard 自己猜目标。
不要让 Route Plan 写坐标细节。
不要把低置信度候选硬选出来继续点。
```

Visual Target 是眼睛，不是手，不是大脑。

---

# 执法必须补的防复发

新增或强化 inspector：

```txt
1. Visual Target success output 必须包含：
   sourceScreenshotEvidenceId
   sourceScreenshotProofRef
   sourceAiResultRef / sourceAiProofRef
   sourcePageStateProofRef
   coordinateSpace
   boundingBox
   confidence
   geometryGuardHandoffRef

2. action target 必须有 candidateClickPoint。
3. region / metric target 不得有 candidateClickPoint。
4. confidence < profile.minimumScore 必须 review_required。
5. 多候选 score gap < selectionWindow 必须 review_required。
6. Geometry Guard 不得接收裸 clickPoint。
7. Mouse Click 不得直接接收 Visual Target 原始 clickPoint。
8. summary 反解析 bbox/clickPoint 的代码必须 FAIL。
9. requiredObservationKinds 不匹配必须 FAIL。
10. proof identity 不一致必须 FAIL。
```

---

# 负向证明设计

让 Codex 必须加这些 mutation：

```txt
1. 删除 bbox → audit 必须 FAIL。
2. clickPoint 放到 bbox 外 → audit 必须 FAIL。
3. confidence 改成 0.4 → runtime 必须 review_required。
4. 两个候选分数差小于 selectionWindow → runtime 必须 review_required。
5. candidate.targetType 与 child profile 不一致 → FAIL。
6. sourceScreenshotEvidenceRef 换成旧截图 → FAIL。
7. coordinateSpace 改成 source_image 但不给 mapping proof → FAIL。
8. Geometry Guard 直接吃 clickPoint，不走 geometryGuardHandoff → FAIL。
9. Mouse Click 直接吃 Visual Target output，不走 Geometry Guard proof → FAIL。
10. 把 low_confidence 只当 penalty 不封死 → FAIL。
```

---

# 最终施工顺序

```txt
1. 补 candidate-readiness-gate：
   clickPoint in bbox
   coordinate mapping proof
   requiredObservationKinds binding

2. 补 proof consistency gate：
   screenshot / AI / pageState / candidate 的 missionId、roundId、videoVisitId 绑定

3. 补 selection gate：
   保持当前 scoring，不复杂化
   只强化 selectionWindow 的 review_required 证明

4. 补 output boundary：
   success output 必须有完整 handoff
   禁止裸 clickPoint 外泄为可执行动作

5. 补 inspectors + negative proof
```

---

# 给 Codex 的精准提示词

```txt
现在专门强化 Visual Target 定位能力，不要改下一视频键盘链路，不要新增复杂系统。

当前 main 已有基础：
- visual-target-execution-stage-runners.ts 已加入 validateCandidateStructure / validateCandidateConfidence。
- candidate-readiness-gate.ts 已做 bbox、clickPoint、low confidence 初步门。
- target-selection-gate.ts 已按 confidence - stalePenalty - dataQualityPenalty - sourcePenalty 排序。
- visual-target-policy.ts 已定义 minimumScore、selectionWindow、targetNature、requireClickPoint、allowedCoordinateSpaces。

请在现有骨架上做交付级加固：

1. Candidate structure gate 增强：
   - bbox width/height 必须 > 0。
   - action target 必须有 clickPoint。
   - region/metric target 不得有 clickPoint。
   - clickPoint 必须落在 bbox 内。
   - 缺 bbox / clickPoint 越界 / 裸 clickPoint 错用必须 FAIL 或 review_required。

2. Coordinate proof 增强：
   - coordinateSpace 必须在 profile.allowedCoordinateSpaces。
   - 非 browser_viewport 坐标必须有 mapping / scale proof。
   - candidate_coordinate_requires_mapping 不能只扣分，缺 proof 必须 review_required 或 FAIL。

3. Proof identity 增强：
   - screenshotProof、aiProof、pageStateProof、candidate source 必须绑定同一 missionId / runId / roundId / videoVisitId。
   - stale_screenshot / stale_candidate / sourceScreenshotEvidenceRef 不一致必须 review_required 或 FAIL。

4. Target semantic binding：
   - candidate targetType / observationKind 必须匹配 profile.requiredObservationKinds。
   - observe-comments-button 只能输出 comments_button。
   - observe-close-comments-button 只能输出 close_comments_button。
   - observe-next-item-target-candidate 不再参与下一视频主链，但保留能力时也必须受 profile 约束。

5. Selection gate 保持大道至简：
   - 不引入复杂 AI 二次判断。
   - 保持 finalScore = confidence - penalties。
   - score gap < selectionWindow 必须 review_required。
   - 不得退回“永远选择第一个候选”。

6. Output boundary：
   - success output 必须包含 sourceScreenshotEvidenceId、sourceScreenshotProofRef、sourceAiResultRef/sourceAiProofRef、sourcePageStateProofRef、coordinateSpace、boundingBox、confidence、geometryGuardHandoffRef。
   - Visual Target 不得输出可执行点击，只能输出 geometryGuardHandoff。
   - Geometry Guard 只能消费 geometryGuardHandoff，不得消费裸 clickPoint。
   - Mouse Click 只能消费 Geometry Guard proof。

7. Inspector / negative proof：
   - 删除 bbox 必须 FAIL。
   - clickPoint outside bbox 必须 FAIL。
   - confidence below profile.minimumScore 必须 review_required。
   - two candidates within selectionWindow 必须 review_required。
   - targetType 与 profile 不匹配必须 FAIL。
   - sourceScreenshotEvidenceRef 与 request screenshot 不一致必须 FAIL。
   - source_image 坐标无 mapping proof 必须 FAIL。
   - Geometry Guard 裸吃 clickPoint 必须 FAIL。
   - selection gate 退回 input-order-first 必须 FAIL。

不要改下一视频键盘方案。
不要恢复 click-next-video-arrow。
不要让 Visual Target 点击。
不要让 Visual Target 做业务判断。
只强化定位能力本身。
```

一句话定性：**Visual Target 要练成“稳准的眼睛”，不是变成“会动手的大脑”。四方攻击下，只要证据错、结构错、坐标错、候选模糊，就宁可 review_required，也不能瞎给 Geometry Guard。**
