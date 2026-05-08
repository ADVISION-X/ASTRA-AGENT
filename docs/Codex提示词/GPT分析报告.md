明白，完全明白。你这次的纠正是对的，我前面方案确实扩大了复杂度。

现在只做 **2 件事**：

```txt
1. 定位问题：把 Visual Target / 定位子能力真正强化起来。
2. 切换下一个视频：废弃点击箭头，改用键盘 ↑ / ↓。
```

日志和仓库都能对上：当前流程已经跑到真实平台动作链，但下一条视频现在仍然经过 `locate-next-item-target → normalize-next-video-arrow → click-next-video-arrow` 这条点击链。 仓库 Route Plan 里也确实存在 `locate-next-item-target`、`normalize-next-video-arrow`、`click-next-video-arrow`、`verify-next-item-advanced` 这些步骤。

---

# 一、第一件事：定位能力必须独立强化

你说得对：**定位是一个基础子能力，不是为“下一个视频箭头”服务的临时补丁。**

它以后会用于：

```txt
找评论按钮
找关闭按钮
找输入框
找播放区域
找商品区域
找下一步可操作控件
```

所以定位能力必须成为真正的“眼睛”。

当前 `observe-next-item-target-candidate` 只是把请求交给 `executeVisualTarget()`，然后 Visual Target 内部跑一组 gate。  这说明架构方向有了，但能力成熟度不够。

## 定位子能力的强化原则

不要复杂化，只定 4 条：

```txt
1. Visual Target 只负责定位，不负责点击。
2. Visual Target 必须输出 bbox + clickPoint + confidence + coordinateSpace + screenshotRef。
3. Visual Target 不允许只输出一个裸坐标。
4. 低置信度必须 fail-closed，不允许继续交给 Mouse Click 瞎点。
```

也就是说，定位能力的输出应该从：

```txt
我觉得点这里
```

升级成：

```txt
我在这张截图中找到这个控件；
它的位置是 bbox；
建议点击点是 clickPoint；
置信度是 confidence；
坐标空间是 browserViewport；
来源截图是 screenshotRef；
质量标记是 dataQualityFlags。
```

这个不复杂，但这是能力成熟的底线。

---

# 二、第二件事：下一个视频改成键盘 ↑ / ↓

这个更简单，也更符合大道至简。

当前不要再用：

```txt
click-next-video-arrow
```

改成：

```txt
press-keyboard-arrow-down
press-keyboard-arrow-up
```

对于刷视频平台来说，键盘上下键比点击箭头稳定得多：

```txt
向下：下一条视频
向上：上一条视频
```

这条能力不依赖精确坐标，不需要找箭头，不怕页面按钮位置变化。

## Route Plan 应该改成

当前：

```txt
locate-next-item-target
→ normalize-next-video-arrow
→ click-next-video-arrow
→ capture-next-item-verification-viewport
→ verify-next-item-advanced
```

改成：

```txt
press-next-video-key
→ capture-next-item-verification-viewport
→ verify-next-item-advanced
```

也就是：

```txt
键盘切换
→ 截图
→ AI 验证是否真的进入下一条
```

保留验证，但取消定位箭头和点击箭头。

---

# 三、能力归属怎么放，避免新增复杂度

仓库里现在能看到 `mouse-click` 能力组，但我没有看到现成的 keyboard 能力。`mouse-click` 目前有 `click-browser-coordinate` 这种坐标点击子能力。

按大道至简，不建议为了上下键新建一个庞大的新系统。

可以这样落：

```txt
方案 A：如果已有 text-input / input 类能力组
→ 增加 child capability：press-keyboard-key

方案 B：如果当前没有合适能力组
→ 建一个非常小的 keyboard-control 能力组
→ 只做 press-key，不做语义判断
```

但是如果你的法案系统严格冻结 14 个 ability groups，那就不要新增第 15 个能力组，优先挂到已有输入类能力下。

子能力名建议：

```txt
press-browser-key
```

输入只允许白名单：

```txt
ArrowDown
ArrowUp
Escape
Enter
Space
```

现阶段只开放：

```txt
ArrowDown
ArrowUp
```

---

# 四、这两件事之间不能混

这是关键。

```txt
定位能力强化
≠
下一个视频还继续靠定位
```

定位问题要解决，因为它是所有视觉操作的基础。

但“下一个视频”这个动作，不应该继续拿它练手。

正确关系是：

```txt
定位能力：继续强化，未来用于找按钮、控件、输入框。
切换视频：现在改用键盘上下键，不再依赖定位。
```

这就干净了。

---

# 五、施工图 / 执法要防止回潮

必须加三条执法，不然后面又会退回点击箭头。

## 1. Route Plan 防回潮

禁止：

```txt
next-item advance 主路使用 click-next-video-arrow
```

要求：

```txt
next-item advance 主路必须是 keyboard ArrowDown / ArrowUp
```

## 2. Mouse Click 防回潮

禁止：

```txt
Mouse Click success = next video advanced
```

Mouse Click 只能表示：

```txt
机械点击已发生
```

不能代表业务成功。

## 3. Visual Target 防裸坐标

禁止 Visual Target 输出：

```txt
只有 clickPoint，没有 bbox / screenshotRef / coordinateSpace / confidence
```

否则 fail。

---

# 六、给 Codex 的最短提示词

```txt
当前实测结论：坐标点击下一个视频箭头非常不稳定。不要再扩大复杂方案，只解决两件事。

第一件事：定位能力强化。
Visual Target / observe-next-item-target-candidate 必须作为独立定位子能力强化。
要求：
1. Visual Target 只负责定位，不负责点击、不判断业务成功。
2. 输出不得只有裸 clickPoint。
3. 输出必须包含 bbox、clickPoint、confidence、coordinateSpace、sourceScreenshotEvidenceRef、dataQualityFlags。
4. 低置信度、缺 bbox、缺 screenshotRef、缺 coordinateSpace 必须 fail-closed。
5. Geometry Guard 只接收结构化定位结果，不接收裸坐标。

第二件事：切换下一个视频改方案。
废弃点击下一个视频箭头作为主路。
Route Plan 中取消 next-item 主链里的：
- locate-next-item-target
- normalize-next-video-arrow
- click-next-video-arrow

改为：
- press-next-video-key，使用 ArrowDown
- capture-next-item-verification-viewport
- verify-next-item-advanced

要求：
1. 新增或复用输入类能力子能力 press-browser-key。
2. press-browser-key 只允许白名单按键，现阶段开放 ArrowDown / ArrowUp。
3. ArrowDown = 下一条视频；ArrowUp = 上一条视频。
4. Keyboard 子能力只执行机械按键，不判断是否进入下一条。
5. 是否进入下一条仍由 verify-next-item-advanced 判断。
6. 不新增地图职责，不让地图写判断逻辑。
7. Route Plan 是肌肉记忆唯一来源。

执法防复发：
1. Route Plan 中 next-item advance 主路不得再使用 click-next-video-arrow。
2. click-next-video-arrow 不得作为下一条视频主推进方案。
3. Visual Target 输出缺 bbox / screenshotRef / coordinateSpace / confidence 必须 FAIL。
4. 裸 clickPoint 进入 Geometry Guard 必须 FAIL。
5. press-browser-key 接收非白名单按键必须 FAIL。
6. 删除 verify-next-item-advanced 必须 FAIL。

不要复杂化。
不要引入多套推进策略。
不要做 fallback 大系统。
当前只做：定位能力强化 + 下一个视频改键盘上下键。
```

一句话：**定位能力继续练眼睛；切换视频不要用眼睛点箭头，直接用键盘上下键。**
