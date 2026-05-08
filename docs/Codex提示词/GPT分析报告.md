结论先说清楚：

```txt
1. 这轮日志里，系统确实 0 个种草视频命中。
2. 但你肉眼看到好几个产品视频，所以这是“AI 产品识别漏判”，不是没有刷到产品视频。
3. 当前效率确实不可接受，但第一刀不应该降级功能，而是压缩重复链路、合并证据输入、减少重复 AI 调用。
```

---

# 一、一个种草视频都没有发现吗？

从日志看，`judge-seeding-video` 一共跑了 **7 次**，7 次全部走：

```txt
judge-seeding-video:skip-current-video
```

也就是系统层面判定：

```txt
product_no = 7
product_yes = 0
```

所以这轮运行没有进入：

```txt
observe-comments-entry-page-state
→ analyze-comments-entry-target-candidate
→ locate-comments-entry-target
→ click-comments-button
→ capture-comments-panel
→ write-seeding-evidence-record
```

也就没有真正写入任何种草视频 evidence packet。这个和你肉眼看到多个产品视频冲突，说明是识别口径/输入证据问题。

---

# 二、为什么会漏判产品视频？

## 1. 当前产品判断口径太严

当前产品判断 prompt 明确要求：

```txt
只有当画面中清楚显示具体产品被演示、展示、使用、开箱、比较、穿戴、手持、安装、组装、展示销售，才判 product_yes。
```

同时又明确：

```txt
如果证据模糊、局部、被遮挡、文字声称但产品不清楚、人在说话但产品不明显，就选 product_no。
```

也就是说，现在 AI 是“宁可漏掉，也不误判”。

这在早期防误判可以，但对“种草视频发现”太保守。真实种草视频经常是：

```txt
前几秒人在说话
产品一闪而过
产品在手里但不占画面中心
先讲痛点，再展示产品
有包装/工具/使用场景，但不是标准商品图
```

如果只看单张图，很容易被判成 `product_no`。

---

## 2. 当前输入很可能仍是单帧，不是多帧

当前 Route Plan 里，产品判断前的链路是：

```txt
capture-current-video-viewport
→ prepare-current-video-ai-input
→ judge-seeding-video
```

`prepare-current-video-ai-input` 的输入只有一个：

```txt
screenshotEvidenceRef
```

这说明每次产品判断核心上还是“一次截图 → 一次 AI 判断”。

但你的多帧施工图已经写得很清楚：产品存在性判断应该避免 opening frame、黑屏、字幕过场或延迟出镜主导结果；`contact sheet` 是优先输入模式，`single_frame_fallback` 只是输入不足时的诚实标记。

更关键的是，请求构造器里也写死了这个逻辑：

```txt
aiInputRefs.length > 1 → multi_image
否则 → single_frame_fallback
```

也就是说，如果当前只传一个 promptInputRef，AI 看到的就是单帧 fallback。

这就是第一大根因：

```txt
产品视频不是没出现，是产品出现的时间点没有被当前单帧捕捉到。
```

---

# 三、现在效率为什么这么低？

我按日志里的 `durationMs` 粗算了一下，这轮主要耗时是：

| 模块                                   |      次数 |       总耗时 |       平均 |
| ------------------------------------ | ------: | --------: | -------: |
| `judge-seeding-video` 产品判断 AI        |     7 次 | 约 105.6 秒 | 约 15.1 秒 |
| `verify-next-item-advanced` 下一条验证 AI | 6 次完整返回 |  约 69.8 秒 | 约 11.6 秒 |
| `startup-preparation` 启动判断 AI        |     1 次 |    约 21 秒 |   约 21 秒 |
| 截图类                                  |      多次 |    约 28 秒 |    1–6 秒 |
| `press-next-video-key`               |     7 次 |     约 6 秒 | 约 0.86 秒 |

也就是说，键盘切换现在不是瓶颈。瓶颈是：

```txt
AI 调用太多、太重、重复截图太多。
```

这轮能力调用总耗时约 238 秒，其中 AI 约 197 秒，占 80% 以上。

---

# 四、先不要降级功能，第一刀应该“压缩”

你说得对：现在先不要降级功能。不能为了快，把 AI 产品判断砍掉，也不能把种草识别变成非 AI 规则判断。

