# 通用 CI-FULL 执行提示词：二元鉴权、Fail-Fast、零偏差修复

> 适用对象：Codex / 高级工程 AI  
> 适用场景：任何项目进入 CI-FULL 生产级验收与修复  
> 核心原则：**CI-FULL 不是测试集合，CI-FULL 是法案与施工图的执法鉴权。**

---

## 0. 最高命令

你现在只做一件事：

```txt
启动 CI-FULL。
发现第一个失败。
鉴权根因。
修复根因。
重新启动 CI-FULL。
循环直到全绿。
```

唯一停止条件：

```txt
CI-FULL 全绿。
```

禁止停止条件：

```txt
修了一部分
大概通过
局部通过
还有 warning
还有 skipped
还有 known issue
还有 partial pass
```

---

## 1. CI-FULL 的定义

```txt
CI-FULL = 鉴权系统。
```

它鉴定的是：

```txt
代码文件是否 100% 按照法案和施工图的意图建设。
不能多一分。
不能少一分。
0 容忍偏差。
```

法案和施工图就是 CI-FULL 的价值。

如果 CI-FULL 不能证明代码忠实复现法案和施工图，CI-FULL 本身就是失败品，必须先修 CI-FULL。

---

## 2. 进入 CI-FULL 前的三道门

正式执行 CI-FULL 前，必须先鉴权三件事。

### Gate 1：全量法条执法

必须确认：

```txt
所有 active 法案全部进入执法链。
每条 active 法案都有 inspector / acceptance / enforcement evidence。
没有孤儿法案。
没有未执法法案。
没有 warning-only 法案。
没有 skipped active law。
```

如果不是：

```txt
立即修复执法覆盖。
不得进入正式 CI-FULL。
```

---

### Gate 2：元质检无正则

必须确认：

```txt
质检脚本必须 ts-morph。
必须 AST 级。
必须 symbol 级。
必须反逃逸级。
全面禁止正则。
0 容忍正则模式。
```

禁止质检脚本出现：

```txt
RegularExpressionLiteral
new RegExp()
.match()
.matchAll()
.test()
.search()
replace(regex)
replaceAll(regex)
split(regex)
grep-style scanning
raw regex string scanning
```

质检系统不能用正则审查别人。  
质检系统不能用低级文本扫描伪装高级执法。

如果发现：

```txt
立即修复元质检。
不得进入正式 CI-FULL。
```

---

### Gate 3：质检系统不得逃逸自身审查

必须确认：

```txt
所有 scripts/audit/** 被审查。
所有 scripts/acceptance/** 被审查。
所有 CI gate 文件被审查。
所有 inspector 被审查。
所有 meta-quality 文件也被审查。
```

禁止：

```txt
质检脚本审别人，不审自己
某些 audit 文件被 exclude
某些 acceptance 文件被 exclude
某些 generated truth 被跳过
某些 owner inspector 不进入 plan
```

如果质检系统存在逃逸口：

```txt
立即封死。
不得进入正式 CI-FULL。
```

---

## 3. 正式 CI-FULL 循环

执行顺序固定：

```txt
1. 启动 CI-FULL
2. 获取第一个报错
3. 鉴权失败原因
4. 找到根因 + 辅助根因
5. 输出鉴权结论
6. 修复根因 + 辅助根因
7. 再次启动 CI-FULL
8. 再次获取第一个报错
9. 重复循环
10. 直到 CI-FULL 全绿
```

---

## 4. 第一个报错规则

只允许处理：

```txt
第一个失败。
```

禁止：

```txt
一次性分析一堆错误
挑简单的先修
跳过第一个失败
根据后面的错误倒推
批量修复一堆不相关问题
把错误堆成山让人自己判断
```

第一个失败就是当前唯一真相。

---

## 5. 鉴权输出格式

每次失败，必须输出：

```txt
[CI-FIRST-FAILURE-AUTHORIZATION]
```

内容必须包含：

```txt
1. failurePhase
2. failureCommand
3. failureFile
4. failureMessage
5. rootCause
6. auxiliaryRootCause
7. violatedLawId
8. violatedBlueprintSection
9. 是否偏离法案：YES / NO
10. 是否偏离施工图：YES / NO
11. 是否属于 CI 自身缺陷：YES / NO
12. 是否属于代码实现缺陷：YES / NO
13. 是否属于执法覆盖缺陷：YES / NO
14. 最小修复点
```

没有完成鉴权，不得修改代码。

---

## 6. 修复原则

只修：

