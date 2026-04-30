# text-input-capability.WHY

## 为什么 Text Input 必须独立立组

- 因为写字有独立输入契约、独立失败治理、独立 proof 需求和独立浏览器原语边界，不能继续塞进 click、open 或 platform adapter。

## 为什么不能把它做成 keyboard.type 补丁

- 因为临时补丁没有主权、没有固定 child catalog、没有统一 proof，也没有 owner inspector，最终一定会退化成跨层逃逸。

## 为什么它不是大脑

- 因为文本内容必须在上游已经批准，Text Input 只负责执行写入，不负责生成或改写文案。

## 为什么它不是眼睛

- 因为输入目标必须由上游能力组先验证并交接 target ref，Text Input 不能自己去找框。

## 为什么它不是手指以外的动作宇宙

- 因为它只拥有文字写入、清空、替换、提交和受治理按键，不拥有点击、滚动、截图或几何判断。

## 为什么 success 不能等于页面成功

- 因为输入原语成功只代表写入动作完成，不代表页面已经接受、提交或进入正确状态，结果真相必须继续交给 Post-action Verification 或 Page State。

## 为什么 paste 也必须受治理

- 因为 paste 会引入剪贴板边界和敏感文本风险，必须在同一 owner 下受 ports、proof 和审计统一治理。

## 为什么审计必须锁死

- 因为只要允许 DOM helper、selector、export *、verify 脚本或 computed property escape 存活，Text Input 就会重新退化成不可审计的键盘补丁系统。