要做的是压缩：

```txt
同样功能
更少重复
更少 AI 次数
更高命中率
```

---

# 五、最高优先级压缩方案

## 压缩 1：把产品判断从单帧升级为“一次多帧 contact sheet”

不要做三次 AI。
不要让地图写 `3s/6s/10s`。
不要把采样脚本塞回地图。

正确做法：

```txt
Screenshot / ability owner 在一个视频内采 3 帧
→ 合成一个轻量 contact sheet
→ 一次 prepare-ai-input
→ 一次 product-presence AI
```

这样功能没有降级，反而更准。

目标从：

```txt
单帧截图 → AI 判断
```

改成：

```txt
3帧/多帧 contact sheet → AI 判断
```

这正好符合多帧施工图：多帧是 Screenshot、AI、Forensics 共享取证边界，不是独立 owner，也不应该回到地图里写死帧点。

这会同时解决两个问题：

```txt
1. 漏判降低。
2. 不增加 AI 次数，因为仍然是一轮视频一次 product AI。
```

---

## 压缩 2：复用“下一条验证截图”，不要再重复截图

当前下一条链路是：

```txt
press-next-video-key
→ capture-next-item-verification-viewport
→ prepare-next-item-verification-ai-input
→ verify-next-item-advanced
→ capture-current-video-viewport
→ prepare-current-video-ai-input
→ judge-seeding-video
```

这里有明显重复：

```txt
capture-next-item-verification-viewport 已经截到了新视频
后面又 capture-current-video-viewport 再截一次
```

当前代码里也能看到，`verify-next-item-advanced` 不管 advanced / not advanced，都会跳到 `capture-current-video-viewport`。

这应该压缩成：

```txt
press-next-video-key
→ capture-next-item-verification-viewport
→ verify / or lightweight confirm
→ 直接复用 nextItemVerificationEvidenceRef 作为 current video evidence
→ prepare-current-video-ai-input
→ judge-seeding-video
```

这不是降级，是消除重复取证。

---

## 压缩 3：`verify-next-item-advanced` 先不要每轮强制重 AI

现在每切一次下一条，都跑一次 `verify-next-item-advanced`，平均 11–12 秒。这个太重。

不降级的做法是：

```txt
先机械验证
如果机械验证明确成功，就不问 AI
如果机械验证不确定，再问 AI
```

机械验证可以是：

```txt
before/after screenshot hash
frame fingerprint
页面视频区域变化
videoVisitId / visible frame hash 变化
```

注意：这不是让非 AI 判断“是不是产品视频”。
它只判断：

```txt
画面是否变化，是否进入下一条。
```

产品识别仍然由 AI 做。

---

# 六、产品漏判的修复方向

现在最要紧的不是调 prompt 句子，而是先让 AI 看到正确证据。

## 第一层：输入证据修复

必须让 `judge-seeding-video` 的输入从：

```txt
single_frame_fallback
```

升级成：

```txt
multi_frame_contact_sheet 或 multi_image
```

并且日志里必须打印轻量摘要：

```txt
inputMode
sampledFrameCount
validFrameCount
fallbackReason
```

现在日志没有展示 AI 具体判定内容，只看到 `AI_RESPONSE_DEBUG` 和 diagnostic ref，看不到：

```txt
decision
routeLabel
confidence
reason
visibleProductTypes
evidenceObservations
```

所以现在无法复盘每个产品视频为什么被判 `product_no`。这个必须补，不暴露原图，只暴露 AI 结构化摘要。

## 第二层：产品判断口径微调

当前 prompt 的核心问题是：

```txt
ambiguous / partial → product_no
```

这会把很多种草视频早期画面打掉。

但我不建议改成宽松乱判。应该加一个更贴合种草场景的 YES 口径：

```txt
只要多帧中出现明确的商品实物、包装、工具、配件、使用前后对比、手持展示、安装/试用动作，即可 product_yes。
不要求标准商品图。
不要求完整展示全过程。
不判断是否值得采购。
```

仍然保持二元输出：

```txt
product_yes / product_no
```

不恢复 `product_uncertain`，否则路线又复杂。

---

# 七、当前最关键的两个 BUG 定性

## BUG 1：产品漏判