```txt
根因
辅助根因
导致 firstFailure 的文件
原则上，必须删除后重构代码文件；禁止采用补丁，禁止打创可贴，禁止迁就当前代码逻辑，
```

禁止：

```txt
兼容旧逻辑
新增第二链路
新增 fallback
新增 shadow
新增 bridge
绕开法案
降低施工图
削弱 inspector
删除测试来通过
把失败改成 warning
```

修复必须让代码更贴近法案和施工图，而不是让 CI 更容易通过。

---

## 7. 修复后动作

每次修复后只做一件事：

```bash
npm run ci:full
```

然后继续：

```txt
如果 PASS：结束。
如果 FAIL：读取新的第一个失败。
```

禁止：

```txt
只跑局部测试就宣布完成
只跑 typecheck 就宣布完成
只跑 acceptance 就宣布完成
只跑 audit 就宣布完成
```

最终判定只看：

```txt
CI-FULL 全绿。
```

---

## 8. CI-FULL 必须 Fail-Fast

CI-FULL 必须：

```txt
发现第一个失败立即停止。
写入 firstFailure。
跳过后续步骤。
输出 skippedAfterFailure。
```

禁止：

```txt
失败后继续跑完全部步骤
堆出几十个错误
让用户从错误山里找重点
用后续 PASS 掩盖前面 FAIL
```


## 9. 禁止兼容旧逻辑

系统只能二元：

```txt
存在 或 不存在。
active 或 delete。
single chain 或 forbidden。
```

禁止：

```txt
新旧逻辑并存
runId/taskId 双兼容
v1/v2 双入口
old/new 双 runner
legacy fallback
compatibility bridge
soft migration
```

如果旧逻辑不属于当前法案和施工图：

```txt
删除。
```

---

## 10. 元质检硬标准

元质检必须能证明：

```txt
质检系统自身没有逃逸。
质检脚本没有正则。
质检脚本不是文本扫描。
质检脚本使用 ts-morph AST。
质检脚本使用 symbol。
质检脚本能抓动态逃逸。
```

必须抓住：

```ts
const m = "match";
text[m](x);

const R = RegExp;
new R("x");

const fn = String.prototype.match;
fn.call(text, x);

globalThis["RegExp"];
```

symbol 无法确认时：

```txt
按 suspicious escape FAIL。
```

不得跳过。

---

## 11. 允许加入的重要 CI 鉴权项

除了用户三项硬要求，还必须检查：

```txt
generated artifacts 是否由源文件重建
generated artifacts 是否 stale
domain inspector 是否覆盖 plan lawIds
acceptance 是否覆盖核心法案
typecheck 是否通过
package scripts 是否唯一
app / runtime / plugin owner 是否越界
是否存在 warning-only
是否存在 partial pass
是否存在 skipped active law
是否存在未授权功能
是否存在代码多做或少做
```

---

## 12. 最终报告格式

只有 CI-FULL 全绿后，输出：

```txt
[CI-FULL-FINAL-GREEN-REPORT]
```

内容必须包含：

```txt
1. CI-FULL 最终结果：PASS
2. active 法案是否全量执法：YES
3. 元质检是否无正则：YES
4. 质检系统是否无逃逸：YES
5. 是否 fail-fast：YES
6. 是否存在第二链路：NO
7. 是否存在旧逻辑兼容：NO
8. 是否存在 warning-only：NO
9. 是否存在 partial pass：NO
10. firstFailure 修复轮次记录
11. 每轮根因
12. 每轮辅助根因
13. 每轮是否偏离法案
14. 每轮是否偏离施工图
15. 修改文件清单
16. 删除文件清单
17. 最终 CI-FULL 证据路径
```

如果未全绿，只能输出：

```txt
[CI-FULL-STILL-RED]
```

并且只输出当前第一个失败：

```txt
failurePhase
failureCommand
failureFile
rootCause
auxiliaryRootCause
violatedLawId
violatedBlueprintSection
minimalFix
```

禁止输出一堆后续错误。

---

## 13. 最狠标准

```txt
CI-FULL 没绿，就是失败。
法案没全量执法，就是失败。
元质检还有正则，就是失败。
质检系统能逃逸，就是失败。
不是 fail-fast，就是失败。
代码多做一分，就是失败。
代码少做一分，就是失败。
存在兼容，就是失败。
存在第二链路，就是失败。
存在 warning-only，就是失败。
存在 partial pass，就是失败。
```

---

## 14. 开始执行

现在开始：

```bash
npm run ci:full
```

只看第一个失败。  
鉴权。  
修复。  
再跑。  
直到全绿。
