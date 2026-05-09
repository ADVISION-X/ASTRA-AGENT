现在**不是卡死**，是已经失败终止了。

关键位置：

```txt
locate-comments-entry-target
childCapabilityId = observe-comments-button
abilityGroup = visual-target
```

失败原因：

```txt
Visual Target comments dispatch requires governed screenshot and AI proof mission/run identity.
```

日志最后明确写了：

```txt
MISSION_FAILED
Mission reached terminal status "failed" after step "locate-comments-entry-target"
```



## 通俗解释

这次流程已经走到这里了：

```txt
AI 已经判定是种草视频
→ 进入评论取证路线
→ 观察评论入口页面状态
→ AI 分析评论按钮候选
→ 准备让 Visual Target 定位评论按钮
→ 失败
```

也就是说，**大脑这次已经判 YES 了，不是产品识别失败。**

真正失败的是：

```txt
系统想找评论按钮，
但 Visual Target 要求：
“当前截图证明”和“AI 评论按钮候选证明”必须属于同一个 mission/run，
结果证据身份证对不上或缺失，
所以它拒绝继续。
```

## 对照代码，为什么会拦住？

最新代码里 `buildCommentsEntryVisualTargetCommand()` 明确检查：

```ts
const screenshotMissionId = readString(screenshotHandoff.sourceProof, "missionId");
const screenshotRunId = readString(screenshotHandoff.sourceProof, "runId");

if (!screenshotMissionId || !screenshotRunId || !aiSummary.missionId || !aiSummary.runId) {
  throw new Error("Visual Target comments dispatch requires governed screenshot and AI proof mission/run identity.");
}
```

也就是说，只要截图 proof 或 AI proof 里缺 `missionId/runId`，就会直接失败。

## 当前根因定性

不是：

```txt
启动失败
不是 AI 没启动
不是没识别到种草视频
不是键盘切换失败
不是评论按钮一定不存在
```

而是：

```txt
comments-entry-target-candidate-analysis
→ locate-comments-entry-target
```

这段 handoff 给 Visual Target 的证据链不完整。

更具体说：

```txt
AI 评论按钮候选 proof
和
当前截图 screenshot proof
没有形成同一个 mission/run/videoVisitId 下的绑定。
```

日志里失败 refs 还出现了：

```txt
task_start
```

这很可疑，说明 `locate-comments-entry-target` 可能拿到了泛化 ref，而不是专门的 comments target proof / screenshot proof。

## 不能怎么修

不要放宽 Visual Target 这个 gate。
这个拦截是对的。

如果放宽，就会变成：

```txt
没有确认截图和 AI 候选是不是同一轮，
就去定位评论按钮，
后面可能瞎点。
```

## 应该怎么修

给 Codex：

```txt
当前不是卡死，是 MISSION_FAILED。

成功点：
judge-seeding-video 已经进入 read-comments-and-save-evidence，说明产品视频 YES 已经识别成功。

失败点：
locate-comments-entry-target / observe-comments-button
failureReason:
Visual Target comments dispatch requires governed screenshot and AI proof mission/run identity.

请只修 comments target handoff：

1. 检查 analyze-comments-entry-target-candidate 的 AI output summary 是否写入：
   - missionId
   - runId
   - roundId
   - videoVisitId
   - aiResultRef
   - aiProofRef
   - aiInputArtifactRef
   - sourceScreenshotEvidenceId

2. 检查 locate-comments-entry-target 输入是否使用了正确 refs：
   - aiTargetCandidateRef
   - screenshotEvidenceRef
   - pageStateRef

3. 禁止使用 task_start / ask_ai_product_presence / startup ref 冒充 comments target proof。

4. Visual Target comments dispatch 必须拿到同一 mission/run/videoVisitId 下的：
   - governed screenshot proof
   - governed AI comments target candidate proof
   - governed pageState proof

5. 不要放宽 Visual Target identity gate。
   这是上游 proof handoff 错，不是 Visual Target 错。

6. 增加 audit：
   - locate-comments-entry-target 使用 task_start ref 必须 FAIL
   - comments AI candidate proof 缺 missionId/runId 必须 FAIL
   - screenshot proof 缺 missionId/runId 必须 FAIL
   - AI proof 与 screenshot proof mission/run 不一致必须 FAIL
   - 正确 comments candidate proof + screenshot proof 同源时必须 PASS
```

一句话：**这次大脑已经认出种草视频了，卡在“找评论按钮”前的证据身份证校验；评论按钮定位需要的截图 proof 和 AI proof 没有同源绑定。**