```txt
系统判定：7 个视频全部 skip-current-video。
用户观察：其中多个是产品视频。
根因倾向：产品判断输入过弱，当前实际仍偏单帧；prompt 又要求“清晰具体产品展示”，导致大量 false negative。
```

## BUG 2：效率低

```txt
当前每轮视频大约 30–45 秒。
AI 占主要耗时。
press-next-video-key 不是瓶颈。
主要浪费来自：
1. 产品判断 AI 每轮 15 秒；
2. 下一条验证 AI 每轮 11–12 秒；
3. 下一条验证截图后又重复 capture-current-video；
4. 全量结构日志和 Forensics 持久化也偏重。
```

---

# 八、给 Codex 的提示词

```txt
最新运行日志结论：

第一问题：
本轮 judge-seeding-video 共 7 次，全部 transition 到 judge-seeding-video:skip-current-video。
系统记录为 0 个 product_yes / 0 个种草视频 evidence packet。
但人工观察多个视频是产品视频，所以这是 product-presence false negative，不是没有刷到产品视频。

第二问题：
运行效率严重不可接受。
总能力耗时约 238s，其中 AI 约 197s，占 80%+。
press-next-video-key 平均 <1s，不是瓶颈。
瓶颈是产品判断 AI、下一条验证 AI、重复截图和重日志。

不要降级功能。先做压缩优化。

修复方向：

1. 产品判断输入升级为多帧 contact sheet。
   - 不要在地图里写死 3s/6s/10s。
   - 由 Screenshot / ability owner 在同一 videoVisitId 下采样多帧。
   - 合成一个 contact sheet 或 multi_image 输入。
   - judge-seeding-video 仍然只调用一次 product-presence AI。
   - 禁止三次独立 AI 调用冒充多帧。
   - 日志必须输出 inputMode、sampledFrameCount、validFrameCount、fallbackReason。

2. 修复产品漏判口径。
   - 仍保持 product_yes / product_no 二元判断。
   - 不恢复 product_uncertain。
   - 多帧中只要出现明确商品实物、包装、手持展示、安装、试用、使用前后对比、配件/工具展示，即可 product_yes。
   - 不要求标准商品图，不判断盈利、采购、广告。

3. 压缩重复截图。
   当前链路：
   press-next-video-key
   → capture-next-item-verification-viewport
   → verify-next-item-advanced
   → capture-current-video-viewport
   → prepare-current-video-ai-input

   问题：
   capture-next-item-verification-viewport 已经是新视频截图，后面又 capture-current-video-viewport，重复。

   改为：
   press-next-video-key
   → capture-next-item-verification-viewport
   → verify next item
   → 复用 nextItemVerificationEvidenceRef 作为 current video evidence
   → prepare-current-video-ai-input
   → judge-seeding-video

4. 压缩 next item verification。
   - 不要每次都强制 AI verify-next-item-advanced。
   - 先做轻量机械验证：before/after screenshot hash、frame fingerprint、video surface变化。
   - 明确变化则通过。
   - 不确定才调用 AI verify-next-item-advanced。
   - 这不是降级，因为产品判断仍由 AI 做；机械验证只判断“有没有切到下一条”。

5. 日志增强但不要变重。
   AI_RESPONSE_DEBUG 必须输出结构化摘要：
   - stepId
   - decision
   - routeLabel
   - confidence
   - inputMode
   - sampledFrameCount
   - validFrameCount
   - visibleProductTypes
   - reason
   - evidenceObservations count
   不输出 raw image，不输出大 payload。

6. 加执法防复发。
   - product_presence_judgment 使用 single_frame_fallback 且无 fallbackReason 必须 FAIL。
   - 多帧被拆成多次 AI 调用必须 FAIL。
   - verify-next-item-advanced 后强制重新 capture-current-video-viewport 必须 FAIL。
   - AI_RESPONSE_DEBUG 缺 decision / routeLabel / inputMode / validFrameCount 摘要必须 FAIL。
   - product_yes 后没有进入 comments/evidence path 必须 FAIL。
```

一句话：**现在不是先降功能，而是把“单帧慢判断”压成“一次多帧准判断”，把“切换后重复截图+重复AI验证”压成“复用证据+不确定再问AI”。**
