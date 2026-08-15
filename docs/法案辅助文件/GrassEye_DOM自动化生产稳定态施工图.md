# GrassEye DOM Automation 生产稳定态施工图

status: active
version: 2026-08-15-v4
owner: dom-automation
active law: `.github/instructions/agent-rules/modules/module-dom-automation.instructions.md`

## 1. 建设定位

DOM Automation 是业务中立的页面原子动作能力组。它只负责：

```txt
snapshot -> locate -> one approved fill / click / upload -> wait / verify -> structured result
```

它不决定 Amazon 流程、不决定下一步、不判业务成功，不拥有 Browser session、Evidence、Runtime Log 或业务状态。

本图只描述现役七个 child abilities。已退役的 scroll/select/dismiss-overlay 不保留 wrapper、alias、fallback、mode switch 或影子实现。

## 2. Owner 边界

唯一目录：

```txt
src/capabilities/dom-automation/
  index.ts
  schema.ts
  contracts.ts
  runtime/
    dom-snapshot.ts
    dom-locate.ts
    dom-fill.ts
    dom-click.ts
    dom-upload.ts
    dom-verify.ts
    dom-target-binding.ts
```

唯一依赖方向：

```txt
Business Flow -> src/capabilities/dom-automation/index.ts -> one child ability -> injected BrowserTargetSession
```

强制边界：

- plugin 只能从 public `index.ts` 进入。
- DOM runtime 不 import plugin、mediator、App 或业务文案。
- Browser owner 只执行 exact-target 命令，不理解 DOM 业务语义。
- DOM 结果是动作事实，不是 Amazon 上传成功。
- 不新增 capability、runner、route、evidence、日志或 storage owner。

## 4. 法定子能力清单

现役清单固定为七个：

| child ability | 输入 | 输出 | 终态边界 |
| --- | --- | --- | --- |
| `read-dom-snapshot-once` | exact target + current document + deadline | `DomSnapshot` | 只观察 |
| `locate-dom-element-once` | snapshot + caller-approved hints | structured locate result | 不点击 |
| `fill-dom-element-once` | exact target + current document + element ref + approved text | `DomActionResult` | 专用 text mutation |
| `click-dom-element-once` | exact target + current document + element ref + caller approval | `DomActionResult` | 专用 click mutation |
| `upload-approved-file-once` | exact target + current document + file-input ref + approved path | `DomActionResult` | 专用 file-input mutation |
| `verify-dom-state-once` | expected state + bounded snapshot | structured verification result | 只观察 |

新增或恢复任何 child ability，必须先修改 active law、图纸、owner inspector、acceptance 和 CI 绑定。

## 4.1 统一结果合同

普通页面不确定性必须返回结构化终态，不能用异常冒充业务结论：

```ts
type DomActionResult = {
  status: "success" | "not_found" | "ambiguous" | "blocked" | "stale" | "review_required" | "failed";
  reason: string;
  targetRef?: string;
  documentRef?: string;
  beforeEvidenceRef?: string;
  afterEvidenceRef?: string;
};
```

固定规则：

- `not_found`：观察成功，但没有匹配元素。
- `ambiguous`：观察成功，但无法唯一定位。
- `stale`：document/element generation 已失效。
- `review_required`：frame、deep shadow、敏感动作或能力边界不支持。
- Browser transport/evaluate exception：技术 `failed`，调用方必须 fail closed；不得改写成 `not_found`。

## 5. Snapshot 图纸

- Snapshot 绑定 `targetRef + documentRef`，只读观察。
- 输出受限结构摘要，不返回 full HTML、cookie、storage 或 token。
- 覆盖 buttons、links、inputs、file inputs、dialogs、tables、text blocks、loading/overlay state。
- 每次底层 evaluate deadline 不超过调用方剩余预算；Amazon 上传 snapshot 上限仍为 1800ms。
- navigation、frame replacement 或 extension reconnect 后，旧 snapshot/element ref 失效。
- 无法唯一绑定的 iframe/deep shadow 节点不得伪装成 light DOM ref；返回 `review_required`。

## 6. Locator 图纸

Locator 只在 snapshot 上按 role、kind、visible text、label、aria label、nearby text 和 caller-approved state 排序候选。

唯一候选才可返回 element ref。零候选为 `not_found`；多个同分候选为 `ambiguous`。禁止坐标优先、全局 selector 注入和平台业务步骤。

Locator / Wait / Verify 的统一确认公式：

```txt
confirmed
  = caller-owned positive facts all present
  + exactly one current target/document candidate
  + named hidden/disabled/loading/stale/foreign/error/conflict candidates all absent
  + observation budget not exhausted
```

DOM core 只返回结构事实和冲突，不写 Amazon、GPT 或其他业务词。具体“什么是、什么不是”由
owning Flow 定义；DOM 负责保证零/多候选、正反冲突和预算耗尽不会被包装成 success。任何
observe / locate / retry / scroll 都必须有固定次数或截止时间，不能把服务生命周期当观察预算。

## 7. Observation / Mutation 分权

`BrowserTargetSession.evaluate` 只允许：

```txt
read attributes / text / role / value
revalidate element identity
read bounding rectangle and viewport
verify post-action state
```

evaluate 脚本禁止：

```txt
element.click()
scrollIntoView()
focus()
native value setter
document.execCommand()
dispatchEvent(input/change/...)
file assignment
```

页面修改只允许：

```txt
click  -> clickLocatedDomElement -> click_target
fill   -> clickLocatedDomElement -> click_target
          textInput              -> text_target
upload -> setFileInputFiles      -> set_file_input_files
```

三种 mutation 都必须在同一 exact target/current document 上执行。没有 active/current/front/first tab fallback，没有系统鼠标键盘，没有 caller-local evaluator。

## 8. Fill 图纸

```txt
revalidate editable element and visible viewport point (observation)
  -> click_target at the point
      -> text_target clear when required
          -> text_target approved text
              -> evaluate current value (observation)
```

元素不可编辑、不可见、点位超出 viewport 或 stale 时不输入。rich editor/closed shadow/frame 无现役专用命令时返回 `review_required`。不得恢复 JS value setter、execCommand、synthetic event 或 foreground typing。

## 9. Click 图纸

```txt
revalidate unique clickable element and visible viewport point (observation)
  -> sensitive-action gate
      -> clickLocatedDomElement
          -> click_target
              -> post-action observation
```

点位只是同一 element ref 的 transport 参数，不是第二定位链。元素超出 viewport 时返回结构化失败；Click 自己不得 `scrollIntoView` 或坐标试探。敏感 submit/delete/payment/refund 没有业务法案授权时返回 `review_required`。

## 10. Upload 图纸

```txt
validate caller-approved local path equality
  -> revalidate input[type=file] and current document
      -> classify topology
          -> LIGHT_DOM_SUPPORTED
              -> setFileInputFiles
                  -> set_file_input_files
                      -> observe selected-file metadata
```

| topology | 行为 |
| --- | --- |
| `LIGHT_DOM_SUPPORTED` | 走现役 `set_file_input_files` |
| `SHADOW_EXTENSION_REQUIRED` | 只有同一 Browser owner/同一 command 可覆盖时才允许按法案另行扩展 |
| `UNSUPPORTED_DEEP_SHADOW` | `review_required`，不触碰文件 |
| `UNSUPPORTED_FRAME` | `review_required`，不触碰文件 |
| `UNKNOWN` | `review_required`，不触碰文件 |

禁止 native picker fallback、DOM value assignment、第二 file transport、任意路径或把 `file-selected` 当业务 upload success。

## 11. Wait / Verify 图纸

- Wait 与 Verify 都是纯观察。
- 总 timeout 由 caller 给出；每次 snapshot 使用剩余预算与底层上限的较小值。
- navigation/document stale 立即返回结构化终态。
- predicate 只判断 caller-approved DOM state，不决定业务下一步。
- 只有业务 plugin 能把多个原子结果归纳为 `upload_success`、`already_uploaded` 等业务终态。

## 12. Browser 端口

DOM runtime 只依赖既有 `BrowserTargetSession` 窄口：

```ts
interface BrowserTargetSession {
  evaluate<T>(input: { script: string; timeoutMs?: number }): Promise<T>;
  clickLocatedDomElement(input: { point: { x: number; y: number }; documentRef: string }): Promise<BrowserActionResult>;
  textInput(input: { text: string; replace?: boolean; documentRef: string }): Promise<BrowserActionResult>;
  setFileInputFiles(input: { selector: string; files: string[]; documentRef: string }): Promise<BrowserActionResult>;
  wait(durationMs: number, signal?: AbortSignal): Promise<void>;
}
```

函数体到 executable expression 的转换只属于 `src/lib/browser/exact-target/**`。DOM 不包装、不 `eval`、不 `new Function`。

## 13. Evidence / Logs / Business Truth

- DOM result：本次原子动作事实。
- Forensics：发生过什么及 refs/hash。
- Runtime Log Spine：诊断步骤、时长和安全失败原因。
- Business task state：由调用 plugin 决定业务终态。

四本账保持分离，互不冒充。日志中的 success 不能证明 Amazon 上传成功。

## 14. Frame / Shadow / SPA 边界

- SPA hydration、loading、overlay 通过 bounded snapshot/wait 观察。
- frame/shadow identity 无法由现役 exact-target Browser 命令绑定时必须 fail closed。
- 禁止 foreground focus、active tab、coordinate probing、legacy evaluator 或隐藏 Playwright 链兜底。

## 15. 物理退役清单

必须保持不存在：

```txt
DOM evaluate 内的 el.click / focus / scrollIntoView
DOM evaluate 内的 value setter / execCommand / synthetic input/change
caller-local eval / new Function
active-tab/current-page/first-page fallback
coordinate-first click chain
native picker upload fallback
retired scroll/select/dismiss-overlay child ability wrapper
第二 DOM facade / runner / browser transport
```

发现旧片区必须删除，不允许通过 flag、alias、deprecated wrapper 或兼容分支保留。

## 16. Audit 图纸

唯一 owner：

```txt
scripts/audit/domains/dom-automation/
  manifest.json
  inspector.ts
  components/**
```

Inspector 必须使用 ts-morph AST/symbol，阻断：

- public facade 与七能力清单漂移。
- plugin 绕过 `index.ts` 或 DOM runtime import plugin。
- `BrowserTargetSession.evaluate` 脚本中出现 mutation call/property assignment。
- click 未调用 `clickLocatedDomElement`。
- fill 未调用 `clickLocatedDomElement` 与 `textInput`。
- upload 未调用 `setFileInputFiles` 或未验证 approved path/file-input。
- active/current/front/first fallback、系统 focus lease、caller-local evaluator。
- retired child owner 或第二链路径复活。

所有 finding 都是 FAIL；不得用 raw source grep/RegExp 当执法主裁。

## 17. Acceptance 图纸

Deterministic acceptance 必须真实执行：

1. snapshot 获取受限结构。
2. locate 返回唯一、not_found、ambiguous。
3. fill 经专用 click/clear/逐键 text/Tab commit command 并验证值；禁止 `Input.insertText`。
4. click 经专用 click command 并验证状态。
5. upload 只接收 approved light-DOM file input，由 Browser 向唯一真实 receiver 派发一次；组件终态由业务 owner 另行观察。
6. wait 在 deadline 内达到/超时。
7. verify 返回 matched/mismatched。
8. stale document、unsupported frame/deep shadow fail closed。
9. 技术 evaluate exception 不归类为业务 not_found。
10. mutation scripts 物理归零。

真实 Chrome 必须证明后台 controlled target 的 evaluate/click/fill/upload 只影响目标 tab，前台 tab 的 URL、title、scroll 和 input marker 不变。真实 Seller Central 还必须证明逐键输入加 Tab 能让 KAT 输入模型接受值，以及文件组件在清空 native receiver 后仍以自己的 ready item 表示已选文件；未实际提交成功时标记 `NOT_PRODUCTION_VERIFIED`。

## 18. 施工顺序

```txt
active law -> blueprint -> Browser evaluation owner -> DOM click/fill/upload
  -> Amazon technical failure integrity -> owner inspectors/manifests
      -> deterministic acceptance -> real Chrome -> one-shot CI preflight + ci:full
```

仓库只接受最终候选。没有 wrapper 过渡期、双写期或旧/新模式并存期。

## 19. 完成定义

- active law、施工图、manifest、inspector 与 generated truth 同一候选一致。
- 七个 child abilities 通过 public facade，旧 mutation/evaluator 片区物理不存在。
- deterministic acceptance、owner audit、typecheck 通过。
- `ACC-023B-01` 至 `ACC-023B-10` 的真实 Chrome exact-target matrix 通过。
- Seller Central 文件输入拓扑已实读，支持则以专用 command 完成；不支持则上传前 fail closed。
- 每次完整 CI 前取得全新独立只读 `CI_PREFLIGHT_PASS`，最终 `npm run ci:full` 通过。
- 独立终审按既定方案完成度不低于 95%。

静态、deterministic、真实 Chrome、真实 Seller Central、CI 和发布证据必须分别报告，互不冒充。
